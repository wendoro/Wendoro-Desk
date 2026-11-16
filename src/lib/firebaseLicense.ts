import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { z } from 'zod';
import { WENDORO_LICENSE_PLANS } from '@/src/core/contracts/licensing';
import {
  PURCHASABLE_MODULE_SLUGS,
  expandSelectionWithDependencies,
  getEntitledModulesForLicense,
  normalizePurchasedModules,
} from '@/src/core/contracts/marketplace';
import { SubscriptionTier } from '@/src/core/contracts/tenancy';
import {
  ClientPlatform,
  LicenseActivationState,
  LicensedPlatform,
  ServerLicenseSummary,
  detectClientPlatform,
  getDefaultDeviceName,
  getOrCreateDeviceId,
} from '@/src/core/engine/licenseClient';
import {
  OperationType,
  auth,
  db,
  firebaseProjectConfig,
  handleFirestoreError,
  isFirebaseConfigured,
} from '@/src/lib/firebase';

// Synchronized verbatim with firebase-blueprint.json
export const LICENSE_KEY_PATTERN = /^WND-[A-Z]{4}-[A-Z0-9]{8}-[A-Z0-9]{8}$/;
export const FIRESTORE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
export const SIGNATURE_PATTERN = /^[A-Z0-9]+$/;

export const TIER_CODES: Record<SubscriptionTier, string> = {
  free: 'COMM',
  starter: 'STRT',
  business: 'BUSN',
  professional: 'PROF',
  enterprise: 'ENTR',
  white_label: 'WLAB',
  self_hosted: 'SELF',
};

export const TIER_DEFAULT_MAX_DEVICES: Record<SubscriptionTier, number> = {
  free: 3,
  starter: 10,
  business: 30,
  professional: 100,
  enterprise: 500,
  white_label: 2000,
  self_hosted: 1000,
};

export const LicenseRegistrationBlueprintSchema = z.object({
  licenseKey: z.string().min(12).max(64).regex(LICENSE_KEY_PATTERN),
  ownerUid: z.string().min(1).max(128).regex(FIRESTORE_ID_PATTERN),
  organizationName: z.string().trim().min(1).max(120),
  planTier: z.enum([
    'free',
    'starter',
    'business',
    'professional',
    'enterprise',
    'white_label',
    'self_hosted',
  ]),
  platform: z.enum(['desktop', 'android', 'both']),
  status: z.enum(['active', 'revoked', 'expired']),
  maxDevices: z.number().int().min(1).max(2000),
  signature: z.string().min(8).max(128).regex(SIGNATURE_PATTERN),
  expiresAt: z.string().min(4).max(40),
  purchasedModules: z.array(z.enum(PURCHASABLE_MODULE_SLUGS)).max(32).optional(),
});

export const LicenseDeviceBlueprintSchema = z.object({
  deviceId: z.string().min(4).max(128).regex(FIRESTORE_ID_PATTERN),
  licenseKey: z.string().min(12).max(64).regex(LICENSE_KEY_PATTERN),
  ownerUid: z.string().min(1).max(128).regex(FIRESTORE_ID_PATTERN),
  deviceName: z.string().trim().min(1).max(100),
  platform: z.enum(['desktop', 'android', 'web']),
  appVersion: z.string().trim().min(1).max(32),
});

export type LicenseRegistrationDoc = z.infer<typeof LicenseRegistrationBlueprintSchema> & {
  createdAt?: unknown;
  updatedAt?: unknown;
};

export class FirebaseLicenseError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'FirebaseLicenseError';
  }
}

export function normalizeLicenseKey(input: string): string {
  return input.trim().toUpperCase();
}

export function sanitizeFirestoreId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
}

