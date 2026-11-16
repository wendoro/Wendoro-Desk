import { SubscriptionTier, UserTypeId } from '@/src/core/contracts/tenancy';

export type ClientPlatform = 'desktop' | 'android' | 'web';
export type LicensedPlatform = 'desktop' | 'android' | 'both';

export interface LicenseActivationState {
  licenseKey: string;
  email: string;
  organizationName: string;
  planTier: SubscriptionTier;
  planName: string;
  platform: LicensedPlatform;
  serverUrl: string;
  activationToken?: string;
  verifiedAt: string;
  expiresAt: string | null;
  maxDevices: number;
  usedDevices: number;
  deviceId: string;
  purchasedModules?: string[];
  userType?: UserTypeId;
}

export interface ServerLicenseSummary {
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
  purchasedModules?: string[];
  userType?: UserTypeId;
}

const DEVICE_ID_STORAGE_KEY = 'wendoro.device.id.v1';

export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'WND-DEVICE-SERVER';
  try {
    const existing = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing && existing.length >= 8) return existing;
    const generated =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `dev-${Math.random().toString(36).slice(2, 12)}`;
    window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, generated);
    return generated;
  } catch {
    return 'WND-DEVICE-LOCAL';
  }
}

export function detectClientPlatform(): ClientPlatform {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('android')) return 'android';
  if (ua.includes('electron') || ua.includes('windows') || ua.includes('macintosh') || ua.includes('linux')) {
    return 'desktop';
  }
  return 'web';
}

export function getDefaultDeviceName(): string {
  if (typeof navigator === 'undefined') return 'WENDORO Workstation';
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return 'WENDORO Android Device';
  if (/Windows/i.test(ua)) return 'WENDORO Windows PC';
  if (/Macintosh|Mac OS/i.test(ua)) return 'WENDORO Mac Workstation';
  if (/Linux/i.test(ua)) return 'WENDORO Linux Desktop';
  return 'WENDORO Desktop Client';
}

function normalizeServerBase(serverUrl?: string): string {
  const trimmed = (serverUrl ?? '').trim().replace(/\/+$/, '');
  if (trimmed) return trimmed;
  if (typeof window !== 'undefined' && window.location.origin.startsWith('http')) {
    return window.location.origin;
  }
  return 'http://localhost:3000';
}

async function postLicenseApi<T>(
  serverUrl: string | undefined,
  endpoint: string,
  payload: Record<string, unknown>,
): Promise<T> {
  const base = normalizeServerBase(serverUrl);
  const response = await fetch(`${base}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = (await response.json().catch(() => ({}))) as T & {
    error?: string;
    message?: string;
  };
  if (!response.ok) {
    throw new Error(data.message || data.error || `License server error (${response.status})`);
  }
  return data;
}

export async function registerLicenseWithServer(params: {
  serverUrl?: string;
  email: string;
  password: string;
  fullName: string;
  organizationName: string;
  planTier: SubscriptionTier;
  platform: LicensedPlatform;
}): Promise<{ license: ServerLicenseSummary; activationToken?: string; serverUrl: string }> {
  const serverUrl = normalizeServerBase(params.serverUrl);
  const deviceId = getOrCreateDeviceId();
  const data = await postLicenseApi<{
    ok: boolean;
    license: ServerLicenseSummary;
    activationToken?: string;
  }>(serverUrl, '/api/licenses/register', {
    ...params,
    deviceId,
    deviceName: getDefaultDeviceName(),
    devicePlatform: detectClientPlatform(),
    appVersion: '2.0.0',
  });
  return { ...data, serverUrl };
}

export async function loginLicenseAccount(params: {
  serverUrl?: string;
  email: string;
  password: string;
}): Promise<{
  user: { id: string; email: string; fullName: string; organizationName: string };
  licenses: ServerLicenseSummary[];
  serverUrl: string;
}> {
  const serverUrl = normalizeServerBase(params.serverUrl);
  const data = await postLicenseApi<{
    ok: boolean;
    user: { id: string; email: string; fullName: string; organizationName: string };
    licenses: ServerLicenseSummary[];
  }>(serverUrl, '/api/licenses/login', {
    email: params.email,
    password: params.password,
  });
  return { ...data, serverUrl };
}

export async function activateLicenseKeyWithServer(params: {
  serverUrl?: string;
  licenseKey: string;
  deviceName?: string;
}): Promise<LicenseActivationState> {
  const serverUrl = normalizeServerBase(params.serverUrl);
  const deviceId = getOrCreateDeviceId();
  const data = await postLicenseApi<{
    ok: boolean;
    valid: boolean;
    verifiedAt: string;
    activationToken: string;
    license: ServerLicenseSummary;
  }>(serverUrl, '/api/licenses/activate', {
    licenseKey: params.licenseKey.trim().toUpperCase(),
    deviceId,
    deviceName: params.deviceName || getDefaultDeviceName(),
    platform: detectClientPlatform(),
    appVersion: '2.0.0',
  });

  return {
    licenseKey: data.license.licenseKey,
    email: data.license.email,
    organizationName: data.license.organizationName,
    planTier: data.license.planTier,
    planName: data.license.planName,
    platform: data.license.platform,
    serverUrl,
    activationToken: data.activationToken,
    verifiedAt: data.verifiedAt,
    expiresAt: data.license.expiresAt,
    maxDevices: data.license.maxDevices,
    usedDevices: data.license.usedDevices,
    deviceId,
    purchasedModules: data.license.purchasedModules ?? [],
    userType: data.license.userType,
  };
}

export async function verifyLicenseWithServer(params: {
  serverUrl?: string;
  licenseKey: string;
}): Promise<{
  valid: boolean;
  message?: string;
  verifiedAt?: string;
  license?: ServerLicenseSummary;
}> {
  const base = normalizeServerBase(params.serverUrl);
  const deviceId = getOrCreateDeviceId();
  const response = await fetch(`${base}/api/licenses/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      licenseKey: params.licenseKey.trim().toUpperCase(),
      deviceId,
    }),
  });
  const data = (await response.json().catch(() => ({}))) as {
    valid?: boolean;
    message?: string;
    verifiedAt?: string;
    license?: ServerLicenseSummary;
  };
  return {
    valid: Boolean(data.valid),
    message: data.message,
    verifiedAt: data.verifiedAt,
    license: data.license,
  };
}

export async function purchaseModulesWithServer(params: {
  serverUrl?: string;
  licenseKey: string;
  moduleSlugs: string[];
  includeDependencies?: boolean;
  userType?: UserTypeId;
}): Promise<{
  license: ServerLicenseSummary;
  activationToken: string;
  addedModules: string[];
  serverUrl: string;
}> {
  const serverUrl = normalizeServerBase(params.serverUrl);
  const deviceId = getOrCreateDeviceId();
  const data = await postLicenseApi<{
    ok: boolean;
    license: ServerLicenseSummary;
    activationToken: string;
    addedModules: string[];
  }>(serverUrl, '/api/licenses/purchase-modules', {
    licenseKey: params.licenseKey.trim().toUpperCase(),
    deviceId,
    moduleSlugs: params.moduleSlugs,
    includeDependencies: params.includeDependencies ?? true,
    userType: params.userType,
  });
  return { ...data, serverUrl };
}
