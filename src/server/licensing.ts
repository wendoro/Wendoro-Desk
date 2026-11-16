import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { SubscriptionTier, UserTypeId } from '@/src/core/contracts/tenancy';
import { WENDORO_LICENSE_PLANS } from '@/src/core/contracts/licensing';
import {
  expandSelectionWithDependencies,
  getEntitledModulesForLicense,
  normalizePurchasedModules,
} from '@/src/core/contracts/marketplace';

export type LicensedPlatform = 'desktop' | 'android' | 'both';

export interface ActivatedDeviceRecord {
  deviceId: string;
  deviceName: string;
  platform: 'desktop' | 'android' | 'web';
  appVersion: string;
  activatedAt: string;
  lastVerifiedAt: string;
}

export interface StoredLicenseUser {
  id: string;
  email: string;
  fullName: string;
  organizationName: string;
  passwordSalt: string;
  passwordHash: string;
  createdAt: string;
}

export interface StoredLicenseRecord {
  id: string;
  licenseKey: string;
  userId: string;
  email: string;
  organizationName: string;
  planTier: SubscriptionTier;
  platform: LicensedPlatform;
  maxDevices: number;
  status: 'active' | 'revoked' | 'expired';
  issuedAt: string;
  expiresAt: string | null;
  activatedDevices: ActivatedDeviceRecord[];
  purchasedModules?: string[];
  userType?: UserTypeId;
}

export interface PublicLicenseSummary {
  id: string;
  licenseKey: string;
  email: string;
  organizationName: string;
  planTier: SubscriptionTier;
  planName: string;
  platform: LicensedPlatform;
  maxDevices: number;
  usedDevices: number;
  status: 'active' | 'revoked' | 'expired';
  issuedAt: string;
  expiresAt: string | null;
  activatedDevices: ActivatedDeviceRecord[];
  purchasedModules: string[];
  userType?: UserTypeId;
}

interface LicenseRegistryStore {
  users: StoredLicenseUser[];
  licenses: StoredLicenseRecord[];
}

const TIER_CODE_MAP: Record<SubscriptionTier, string> = {
  free: 'COMM',
  starter: 'STRT',
  business: 'BUSN',
  professional: 'PROF',
  enterprise: 'ENTR',
  white_label: 'WLAB',
  self_hosted: 'SELF',
};

const TIER_MAX_DEVICES: Record<SubscriptionTier, number> = {
  free: 3,
  starter: 10,
  business: 30,
  professional: 100,
  enterprise: 500,
  white_label: 2000,
  self_hosted: 1000,
};

export class LicenseServerError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'LicenseServerError';
  }
}

export interface LicenseServiceOptions {
  dataDir?: string;
  signingSecret?: string;
}