export function validateLicenseKeyFormat(input: string): {
  valid: boolean;
  normalized: string;
  tierCode?: string;
  error?: string;
} {
  const normalized = normalizeLicenseKey(input);
  if (!normalized) {
    return { valid: false, normalized, error: 'Enter your WENDORO registration key.' };
  }
  if (!LICENSE_KEY_PATTERN.test(normalized)) {
    return {
      valid: false,
      normalized,
      error: 'Invalid key format. Expected WND-XXXX-XXXXXXXX-XXXXXXXX.',
    };
  }
  const tierCode = normalized.split('-')[1];
  const knownCodes = new Set(Object.values(TIER_CODES));
  if (!tierCode || !knownCodes.has(tierCode)) {
    return {
      valid: false,
      normalized,
      error: `Unrecognized license edition code "${tierCode ?? ''}".`,
    };
  }
  return { valid: true, normalized, tierCode };
}

export function resolvePlanName(tier: SubscriptionTier): string {
  return WENDORO_LICENSE_PLANS.find((p) => p.tier === tier)?.name ?? tier;
}

export function evaluateLicenseEntitlement(params: {
  license: Pick<
    LicenseRegistrationDoc,
    'licenseKey' | 'status' | 'expiresAt' | 'platform' | 'maxDevices'
  >;
  currentPlatform: ClientPlatform;
  boundDevicesCount: number;
  alreadyBoundOnThisDevice: boolean;
  nowMs?: number;
}): { allowed: boolean; code: string; message: string } {
  const { license, currentPlatform, boundDevicesCount, alreadyBoundOnThisDevice } = params;
  const nowMs = params.nowMs ?? Date.now();

  if (license.status !== 'active') {
    return {
      allowed: false,
      code: 'LICENSE_INACTIVE',
      message: `License key status is "${license.status}". Contact your administrator to renew or reactivate.`,
    };
  }

  if (license.expiresAt && license.expiresAt !== 'never') {
    const expiryMs = Date.parse(license.expiresAt);
    if (!Number.isNaN(expiryMs) && expiryMs < nowMs) {
      return {
        allowed: false,
        code: 'LICENSE_EXPIRED',
        message: `License key expired on ${license.expiresAt.slice(0, 10)}.`,
      };
    }
  }

  if (
    license.platform !== 'both' &&
    currentPlatform !== 'web' &&
    license.platform !== currentPlatform
  ) {
    return {
      allowed: false,
      code: 'PLATFORM_NOT_LICENSED',
      message: `This key is restricted to ${license.platform} installations only.`,
    };
  }

  if (!alreadyBoundOnThisDevice && boundDevicesCount >= license.maxDevices) {
    return {
      allowed: false,
      code: 'ACTIVATION_LIMIT_REACHED',
      message: `Maximum device limit (${license.maxDevices}) reached for this license key.`,
    };
  }

  return {
    allowed: true,
    code: 'LICENSE_VALID',
    message: 'License key verified against Firebase.',
  };
}

function randomUpperHex(length: number): string {
  const bytes = new Uint8Array(Math.ceil(length / 2));
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
    .slice(0, length);
}

async function computePayloadChecksumHex(payload: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoded = new TextEncoder().encode(payload);
    const digest = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
      .slice(0, 16);
  }
  return randomUpperHex(16);
}

function requireVerifiedFirebaseSession(): {
  firestore: NonNullable<typeof db>;
  uid: string;
  email: string;
  projectId: string;
} {
  if (!isFirebaseConfigured || !db || !auth || !firebaseProjectConfig) {
    throw new FirebaseLicenseError(
      'FIREBASE_NOT_CONFIGURED',
      'Firebase Firestore is not configured in this build yet.',
    );
  }
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new FirebaseLicenseError(
      'FIREBASE_AUTH_REQUIRED',
      'Sign in with your Google account to verify your license against Firebase.',
    );
  }
  if (!currentUser.emailVerified) {
    throw new FirebaseLicenseError(
      'FIREBASE_EMAIL_UNVERIFIED',
      'Your Firebase account email must be verified before activating a license.',
    );
  }
  return {
    firestore: db,
    uid: sanitizeFirestoreId(currentUser.uid),
    email: currentUser.email || 'licensed@wendoro.local',
    projectId: firebaseProjectConfig.projectId,
  };
}

function timestampToIso(value: unknown): string {
  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof value === 'string') return value;
  return new Date().toISOString();
}

