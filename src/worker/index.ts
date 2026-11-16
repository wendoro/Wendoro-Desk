import { WENDORO_LICENSE_PLANS } from '@/src/core/contracts/licensing';
import {
  expandSelectionWithDependencies,
  getEntitledModulesForLicense,
  normalizePurchasedModules,
} from '@/src/core/contracts/marketplace';
import { CompanySyncCheckpoint, SyncPayloadSchema } from '@/src/core/contracts/sync';
import { SubscriptionTier, UserTypeId } from '@/src/core/contracts/tenancy';

export type LicensedPlatform = 'desktop' | 'android' | 'both';

export interface EdgeKvNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

export interface EdgeAssetsFetcher {
  fetch(request: Request | string): Promise<Response>;
}

export interface CloudflareWorkerEnv {
  ASSETS?: EdgeAssetsFetcher;
  LICENSE_KV?: EdgeKvNamespace;
  CONFIG_KV?: EdgeKvNamespace;
  LICENSE_SIGNING_SECRET?: string;
  BETTER_AUTH_SECRET?: string;
  ENVIRONMENT?: string;
}

interface ActivatedDeviceRecord {
  deviceId: string;
  deviceName: string;
  platform: 'desktop' | 'android' | 'web';
  appVersion: string;
  activatedAt: string;
  lastVerifiedAt: string;
}

interface StoredLicenseUser {
  id: string;
  email: string;
  fullName: string;
  organizationName: string;
  passwordSalt: string;
  passwordHash: string;
  createdAt: string;
}

interface StoredLicenseRecord {
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

interface EdgeLicenseStore {
  users: StoredLicenseUser[];
  licenses: StoredLicenseRecord[];
}

interface EdgeSyncLedger {
  checkpoints: Record<string, CompanySyncCheckpoint>;
}

const LICENSE_KV_KEY = 'wendoro:licenses:v1';
const SYNC_KV_KEY = 'wendoro:sync-checkpoints:v1';
const DEFAULT_FALLBACK_SECRET = 'wendoro-cloudflare-edge-default-signing-secret-v1';

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

const encoder = new TextEncoder();

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function randomSaltHex(byteLength = 16): string {
  const buf = new Uint8Array(byteLength);
  crypto.getRandomValues(buf);
  return bytesToHex(buf);
}

async function hashPasswordEdge(password: string, saltHex: string): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(saltHex),
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256,
  );
  return `pbkdf2$${bytesToHex(new Uint8Array(derived))}`;
}

async function verifyPasswordEdge(
  password: string,
  saltHex: string,
  expectedHash: string,
): Promise<boolean> {
  const actual = await hashPasswordEdge(password, saltHex);
  return constantTimeEqual(actual, expectedHash);
}

async function hmacSha256(secret: string, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return new Uint8Array(sig);
}

async function signLicensePayloadEdge(
  secret: string,
  fields: { id: string; email: string; planTier: SubscriptionTier; issuedAt: string },
): Promise<string> {
  const mac = await hmacSha256(
    secret,
    `${fields.id}:${fields.email.toLowerCase()}:${fields.planTier}:${fields.issuedAt}`,
  );
  return bytesToHex(mac).toUpperCase().slice(0, 8);
}

async function signActivationTokenEdge(
  secret: string,
  payload: {
    licenseId: string;
    licenseKey: string;
    deviceId: string;
    planTier: SubscriptionTier;
    verifiedAt: string;
  },
): Promise<string> {
  const body = bytesToBase64Url(encoder.encode(JSON.stringify(payload)));
  const sigBytes = await hmacSha256(secret, body);
  return `${body}.${bytesToBase64Url(sigBytes)}`;
}

function toPublicSummary(record: StoredLicenseRecord) {
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

function resolveKv(env: CloudflareWorkerEnv): EdgeKvNamespace | null {
  return env.LICENSE_KV ?? env.CONFIG_KV ?? null;
}

function resolveSecret(env: CloudflareWorkerEnv): string {
  const candidate = env.LICENSE_SIGNING_SECRET || env.BETTER_AUTH_SECRET;
  if (candidate && candidate.trim().length >= 16 && !candidate.includes('replace-with')) {
    return candidate.trim();
  }
  return DEFAULT_FALLBACK_SECRET;
}

function corsHeaders(extra?: Record<string, string>): Headers {
  const headers = new Headers(extra);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Wendoro-License-Key',
  );
  return headers;
}