function defaultDataDir(): string {
  return path.resolve(process.cwd(), '.data');
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function resolveSigningSecret(dataDir: string, override?: string): string {
  if (override && override.trim().length >= 16) return override.trim();
  const envSecret =
    process.env.LICENSE_SIGNING_SECRET || process.env.BETTER_AUTH_SECRET;
  if (
    envSecret &&
    envSecret.trim().length >= 16 &&
    !envSecret.includes('replace-with')
  ) {
    return envSecret.trim();
  }

  ensureDir(dataDir);
  const keyFile = path.join(dataDir, 'license-secret.key');
  if (fs.existsSync(keyFile)) {
    const existing = fs.readFileSync(keyFile, 'utf8').trim();
    if (existing.length >= 32) return existing;
  }
  const generated = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(keyFile, generated, { mode: 0o600 });
  return generated;
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function verifyPassword(password: string, salt: string, expectedHex: string): boolean {
  const actual = Buffer.from(hashPassword(password, salt), 'hex');
  const expected = Buffer.from(expectedHex, 'hex');
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

function signLicensePayload(
  secret: string,
  fields: { id: string; email: string; planTier: SubscriptionTier; issuedAt: string },
): string {
  const mac = crypto
    .createHmac('sha256', secret)
    .update(`${fields.id}:${fields.email.toLowerCase()}:${fields.planTier}:${fields.issuedAt}`)
    .digest('hex')
    .toUpperCase();
  return mac.slice(0, 8);
}

function signActivationToken(
  secret: string,
  payload: {
    licenseId: string;
    licenseKey: string;
    deviceId: string;
    planTier: SubscriptionTier;
    verifiedAt: string;
  },
): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('base64url');
  return `${body}.${sig}`;
}

function toPublicSummary(record: StoredLicenseRecord): PublicLicenseSummary {
  const plan = WENDORO_LICENSE_PLANS.find((p) => p.tier === record.planTier);
  return {
    id: record.id,
    licenseKey: record.licenseKey,
    email: record.email,
    organizationName: record.organizationName,
    planTier: record.planTier,
    planName: plan?.name ?? record.planTier,
    platform: record.platform,
    maxDevices: record.maxDevices,
    usedDevices: record.activatedDevices.length,
    status: record.status,
    issuedAt: record.issuedAt,
    expiresAt: record.expiresAt,
    activatedDevices: record.activatedDevices,
    purchasedModules: normalizePurchasedModules(record.purchasedModules),
    userType: record.userType,
  };
}

export function createLicenseService(options: LicenseServiceOptions = {}) {
  const dataDir = options.dataDir ?? defaultDataDir();
  const storePath = path.join(dataDir, 'licenses.json');
  const secret = resolveSigningSecret(dataDir, options.signingSecret);

  const readStore = (): LicenseRegistryStore => {
    ensureDir(dataDir);
    if (!fs.existsSync(storePath)) {
      return { users: [], licenses: [] };
    }
    try {
      const raw = fs.readFileSync(storePath, 'utf8');
      const parsed = JSON.parse(raw) as LicenseRegistryStore;
      return {
        users: Array.isArray(parsed.users) ? parsed.users : [],
        licenses: Array.isArray(parsed.licenses) ? parsed.licenses : [],
      };
    } catch {
      return { users: [], licenses: [] };
    }
  };

  const writeStore = (store: LicenseRegistryStore): void => {
    ensureDir(dataDir);
    fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf8');
  };

  const registerAndIssueLicense = (input: {
    email: string;
    password: string;
    fullName: string;
    organizationName: string;
    planTier?: SubscriptionTier;
    platform?: LicensedPlatform;
    deviceId?: string;
    deviceName?: string;
    devicePlatform?: 'desktop' | 'android' | 'web';
    appVersion?: string;
  }) => {
    const email = input.email.trim().toLowerCase();
    const password = input.password;
    const fullName = input.fullName.trim();
    const organizationName = input.organizationName.trim();
    const planTier: SubscriptionTier = input.planTier ?? 'free';
    const platform: LicensedPlatform = input.platform ?? 'both';

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new LicenseServerError(400, 'INVALID_EMAIL', 'Please enter a valid email address.');
    }
    if (!password || password.length < 6) {
      throw new LicenseServerError(
        400,
        'WEAK_PASSWORD',
        'Password must be at least 6 characters long.',
      );
    }
    if (!fullName) {
      throw new LicenseServerError(400, 'MISSING_NAME', 'Full name is required.');
    }
    if (!organizationName) {
      throw new LicenseServerError(
        400,
        'MISSING_ORGANIZATION',
        'Company or organization name is required.',
      );
    }
    if (!TIER_CODE_MAP[planTier]) {
      throw new LicenseServerError(400, 'INVALID_PLAN', `Unknown plan tier: ${planTier}`);
    }

    const store = readStore();
    let user = store.users.find((u) => u.email === email);

    if (user) {
      if (!verifyPassword(password, user.passwordSalt, user.passwordHash)) {
        throw new LicenseServerError(
          401,
          'ACCOUNT_EXISTS_WRONG_PASSWORD',
          'An account with this email already exists. Enter the matching password or use Sign In.',
        );
      }
    } else {
      const salt = crypto.randomBytes(16).toString('hex');
      user = {
        id: crypto.randomUUID(),
        email,
        fullName,
        organizationName,
        passwordSalt: salt,
        passwordHash: hashPassword(password, salt),
        createdAt: new Date().toISOString(),
      };
      store.users.push(user);
    }

    const licenseId = crypto.randomUUID();
    const issuedAt = new Date().toISOString();
    const expiresAt =
      planTier === 'free'
        ? null
        : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const shortId = licenseId.replace(/-/g, '').slice(0, 8).toUpperCase();
    const sig = signLicensePayload(secret, {
      id: licenseId,
      email,
      planTier,
      issuedAt,
    });
    const licenseKey = `WND-${TIER_CODE_MAP[planTier]}-${shortId}-${sig}`;

    const activatedDevices: ActivatedDeviceRecord[] = [];
    if (input.deviceId?.trim()) {
      activatedDevices.push({
        deviceId: input.deviceId.trim().slice(0, 128),
        deviceName: (input.deviceName || 'Primary Workstation').trim().slice(0, 100),
        platform: input.devicePlatform ?? 'desktop',
        appVersion: (input.appVersion || '1.0.0').trim().slice(0, 32),
        activatedAt: issuedAt,
        lastVerifiedAt: issuedAt,
      });
    }

    const record: StoredLicenseRecord = {
      id: licenseId,
      licenseKey,
      userId: user.id,
      email,
      organizationName,
      planTier,
      platform,
      maxDevices: TIER_MAX_DEVICES[planTier],
      status: 'active',
      issuedAt,
      expiresAt,
      activatedDevices,
      purchasedModules: [],
    };

    store.licenses.unshift(record);
    writeStore(store);

    const activationToken = input.deviceId?.trim()
      ? signActivationToken(secret, {
          licenseId: record.id,
          licenseKey: record.licenseKey,
          deviceId: input.deviceId.trim().slice(0, 128),
          planTier: record.planTier,
          verifiedAt: issuedAt,
        })
      : undefined;

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        organizationName: user.organizationName,
      },
      license: toPublicSummary(record),
      activationToken,
    };
  };

  const loginAndListLicenses = (input: { email: string; password: string }) => {
    const email = input.email.trim().toLowerCase();
    const password = input.password;
    const store = readStore();
    const user = store.users.find((u) => u.email === email);

    if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
      throw new LicenseServerError(
        401,
        'INVALID_CREDENTIALS',
        'Invalid email or password.',
      );
    }

    const licenses = store.licenses
      .filter((l) => l.userId === user.id || l.email === email)
      .map(toPublicSummary);

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        organizationName: user.organizationName,
      },
      licenses,
    };
  };

  const verifyStoredSignature = (record: StoredLicenseRecord): boolean => {
    const expectedSig = signLicensePayload(secret, {
      id: record.id,
      email: record.email,
      planTier: record.planTier,
      issuedAt: record.issuedAt,
    });
    const actualSig = record.licenseKey.split('-').at(-1) ?? '';
    if (actualSig.length !== expectedSig.length) return false;
    return crypto.timingSafeEqual(
      Buffer.from(actualSig, 'utf8'),
      Buffer.from(expectedSig, 'utf8'),
    );
  };

  const activateLicense = (input: {
    licenseKey: string;
    deviceId: string;
    deviceName?: string;
    platform?: 'desktop' | 'android' | 'web';
    appVersion?: string;
  }) => {
    const normalizedKey = input.licenseKey.trim().toUpperCase();
    const deviceId = input.deviceId.trim().slice(0, 128);
    if (!normalizedKey) {
      throw new LicenseServerError(400, 'MISSING_LICENSE_KEY', 'License key is required.');
    }
    if (!deviceId) {
      throw new LicenseServerError(400, 'MISSING_DEVICE_ID', 'Device identifier is required.');
    }

    const store = readStore();
    const record = store.licenses.find((l) => l.licenseKey === normalizedKey);
    if (!record) {
      throw new LicenseServerError(
        404,
        'LICENSE_NOT_FOUND',
        'License key was not found on this license server.',
      );
    }
    if (!verifyStoredSignature(record)) {
      throw new LicenseServerError(
        403,
        'INVALID_LICENSE_SIGNATURE',
        'License key signature verification failed.',
      );
    }
    if (record.status !== 'active') {
      throw new LicenseServerError(
        403,
        'LICENSE_INACTIVE',
        `License status is "${record.status}" and cannot be activated.`,
      );
    }
    if (record.expiresAt && new Date(record.expiresAt).getTime() < Date.now()) {
      record.status = 'expired';
      writeStore(store);
      throw new LicenseServerError(403, 'LICENSE_EXPIRED', 'This license key has expired.');
    }

    const reqPlatform = input.platform ?? 'desktop';
    if (
      record.platform !== 'both' &&
      reqPlatform !== 'web' &&
      record.platform !== reqPlatform
    ) {
      throw new LicenseServerError(
        403,
        'PLATFORM_NOT_LICENSED',
        `This key is issued for ${record.platform} only.`,
      );
    }

    const now = new Date().toISOString();
    const existingDevice = record.activatedDevices.find((d) => d.deviceId === deviceId);
    if (existingDevice) {
      existingDevice.lastVerifiedAt = now;
      if (input.deviceName?.trim()) existingDevice.deviceName = input.deviceName.trim().slice(0, 100);
      if (input.appVersion?.trim()) existingDevice.appVersion = input.appVersion.trim().slice(0, 32);
    } else {
      if (record.activatedDevices.length >= record.maxDevices) {
        throw new LicenseServerError(
          403,
          'ACTIVATION_LIMIT_REACHED',
          `Maximum device activations (${record.maxDevices}) reached for this license key.`,
        );
      }
      record.activatedDevices.push({
        deviceId,
        deviceName: (input.deviceName || 'Authorized Device').trim().slice(0, 100),
        platform: reqPlatform,
        appVersion: (input.appVersion || '1.0.0').trim().slice(0, 32),
        activatedAt: now,
        lastVerifiedAt: now,
      });
    }

    writeStore(store);

    const activationToken = signActivationToken(secret, {
      licenseId: record.id,
      licenseKey: record.licenseKey,
      deviceId,
      planTier: record.planTier,
      verifiedAt: now,
    });

    return {
      valid: true,
      verifiedAt: now,
      activationToken,
      license: toPublicSummary(record),
    };
  };

  const verifyLicense = (input: { licenseKey: string; deviceId?: string }) => {
    const normalizedKey = input.licenseKey.trim().toUpperCase();
    if (!normalizedKey) {
      return { valid: false, code: 'MISSING_LICENSE_KEY', message: 'License key is required.' };
    }

    const store = readStore();
    const record = store.licenses.find((l) => l.licenseKey === normalizedKey);
    if (!record) {
      return {
        valid: false,
        code: 'LICENSE_NOT_FOUND',
        message: 'License key not found on server.',
      };
    }
    if (!verifyStoredSignature(record)) {
      return {
        valid: false,
        code: 'INVALID_LICENSE_SIGNATURE',
        message: 'Cryptographic signature mismatch.',
      };
    }
    if (record.status !== 'active') {
      return {
        valid: false,
        code: 'LICENSE_INACTIVE',
        message: `License is ${record.status}.`,
      };
    }
    if (record.expiresAt && new Date(record.expiresAt).getTime() < Date.now()) {
      return {
        valid: false,
        code: 'LICENSE_EXPIRED',
        message: 'License has expired.',
      };
    }

    const deviceId = input.deviceId?.trim();
    const deviceBound = deviceId
      ? record.activatedDevices.some((d) => d.deviceId === deviceId)
      : true;

    return {
      valid: true,
      deviceBound,
      verifiedAt: new Date().toISOString(),
      license: toPublicSummary(record),
    };
  };

  const purchaseModulesForLicense = (input: {
    licenseKey: string;
    moduleSlugs: string[];
    includeDependencies?: boolean;
    deviceId?: string;
    userType?: UserTypeId;
  }) => {
    const normalizedKey = input.licenseKey.trim().toUpperCase();
    if (!normalizedKey) {
      throw new LicenseServerError(400, 'MISSING_LICENSE_KEY', 'License key is required.');
    }
    if (!Array.isArray(input.moduleSlugs) || input.moduleSlugs.length === 0) {
      throw new LicenseServerError(
        400,
        'NO_MODULES_SELECTED',
        'Select at least one Marketplace module to purchase.',
      );
    }

    const store = readStore();
    const record = store.licenses.find((l) => l.licenseKey === normalizedKey);
    if (!record) {
      throw new LicenseServerError(
        404,
        'LICENSE_NOT_FOUND',
        'License key was not found on this license server.',
      );
    }
    if (!verifyStoredSignature(record)) {
      throw new LicenseServerError(
        403,
        'INVALID_LICENSE_SIGNATURE',
        'License key signature verification failed.',
      );
    }
    if (record.status !== 'active') {
      throw new LicenseServerError(
        403,
        'LICENSE_INACTIVE',
        `License status is "${record.status}" and cannot accept Marketplace add-ons.`,
      );
    }
    if (record.expiresAt && new Date(record.expiresAt).getTime() < Date.now()) {
      record.status = 'expired';
      writeStore(store);
      throw new LicenseServerError(403, 'LICENSE_EXPIRED', 'This license key has expired.');
    }

    const existingPurchased = normalizePurchasedModules(record.purchasedModules);
    const currentEntitled = getEntitledModulesForLicense(record.planTier, existingPurchased);
    const expanded =
      input.includeDependencies === false
        ? normalizePurchasedModules(input.moduleSlugs).filter(
            (slug) => !currentEntitled.includes(slug),
          )
        : expandSelectionWithDependencies(input.moduleSlugs, currentEntitled).resolvedSlugs;

    const nextPurchased = normalizePurchasedModules([...existingPurchased, ...expanded]);
    record.purchasedModules = nextPurchased;
    if (input.userType) {
      record.userType = input.userType;
    }

    writeStore(store);

    const activationToken = signActivationToken(secret, {
      licenseId: record.id,
      licenseKey: record.licenseKey,
      deviceId: (input.deviceId || 'MARKETPLACE-CLIENT').trim().slice(0, 128),
      planTier: record.planTier,
      verifiedAt: new Date().toISOString(),
    });

    return {
      license: toPublicSummary(record),
      activationToken,
      addedModules: expanded,
    };
  };

  const getServerStats = () => {
    const store = readStore();
    const totalDevices = store.licenses.reduce(
      (sum, l) => sum + l.activatedDevices.length,
      0,
    );
    return {
      service: 'wendoro-license-auth-server',
      status: 'ok',
      registeredAccounts: store.users.length,
      issuedLicenses: store.licenses.length,
      activeActivations: totalDevices,
    };
  };

  return {
    registerAndIssueLicense,
    loginAndListLicenses,
    activateLicense,
    verifyLicense,
    purchaseModulesForLicense,
    getServerStats,
  };
}