export async function verifyAndActivateLicenseInFirebase(params: {
  licenseKey: string;
  deviceId?: string;
  deviceName?: string;
  appVersion?: string;
}): Promise<LicenseActivationState> {
  const formatCheck = validateLicenseKeyFormat(params.licenseKey);
  if (!formatCheck.valid) {
    throw new FirebaseLicenseError('INVALID_KEY_FORMAT', formatCheck.error || 'Invalid key.');
  }

  const { firestore, uid, email, projectId } = requireVerifiedFirebaseSession();
  const key = formatCheck.normalized;
  const deviceId = sanitizeFirestoreId(params.deviceId || getOrCreateDeviceId());
  const currentPlatform = detectClientPlatform();
  const deviceName = (params.deviceName || getDefaultDeviceName()).trim().slice(0, 100);
  const appVersion = (params.appVersion || '2.0.0').trim().slice(0, 32);

  const licensePath = `licenses/${key}`;
  const licenseRef = doc(firestore, 'licenses', key);

  let licenseData: LicenseRegistrationDoc;
  try {
    const snap = await getDocFromServer(licenseRef);
    if (!snap.exists()) {
      throw new FirebaseLicenseError(
        'LICENSE_NOT_FOUND',
        `License key ${key} was not found in Firebase Firestore.`,
      );
    }
    licenseData = LicenseRegistrationBlueprintSchema.parse(snap.data());
  } catch (err) {
    if (err instanceof FirebaseLicenseError || err instanceof z.ZodError) {
      throw err instanceof z.ZodError
        ? new FirebaseLicenseError('CORRUPT_LICENSE_RECORD', 'License record failed schema validation.')
        : err;
    }
    handleFirestoreError(err, OperationType.GET, licensePath);
  }

  const devicesPath = `licenses/${key}/devices`;
  let boundDevicesCount = 0;
  let alreadyBound = false;

  try {
    const devicesSnap = await getDocs(
      query(collection(firestore, 'licenses', key, 'devices'), where('ownerUid', '==', uid)),
    );
    boundDevicesCount = devicesSnap.size;
    alreadyBound = devicesSnap.docs.some((d) => d.id === deviceId);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, devicesPath);
  }

  const decision = evaluateLicenseEntitlement({
    license: licenseData,
    currentPlatform,
    boundDevicesCount,
    alreadyBoundOnThisDevice: alreadyBound,
  });

  if (!decision.allowed) {
    throw new FirebaseLicenseError(decision.code, decision.message);
  }

  const devicePayload = LicenseDeviceBlueprintSchema.parse({
    deviceId,
    licenseKey: key,
    ownerUid: uid,
    deviceName,
    platform: currentPlatform,
    appVersion,
  });

  const devicePath = `licenses/${key}/devices/${deviceId}`;
  const deviceRef = doc(firestore, 'licenses', key, 'devices', deviceId);

  try {
    const existingDeviceSnap = await getDoc(deviceRef);
    if (existingDeviceSnap.exists()) {
      await updateDoc(deviceRef, {
        deviceName: devicePayload.deviceName,
        platform: devicePayload.platform,
        appVersion: devicePayload.appVersion,
        lastVerifiedAt: serverTimestamp(),
      });
    } else {
      const batch = writeBatch(firestore);
      batch.set(deviceRef, {
        ...devicePayload,
        activatedAt: serverTimestamp(),
        lastVerifiedAt: serverTimestamp(),
      });
      await batch.commit();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, devicePath);
  }

  const finalUsedDevices = alreadyBound ? boundDevicesCount : boundDevicesCount + 1;
  const nowIso = new Date().toISOString();

  return {
    licenseKey: licenseData.licenseKey,
    email,
    organizationName: licenseData.organizationName,
    planTier: licenseData.planTier,
    planName: resolvePlanName(licenseData.planTier),
    platform: licenseData.platform,
    serverUrl: `firebase://${projectId}`,
    activationToken: `fb_${licenseData.signature.slice(0, 12)}_${deviceId.slice(0, 8)}`,
    verifiedAt: nowIso,
    expiresAt: licenseData.expiresAt === 'never' ? null : licenseData.expiresAt,
    maxDevices: licenseData.maxDevices,
    usedDevices: finalUsedDevices,
    deviceId,
    purchasedModules: normalizePurchasedModules(licenseData.purchasedModules),
  };
}