function jsonResponse(body: unknown, status = 200): Response {
  const headers = corsHeaders({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  return new Response(JSON.stringify(body), { status, headers });
}

class EdgeApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const parsed = (await request.json()) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function createCloudflareWorkerHandler() {
  // Isolate fallback storage so one-click zero-config deploys work immediately without mandatory KV setup.
  let memoryLicenses: EdgeLicenseStore = { users: [], licenses: [] };
  let memorySync: EdgeSyncLedger = { checkpoints: {} };

  const loadLicenses = async (env: CloudflareWorkerEnv): Promise<EdgeLicenseStore> => {
    const kv = resolveKv(env);
    if (!kv) {
      return memoryLicenses;
    }
    try {
      const raw = await kv.get(LICENSE_KV_KEY);
      if (!raw) return { users: [], licenses: [] };
      const parsed = JSON.parse(raw) as Partial<EdgeLicenseStore>;
      return {
        users: Array.isArray(parsed.users) ? parsed.users : [],
        licenses: Array.isArray(parsed.licenses) ? parsed.licenses : [],
      };
    } catch {
      return { users: [], licenses: [] };
    }
  };

  const saveLicenses = async (
    env: CloudflareWorkerEnv,
    store: EdgeLicenseStore,
  ): Promise<void> => {
    memoryLicenses = store;
    const kv = resolveKv(env);
    if (kv) {
      await kv.put(LICENSE_KV_KEY, JSON.stringify(store));
    }
  };

  const loadSyncLedger = async (env: CloudflareWorkerEnv): Promise<EdgeSyncLedger> => {
    const kv = resolveKv(env);
    if (!kv) {
      return memorySync;
    }
    try {
      const raw = await kv.get(SYNC_KV_KEY);
      if (!raw) return { checkpoints: {} };
      const parsed = JSON.parse(raw) as Partial<EdgeSyncLedger>;
      return {
        checkpoints:
          parsed.checkpoints && typeof parsed.checkpoints === 'object'
            ? parsed.checkpoints
            : {},
      };
    } catch {
      return { checkpoints: {} };
    }
  };

  const saveSyncLedger = async (
    env: CloudflareWorkerEnv,
    ledger: EdgeSyncLedger,
  ): Promise<void> => {
    memorySync = ledger;
    const kv = resolveKv(env);
    if (kv) {
      await kv.put(SYNC_KV_KEY, JSON.stringify(ledger));
    }
  };

  const verifyStoredSignature = async (
    secret: string,
    record: StoredLicenseRecord,
  ): Promise<boolean> => {
    const expected = await signLicensePayloadEdge(secret, {
      id: record.id,
      email: record.email,
      planTier: record.planTier,
      issuedAt: record.issuedAt,
    });
    const actual = record.licenseKey.split('-').at(-1) ?? '';
    return constantTimeEqual(actual, expected);
  };

  return {
    async fetch(request: Request, env: CloudflareWorkerEnv = {}): Promise<Response> {
      const url = new URL(request.url);
      const pathname = url.pathname;

      if (pathname.startsWith('/api/')) {
        if (request.method === 'OPTIONS') {
          return new Response(null, { status: 204, headers: corsHeaders() });
        }

        const secret = resolveSecret(env);
        const kvBound = Boolean(resolveKv(env));

        if (request.method === 'GET' && pathname === '/api/health') {
          return jsonResponse({
            status: 'ok',
            service: 'wendoro-license-server',
            runtime: 'cloudflare-workers',
            kvPersisted: kvBound,
            timestamp: new Date().toISOString(),
          });
        }

        if (request.method === 'GET' && pathname === '/api/setup/status') {
          const store = await loadLicenses(env);
          const activeActivations = store.licenses.reduce(
            (sum, l) => sum + l.activatedDevices.length,
            0,
          );
          return jsonResponse({
            runtime: 'cloudflare-workers',
            licenseServerReady: true,
            kvPersisted: kvBound,
            registeredAccounts: store.users.length,
            issuedLicenses: store.licenses.length,
            activeActivations,
            databaseConfigured: kvBound,
            authSecretConfigured: Boolean(env.LICENSE_SIGNING_SECRET || env.BETTER_AUTH_SECRET),
            betterAuthReady: false,
            timestamp: new Date().toISOString(),
          });
        }

        if (request.method === 'GET' && pathname === '/api/licenses/status') {
          const store = await loadLicenses(env);
          const activeActivations = store.licenses.reduce(
            (sum, l) => sum + l.activatedDevices.length,
            0,
          );
          return jsonResponse({
            service: 'wendoro-license-auth-server',
            status: 'ok',
            runtime: 'cloudflare-workers',
            kvPersisted: kvBound,
            registeredAccounts: store.users.length,
            issuedLicenses: store.licenses.length,
            activeActivations,
            timestamp: new Date().toISOString(),
          });
        }

        if (request.method === 'POST' && pathname === '/api/licenses/register') {
          try {
            const body = await readJsonBody(request);
            const email = String(body.email ?? '').trim().toLowerCase();
            const password = String(body.password ?? '');
            const fullName = String(body.fullName ?? '').trim();
            const organizationName = String(body.organizationName ?? '').trim();
            const planTier = (String(body.planTier ?? 'free') || 'free') as SubscriptionTier;
            const platform = (String(body.platform ?? 'both') || 'both') as LicensedPlatform;
            const deviceId = body.deviceId ? String(body.deviceId).trim() : '';

            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
              throw new EdgeApiError(400, 'INVALID_EMAIL', 'Please enter a valid email address.');
            }
            if (!password || password.length < 6) {
              throw new EdgeApiError(
                400,
                'WEAK_PASSWORD',
                'Password must be at least 6 characters long.',
              );
            }
            if (!fullName) {
              throw new EdgeApiError(400, 'MISSING_NAME', 'Full name is required.');
            }
            if (!organizationName) {
              throw new EdgeApiError(
                400,
                'MISSING_ORGANIZATION',
                'Company or organization name is required.',
              );
            }
            if (!TIER_CODE_MAP[planTier]) {
              throw new EdgeApiError(400, 'INVALID_PLAN', `Unknown plan tier: ${planTier}`);
            }

            const store = await loadLicenses(env);
            let user = store.users.find((u) => u.email === email);
            if (user) {
              const ok = await verifyPasswordEdge(password, user.passwordSalt, user.passwordHash);
              if (!ok) {
                throw new EdgeApiError(
                  401,
                  'ACCOUNT_EXISTS_WRONG_PASSWORD',
                  'An account with this email already exists. Enter the matching password or use Sign In.',
                );
              }
            } else {
              const salt = randomSaltHex(16);
              user = {
                id: crypto.randomUUID(),
                email,
                fullName,
                organizationName,
                passwordSalt: salt,
                passwordHash: await hashPasswordEdge(password, salt),
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
            const sig = await signLicensePayloadEdge(secret, {
              id: licenseId,
              email,
              planTier,
              issuedAt,
            });
            const licenseKey = `WND-${TIER_CODE_MAP[planTier]}-${shortId}-${sig}`;

            const activatedDevices: ActivatedDeviceRecord[] = [];
            if (deviceId) {
              activatedDevices.push({
                deviceId: deviceId.slice(0, 128),
                deviceName: String(body.deviceName || 'Primary Workstation')
                  .trim()
                  .slice(0, 100),
                platform: (body.devicePlatform as 'desktop' | 'android' | 'web') ?? 'desktop',
                appVersion: String(body.appVersion || '2.0.0').trim().slice(0, 32),
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
            await saveLicenses(env, store);

            const activationToken = deviceId
              ? await signActivationTokenEdge(secret, {
                  licenseId: record.id,
                  licenseKey: record.licenseKey,
                  deviceId: deviceId.slice(0, 128),
                  planTier: record.planTier,
                  verifiedAt: issuedAt,
                })
              : undefined;

            return jsonResponse(
              {
                ok: true,
                user: {
                  id: user.id,
                  email: user.email,
                  fullName: user.fullName,
                  organizationName: user.organizationName,
                },
                license: toPublicSummary(record),
                activationToken,
              },
              201,
            );
          } catch (err) {
            if (err instanceof EdgeApiError) {
              return jsonResponse({ error: err.code, message: err.message }, err.statusCode);
            }
            return jsonResponse(
              {
                error: 'LICENSE_REGISTRATION_FAILED',
                message: 'Unable to register license account.',
              },
              500,
            );
          }
        }

        if (request.method === 'POST' && pathname === '/api/licenses/login') {
          try {
            const body = await readJsonBody(request);
            const email = String(body.email ?? '').trim().toLowerCase();
            const password = String(body.password ?? '');
            const store = await loadLicenses(env);
            const user = store.users.find((u) => u.email === email);

            if (
              !user ||
              !(await verifyPasswordEdge(password, user.passwordSalt, user.passwordHash))
            ) {
              throw new EdgeApiError(
                401,
                'INVALID_CREDENTIALS',
                'Invalid email or password.',
              );
            }

            const licenses = store.licenses
              .filter((l) => l.userId === user.id || l.email === email)
              .map(toPublicSummary);

            return jsonResponse({
              ok: true,
              user: {
                id: user.id,
                email: user.email,
                fullName: user.fullName,
                organizationName: user.organizationName,
              },
              licenses,
            });
          } catch (err) {
            if (err instanceof EdgeApiError) {
              return jsonResponse({ error: err.code, message: err.message }, err.statusCode);
            }
            return jsonResponse(
              {
                error: 'LICENSE_LOGIN_FAILED',
                message: 'Unable to authenticate license account.',
              },
              500,
            );
          }
        }

        if (request.method === 'POST' && pathname === '/api/licenses/activate') {
          try {
            const body = await readJsonBody(request);
            const normalizedKey = String(body.licenseKey ?? '').trim().toUpperCase();
            const deviceId = String(body.deviceId ?? '').trim().slice(0, 128);
            if (!normalizedKey) {
              throw new EdgeApiError(400, 'MISSING_LICENSE_KEY', 'License key is required.');
            }
            if (!deviceId) {
              throw new EdgeApiError(400, 'MISSING_DEVICE_ID', 'Device identifier is required.');
            }

            const store = await loadLicenses(env);
            const record = store.licenses.find((l) => l.licenseKey === normalizedKey);
            if (!record) {
              throw new EdgeApiError(
                404,
                'LICENSE_NOT_FOUND',
                'License key was not found on this license server.',
              );
            }
            if (!(await verifyStoredSignature(secret, record))) {
              throw new EdgeApiError(
                403,
                'INVALID_LICENSE_SIGNATURE',
                'License key signature verification failed.',
              );
            }
            if (record.status !== 'active') {
              throw new EdgeApiError(
                403,
                'LICENSE_INACTIVE',
                `License status is "${record.status}" and cannot be activated.`,
              );
            }
            if (record.expiresAt && new Date(record.expiresAt).getTime() < Date.now()) {
              record.status = 'expired';
              await saveLicenses(env, store);
              throw new EdgeApiError(403, 'LICENSE_EXPIRED', 'This license key has expired.');
            }

            const reqPlatform =
              (body.platform as 'desktop' | 'android' | 'web') ?? 'desktop';
            if (
              record.platform !== 'both' &&
              reqPlatform !== 'web' &&
              record.platform !== reqPlatform
            ) {
              throw new EdgeApiError(
                403,
                'PLATFORM_NOT_LICENSED',
                `This key is issued for ${record.platform} only.`,
              );
            }

            const now = new Date().toISOString();
            const existingDevice = record.activatedDevices.find((d) => d.deviceId === deviceId);
            if (existingDevice) {
              existingDevice.lastVerifiedAt = now;
              if (body.deviceName && String(body.deviceName).trim()) {
                existingDevice.deviceName = String(body.deviceName).trim().slice(0, 100);
              }
              if (body.appVersion && String(body.appVersion).trim()) {
                existingDevice.appVersion = String(body.appVersion).trim().slice(0, 32);
              }
            } else {
              if (record.activatedDevices.length >= record.maxDevices) {
                throw new EdgeApiError(
                  403,
                  'ACTIVATION_LIMIT_REACHED',
                  `Maximum device activations (${record.maxDevices}) reached for this license key.`,
                );
              }
              record.activatedDevices.push({
                deviceId,
                deviceName: String(body.deviceName || 'Authorized Device').trim().slice(0, 100),
                platform: reqPlatform,
                appVersion: String(body.appVersion || '2.0.0').trim().slice(0, 32),
                activatedAt: now,
                lastVerifiedAt: now,
              });
            }

            await saveLicenses(env, store);

            const activationToken = await signActivationTokenEdge(secret, {
              licenseId: record.id,
              licenseKey: record.licenseKey,
              deviceId,
              planTier: record.planTier,
              verifiedAt: now,
            });

            return jsonResponse({
              ok: true,
              valid: true,
              verifiedAt: now,
              activationToken,
              license: toPublicSummary(record),
            });
          } catch (err) {
            if (err instanceof EdgeApiError) {
              return jsonResponse({ error: err.code, message: err.message }, err.statusCode);
            }
            return jsonResponse(
              {
                error: 'LICENSE_ACTIVATION_FAILED',
                message: 'Unable to activate license key.',
              },
              500,
            );
          }
        }

        if (request.method === 'POST' && pathname === '/api/licenses/verify') {
          const body = await readJsonBody(request);
          const normalizedKey = String(body.licenseKey ?? '').trim().toUpperCase();
          if (!normalizedKey) {
            return jsonResponse(
              { valid: false, code: 'MISSING_LICENSE_KEY', message: 'License key is required.' },
              404,
            );
          }

          const store = await loadLicenses(env);
          const record = store.licenses.find((l) => l.licenseKey === normalizedKey);
          if (!record) {
            return jsonResponse(
              {
                valid: false,
                code: 'LICENSE_NOT_FOUND',
                message: 'License key not found on server.',
              },
              404,
            );
          }
          if (!(await verifyStoredSignature(secret, record))) {
            return jsonResponse(
              {
                valid: false,
                code: 'INVALID_LICENSE_SIGNATURE',
                message: 'Cryptographic signature mismatch.',
              },
              404,
            );
          }
          if (record.status !== 'active') {
            return jsonResponse(
              { valid: false, code: 'LICENSE_INACTIVE', message: `License is ${record.status}.` },
              404,
            );
          }
          if (record.expiresAt && new Date(record.expiresAt).getTime() < Date.now()) {
            return jsonResponse(
              { valid: false, code: 'LICENSE_EXPIRED', message: 'License has expired.' },
              404,
            );
          }

          const deviceId = body.deviceId ? String(body.deviceId).trim() : '';
          const deviceBound = deviceId
            ? record.activatedDevices.some((d) => d.deviceId === deviceId)
            : true;

          return jsonResponse({
            valid: true,
            deviceBound,
            verifiedAt: new Date().toISOString(),
            license: toPublicSummary(record),
          });
        }

        if (request.method === 'POST' && pathname === '/api/licenses/purchase-modules') {
          try {
            const body = await readJsonBody(request);
            const normalizedKey = String(body.licenseKey ?? '').trim().toUpperCase();
            const moduleSlugs = Array.isArray(body.moduleSlugs)
              ? body.moduleSlugs.map((item) => String(item))
              : [];
            if (!normalizedKey) {
              throw new EdgeApiError(400, 'MISSING_LICENSE_KEY', 'License key is required.');
            }
            if (moduleSlugs.length === 0) {
              throw new EdgeApiError(
                400,
                'NO_MODULES_SELECTED',
                'Select at least one Marketplace module to purchase.',
              );
            }

            const store = await loadLicenses(env);
            const record = store.licenses.find((l) => l.licenseKey === normalizedKey);
            if (!record) {
              throw new EdgeApiError(
                404,
                'LICENSE_NOT_FOUND',
                'License key was not found on this license server.',
              );
            }
            if (!(await verifyStoredSignature(secret, record))) {
              throw new EdgeApiError(
                403,
                'INVALID_LICENSE_SIGNATURE',
                'License key signature verification failed.',
              );
            }
            if (record.status !== 'active') {
              throw new EdgeApiError(
                403,
                'LICENSE_INACTIVE',
                `License status is "${record.status}" and cannot accept Marketplace add-ons.`,
              );
            }
            if (record.expiresAt && new Date(record.expiresAt).getTime() < Date.now()) {
              record.status = 'expired';
              await saveLicenses(env, store);
              throw new EdgeApiError(403, 'LICENSE_EXPIRED', 'This license key has expired.');
            }

            const existingPurchased = normalizePurchasedModules(record.purchasedModules);
            const currentEntitled = getEntitledModulesForLicense(
              record.planTier,
              existingPurchased,
            );
            const includeDependencies = body.includeDependencies !== false;
            const expanded = includeDependencies
              ? expandSelectionWithDependencies(moduleSlugs, currentEntitled).resolvedSlugs
              : normalizePurchasedModules(moduleSlugs).filter(
                  (slug) => !currentEntitled.includes(slug),
                );

            record.purchasedModules = normalizePurchasedModules([
              ...existingPurchased,
              ...expanded,
            ]);
            if (body.userType) {
              record.userType = String(body.userType) as UserTypeId;
            }
            await saveLicenses(env, store);

            const activationToken = await signActivationTokenEdge(secret, {
              licenseId: record.id,
              licenseKey: record.licenseKey,
              deviceId: String(body.deviceId || 'MARKETPLACE-CLIENT').trim().slice(0, 128),
              planTier: record.planTier,
              verifiedAt: new Date().toISOString(),
            });

            return jsonResponse({
              ok: true,
              license: toPublicSummary(record),
              activationToken,
              addedModules: expanded,
            });
          } catch (err) {
            if (err instanceof EdgeApiError) {
              return jsonResponse({ error: err.code, message: err.message }, err.statusCode);
            }
            return jsonResponse(
              {
                error: 'MARKETPLACE_PURCHASE_FAILED',
                message: 'Unable to record Marketplace module purchase.',
              },
              500,
            );
          }
        }

        const syncStatusMatch = pathname.match(/^\/api\/erp\/([^/]+)\/sync\/status$/);
        if (request.method === 'GET' && syncStatusMatch) {
          const companyId = decodeURIComponent(syncStatusMatch[1] || '').trim();
          if (!companyId) {
            return jsonResponse(
              { error: 'INVALID_COMPANY', message: 'Company ID is required.' },
              400,
            );
          }
          const ledger = await loadSyncLedger(env);
          const cp = ledger.checkpoints[companyId];
          let checkpoint: Omit<CompanySyncCheckpoint, 'stateSnapshotJson'> | null = null;
          if (cp) {
            const { stateSnapshotJson: _omit, ...meta } = cp;
            checkpoint = meta;
          }
          return jsonResponse({
            ok: true,
            companyId,
            checkpoint,
          });
        }

        const syncPostMatch = pathname.match(/^\/api\/erp\/([^/]+)\/sync$/);
        if (request.method === 'POST' && syncPostMatch) {
          const paramCompanyId = decodeURIComponent(syncPostMatch[1] || '').trim();
          const body = await readJsonBody(request);
          const parsed = SyncPayloadSchema.safeParse(body);
          if (!parsed.success) {
            return jsonResponse(
              {
                error: 'INVALID_SYNC_PAYLOAD',
                message: 'Offline sync payload failed validation.',
              },
              400,
            );
          }
          if (parsed.data.companyId !== paramCompanyId) {
            return jsonResponse(
              {
                error: 'COMPANY_MISMATCH',
                message: 'Sync payload companyId does not match route parameter.',
              },
              400,
            );
          }

          const licenseKey = request.headers.get('x-wendoro-license-key')?.trim() || null;
          if (licenseKey) {
            const store = await loadLicenses(env);
            const record = store.licenses.find(
              (l) => l.licenseKey === licenseKey.toUpperCase(),
            );
            if (
              !record ||
              !(await verifyStoredSignature(secret, record)) ||
              record.status !== 'active'
            ) {
              return jsonResponse(
                {
                  error: 'LICENSE_NOT_ACTIVE',
                  message: 'Active software license required for remote synchronization.',
                },
                403,
              );
            }
          }

          const serverTimestamp = new Date().toISOString();
          const licenseKeyHint =
            licenseKey && licenseKey.length > 10
              ? `${licenseKey.slice(0, 9)}...${licenseKey.slice(-4)}`
              : null;

          const ledger = await loadSyncLedger(env);
          ledger.checkpoints[parsed.data.companyId] = {
            companyId: parsed.data.companyId,
            lastOutboxId: parsed.data.outboxId,
            checksum: parsed.data.checksum,
            recordCount: parsed.data.recordCount,
            changeSummary: parsed.data.changeSummary,
            licenseKeyHint,
            syncedAt: serverTimestamp,
            stateSnapshotJson: parsed.data.stateSnapshotJson,
          };
          await saveSyncLedger(env, ledger);

          return jsonResponse({
            ok: true,
            companyId: parsed.data.companyId,
            outboxId: parsed.data.outboxId,
            checksum: parsed.data.checksum,
            recordCount: parsed.data.recordCount,
            serverTimestamp,
          });
        }

        return jsonResponse(
          {
            error: 'API_ROUTE_NOT_AVAILABLE',
            message:
              'This endpoint requires a PostgreSQL/Node server runtime or is not implemented at the edge.',
          },
          404,
        );
      }

      if (env.ASSETS) {
        return env.ASSETS.fetch(request);
      }

      return new Response('WENDORO ERP Static Assets binding is not configured.', {
        status: 404,
      });
    },
  };
}

export default createCloudflareWorkerHandler();