export async function registerLicenseInFirebase(params: {
  organizationName: string;
  planTier: SubscriptionTier;
  platform: LicensedPlatform;
  deviceId?: string;
  deviceName?: string;
  appVersion?: string;
}): Promise<LicenseActivationState> {
  const { firestore, uid, email, projectId } = requireVerifiedFirebaseSession();

  const tierCode = TIER_CODES[params.planTier] || 'COMM';
  const idSegment = randomUpperHex(8);
  const signature = await computePayloadChecksumHex(
    `${uid}:${tierCode}:${idSegment}:${params.platform}`,
  );
  const key = `WND-${tierCode}-${idSegment}-${signature.slice(0, 8)}`;
  const maxDevices = TIER_DEFAULT_MAX_DEVICES[params.planTier] ?? 3;
  const expiresAt =
    params.planTier === 'free'
      ? 'never'
      : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

  const licensePayload = LicenseRegistrationBlueprintSchema.parse({
    licenseKey: key,
    ownerUid: uid,
    organizationName: (params.organizationName || 'My Organization').trim().slice(0, 120),
    planTier: params.planTier,
    platform: params.platform,
    status: 'active',
    maxDevices,
    signature,
    expiresAt,
    purchasedModules: [],
  });

  const deviceId = sanitizeFirestoreId(params.deviceId || getOrCreateDeviceId());
  const devicePayload = LicenseDeviceBlueprintSchema.parse({
    deviceId,
    licenseKey: key,
    ownerUid: uid,
    deviceName: (params.deviceName || getDefaultDeviceName()).trim().slice(0, 100),
    platform: detectClientPlatform(),
    appVersion: (params.appVersion || '2.0.0').trim().slice(0, 32),
  });

  const licensePath = `licenses/${key}`;
  try {
    const batch = writeBatch(firestore);
    batch.set(doc(firestore, 'licenses', key), {
      ...licensePayload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(firestore, 'licenses', key, 'devices', deviceId), {
      ...devicePayload,
      activatedAt: serverTimestamp(),
      lastVerifiedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, licensePath);
  }

  return {
    licenseKey: key,
    email,
    organizationName: licensePayload.organizationName,
    planTier: licensePayload.planTier,
    planName: resolvePlanName(licensePayload.planTier),
    platform: licensePayload.platform,
    serverUrl: `firebase://${projectId}`,
    activationToken: `fb_${signature.slice(0, 12)}_${deviceId.slice(0, 8)}`,
    verifiedAt: new Date().toISOString(),
    expiresAt: expiresAt === 'never' ? null : expiresAt,
    maxDevices,
    usedDevices: 1,
    deviceId,
    purchasedModules: [],
  };
}

export async function listUserLicensesInFirebase(): Promise<ServerLicenseSummary[]> {
  const { firestore, uid, email } = requireVerifiedFirebaseSession();
  const licensesPath = 'licenses';

  try {
    const snap = await getDocs(
      query(collection(firestore, licensesPath), where('ownerUid', '==', uid)),
    );
    const items: ServerLicenseSummary[] = [];

    for (const docSnap of snap.docs) {
      const parsed = LicenseRegistrationBlueprintSchema.safeParse(docSnap.data());
      if (!parsed.success) continue;
      const raw = docSnap.data();

      let usedDevices = 0;
      try {
        const devSnap = await getDocs(
          query(
            collection(firestore, 'licenses', parsed.data.licenseKey, 'devices'),
            where('ownerUid', '==', uid),
          ),
        );
        usedDevices = devSnap.size;
      } catch {
        usedDevices = 0;
      }

      items.push({
        id: docSnap.id,
        licenseKey: parsed.data.licenseKey,
        email,
        organizationName: parsed.data.organizationName,
        planTier: parsed.data.planTier,
        planName: resolvePlanName(parsed.data.planTier),
        platform: parsed.data.platform,
        maxDevices: parsed.data.maxDevices,
        usedDevices,
        status: parsed.data.status,
        issuedAt: timestampToIso(raw.createdAt),
        expiresAt: parsed.data.expiresAt === 'never' ? null : parsed.data.expiresAt,
        purchasedModules: normalizePurchasedModules(parsed.data.purchasedModules),
      });
    }

    return items;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, licensesPath);
  }
}

export async function reverifyActiveLicenseInFirebase(
  activation: LicenseActivationState,
): Promise<{
  valid: boolean;
  offlineGrace?: boolean;
  reason?: string;
  updatedActivation?: LicenseActivationState;
}> {
  if (!isFirebaseConfigured || !db || !auth?.currentUser || !auth.currentUser.emailVerified) {
    return {
      valid: false,
      reason: 'Sign in with Firebase to re-verify your license key.',
    };
  }

  const key = normalizeLicenseKey(activation.licenseKey);
  const licensePath = `licenses/${key}`;

  try {
    const snap = await getDocFromServer(doc(db, 'licenses', key));
    if (!snap.exists()) {
      return {
        valid: false,
        reason: `License ${key} is no longer registered on Firebase.`,
      };
    }
    const parsed = LicenseRegistrationBlueprintSchema.parse(snap.data());
    const decision = evaluateLicenseEntitlement({
      license: parsed,
      currentPlatform: detectClientPlatform(),
      boundDevicesCount: activation.usedDevices,
      alreadyBoundOnThisDevice: true,
    });

    if (!decision.allowed) {
      return { valid: false, reason: decision.message };
    }

    return {
      valid: true,
      updatedActivation: {
        ...activation,
        verifiedAt: new Date().toISOString(),
        planTier: parsed.planTier,
        planName: resolvePlanName(parsed.planTier),
        maxDevices: parsed.maxDevices,
        expiresAt: parsed.expiresAt === 'never' ? null : parsed.expiresAt,
        purchasedModules: normalizePurchasedModules(parsed.purchasedModules),
      },
    };
  } catch (err) {
    if (err instanceof Error && err.message.includes('the client is offline')) {
      return {
        valid: true,
        offlineGrace: true,
        reason: 'Offline native mode: running with cached activation.',
        updatedActivation: activation,
      };
    }
    return {
      valid: false,
      reason: err instanceof Error ? err.message : 'Firebase license verification failed.',
    };
  }
}

export async function purchaseModulesInFirebase(params: {
  licenseKey: string;
  moduleSlugs: string[];
  includeDependencies?: boolean;
}): Promise<{ purchasedModules: string[]; addedModules: string[] }> {
  const { firestore } = requireVerifiedFirebaseSession();
  const key = normalizeLicenseKey(params.licenseKey);
  const licensePath = `licenses/${key}`;
  const licenseRef = doc(firestore, 'licenses', key);

  let existingLicense: LicenseRegistrationDoc;
  try {
    const snap = await getDocFromServer(licenseRef);
    if (!snap.exists()) {
      throw new FirebaseLicenseError(
        'LICENSE_NOT_FOUND',
        `License key ${key} was not found in Firebase.`,
      );
    }
    existingLicense = LicenseRegistrationBlueprintSchema.parse(snap.data());
  } catch (err) {
    if (err instanceof FirebaseLicenseError) throw err;
    handleFirestoreError(err, OperationType.GET, licensePath);
  }

  const currentPurchased = normalizePurchasedModules(existingLicense.purchasedModules);
  const currentEntitled = getEntitledModulesForLicense(
    existingLicense.planTier,
    currentPurchased,
  );

  const requested = params.includeDependencies === false
    ? normalizePurchasedModules(params.moduleSlugs).filter(
        (slug) => !currentEntitled.includes(slug),
      )
    : expandSelectionWithDependencies(params.moduleSlugs, currentEntitled).resolvedSlugs;

  const nextPurchased = normalizePurchasedModules([...currentPurchased, ...requested]);

  try {
    await updateDoc(licenseRef, {
      purchasedModules: nextPurchased,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, licensePath);
  }

  return {
    purchasedModules: nextPurchased,
    addedModules: requested,
  };
}
