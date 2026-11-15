import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Database,
  KeyRound,
  Laptop,
  Lock,
  LogIn,
  LogOut,
  Moon,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Sun,
  Unlock,
  UserPlus,
} from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { Surface } from '@/src/components/ui/Surface';
import { useFirebase } from '@/src/components/shell/FirebaseProvider';
import { useTenant } from '@/src/components/shell/TenantProvider';
import { useTheme } from '@/src/components/shell/ThemeProvider';
import { WENDORO_LICENSE_PLANS } from '@/src/core/contracts/licensing';
import { SubscriptionTier } from '@/src/core/contracts/tenancy';
import {
  LicenseActivationState,
  LicensedPlatform,
  ServerLicenseSummary,
  activateLicenseKeyWithServer,
  detectClientPlatform,
  getDefaultDeviceName,
  getOrCreateDeviceId,
  loginLicenseAccount,
  registerLicenseWithServer,
} from '@/src/core/engine/licenseClient';
import {
  listUserLicensesInFirebase,
  registerLicenseInFirebase,
  validateLicenseKeyFormat,
  verifyAndActivateLicenseInFirebase,
} from '@/src/lib/firebaseLicense';
import { formatNumericCurrency } from '@/src/lib/utils';

export function LicenseGate({
  verifyingStartup,
  startupError,
}: {
  verifyingStartup?: boolean;
  startupError?: string | null;
}) {
  const { theme, toggleTheme } = useTheme();
  const {
    user,
    authReady,
    isConfigured: isFirebaseConfigured,
    connectionState,
    projectId,
    authError,
    signInWithGoogle,
    signOutUser,
  } = useFirebase();
  const { setLicenseActivation, activeCompany, licenseKey } = useTenant();

  const [tab, setTab] = useState<'activate' | 'register' | 'keys'>('activate');
  const [backendMode, setBackendMode] = useState<'firebase' | 'server'>(
    isFirebaseConfigured ? 'firebase' : 'server',
  );

  // Inputs
  const [keyInput, setKeyInput] = useState<string>(licenseKey ?? '');
  const [orgName, setOrgName] = useState<string>(
    activeCompany.companyName !== 'My Organization' ? activeCompany.companyName : '',
  );
  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>('free');
  const [licensedPlatform, setLicensedPlatform] = useState<LicensedPlatform>('both');
  const [serverUrl, setServerUrl] = useState<string>(
    typeof window !== 'undefined' && window.location.origin.startsWith('http')
      ? window.location.origin
      : 'http://localhost:3000',
  );

  // State
  const [myKeys, setMyKeys] = useState<ServerLicenseSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(startupError ?? null);
  const [noticeMsg, setNoticeMsg] = useState<string | null>(null);

  const deviceId = useMemo(() => getOrCreateDeviceId(), []);
  const devicePlatform = useMemo(() => detectClientPlatform(), []);
  const deviceName = useMemo(() => getDefaultDeviceName(), []);

  const isBootstrapAdmin = user?.email?.toLowerCase() === 'wendoro.dev@gmail.com';
  const firebaseReadyForSession = isFirebaseConfigured && authReady && Boolean(user?.emailVerified);

  useEffect(() => {
    if (startupError) setErrorMsg(startupError);
  }, [startupError]);

  useEffect(() => {
    if (isFirebaseConfigured) {
      setBackendMode('firebase');
    }
  }, [isFirebaseConfigured]);

  const handleLoadFirebaseKeys = async () => {
    setErrorMsg(null);
    setNoticeMsg(null);
    setLoading(true);
    try {
      const list = await listUserLicensesInFirebase();
      setMyKeys(list);
      setNoticeMsg(
        list.length > 0
          ? `Loaded ${list.length} registered license ${list.length === 1 ? 'key' : 'keys'} from Firebase.`
          : 'No license keys found in Firebase for this account yet. Register one to unlock.',
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to fetch keys from Firebase.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'keys' && backendMode === 'firebase' && firebaseReadyForSession) {
      void handleLoadFirebaseKeys();
    }
  }, [tab, backendMode, firebaseReadyForSession]);

  const handleActivateSubmit = async (e?: React.FormEvent, overrideKey?: string) => {
    if (e) e.preventDefault();
    setErrorMsg(null);
    setNoticeMsg(null);

    const targetKey = (overrideKey ?? keyInput).trim().toUpperCase();
    const fmt = validateLicenseKeyFormat(targetKey);
    if (!fmt.valid) {
      setErrorMsg(fmt.error || 'Enter a valid WENDORO license key.');
      return;
    }

    setLoading(true);
    try {
      let activation: LicenseActivationState;
      if (backendMode === 'firebase' && isFirebaseConfigured) {
        activation = await verifyAndActivateLicenseInFirebase({
          licenseKey: fmt.normalized,
          deviceId,
          deviceName,
        });
      } else {
        activation = await activateLicenseKeyWithServer({
          serverUrl,
          licenseKey: fmt.normalized,
          deviceName,
        });
      }
      setNoticeMsg(`License ${activation.licenseKey} verified. Unlocking WENDORO...`);
      setLicenseActivation(activation);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to verify registration key.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterAndUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setNoticeMsg(null);
    setLoading(true);

    try {
      let activation: LicenseActivationState;
      if (backendMode === 'firebase' && isFirebaseConfigured) {
        activation = await registerLicenseInFirebase({
          organizationName: orgName.trim() || 'My Organization',
          planTier: isBootstrapAdmin ? selectedTier : 'free',
          platform: licensedPlatform,
          deviceId,
          deviceName,
        });
      } else {
        const reg = await registerLicenseWithServer({
          serverUrl,
          email,
          password,
          fullName,
          organizationName: orgName.trim() || 'My Organization',
          planTier: selectedTier,
          platform: licensedPlatform,
        });
        activation = await activateLicenseKeyWithServer({
          serverUrl: reg.serverUrl,
          licenseKey: reg.license.licenseKey,
          deviceName,
        });
      }
      setKeyInput(activation.licenseKey);
      setNoticeMsg(`Issued & activated ${activation.licenseKey}. Launching application...`);
      setLicenseActivation(activation);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to register license key.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleServerLoginKeys = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setNoticeMsg(null);
    setLoading(true);
    try {
      const res = await loginLicenseAccount({ serverUrl, email, password });
      setMyKeys(res.licenses);
      setNoticeMsg(
        res.licenses.length > 0
          ? `Authenticated ${res.user.email}. Choose a key below to unlock.`
          : 'No license keys issued for this account yet.',
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  if (verifyingStartup) {
    return (
      <div className="min-h-screen bg-[#FAF9F7] dark:bg-[#141013] flex items-center justify-center p-6">
        <Surface padding="lg" className="w-full max-w-md text-center space-y-4">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-[#DC2626] text-white flex items-center justify-center relative">
            <ShieldCheck className="h-6 w-6" />
            <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-[#FACC15]" />
          </div>
          <div className="space-y-1">
            <h1 className="text-lg font-bold text-[#1C1917] dark:text-stone-100">
              Verifying WENDORO Software License
            </h1>
            <p className="text-xs text-[#57534E] dark:text-stone-400">
              Validating registration key signature and device seat entitlement before unlocking modules...
            </p>
          </div>
          <div className="inline-flex items-center gap-2 text-xs font-mono text-[#DC2626] dark:text-[#FACC15]">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            Checking {isFirebaseConfigured ? 'Firebase Firestore' : 'License Auth Server'}
          </div>
        </Surface>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF9F7] dark:bg-[#141013] text-[#1C1917] dark:text-stone-100 flex flex-col">
      {/* Native App Window Header Bar */}
      <header className="h-14 shrink-0 bg-[#181214] text-stone-100 border-b border-[#32242A] px-4 lg:px-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-[#DC2626] flex items-center justify-center font-display font-bold text-sm text-white relative shrink-0">
            W
            <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[#FACC15] border border-[#181214]" />
          </div>
          <div className="min-w-0">
            <div className="font-display text-sm font-bold tracking-tight truncate">
              WENDORO Enterprise Software
            </div>
            <div className="text-[11px] text-stone-400 flex items-center gap-1.5">
              <Lock className="h-3 w-3 text-[#FACC15]" />
              <span>License Activation Gate</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#251B20] border border-[#3A2B31] text-[11px] font-mono">
            <span
              className={`h-2 w-2 rounded-full ${
                isFirebaseConfigured && connectionState === 'connected'
                  ? 'bg-emerald-400'
                  : 'bg-[#FACC15]'
              }`}
            />
            <span>
              {isFirebaseConfigured ? `Firebase: ${connectionState}` : 'License Server Ready'}
            </span>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-[#32242A] bg-[#1B1417] text-stone-200 hover:bg-[#251B20] cursor-pointer"
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4 text-[#FACC15]" />
            ) : (
              <Moon className="h-4 w-4 text-white" />
            )}
          </button>
        </div>
      </header>

      {/* Main Activation Gate Layout */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-8 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Security & Device Identity Card */}
        <div className="lg:col-span-5 space-y-4">
          <Surface padding="lg" className="space-y-5">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-[#DC2626] text-white flex items-center justify-center shrink-0">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-[#1C1917] dark:text-stone-100">
                  Activate License to Unlock
                </h1>
                <p className="text-xs text-[#57534E] dark:text-stone-400 mt-1 leading-relaxed">
                  All ERP modules, POS, General Ledger, Inventory & Reports stay locked until a valid registration key is verified.
                </p>
              </div>
            </div>

            {/* Bound Device Identity */}
            <div className="p-3.5 rounded-xl bg-[#FAF9F7] dark:bg-[#141013] border border-stone-200 dark:border-[#32242A] space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#57534E] dark:text-stone-400 flex items-center gap-1.5">
                  {devicePlatform === 'android' ? (
                    <Smartphone className="h-3.5 w-3.5 text-[#F59E0B]" />
                  ) : (
                    <Laptop className="h-3.5 w-3.5 text-[#DC2626]" />
                  )}
                  Client Environment
                </span>
                <span className="font-semibold capitalize">{devicePlatform} Native</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#57534E] dark:text-stone-400">Device Name</span>
                <span className="font-medium truncate max-w-[180px]">{deviceName}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#57534E] dark:text-stone-400 shrink-0">Hardware ID</span>
                <code className="font-mono text-[11px] text-[#DC2626] dark:text-[#FACC15] truncate">
                  {deviceId}
                </code>
              </div>
            </div>

            {/* Verification Authority Selector */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-[#1C1917] dark:text-stone-200">
                Verification Authority
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setBackendMode('firebase')}
                  className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                    backendMode === 'firebase'
                      ? 'border-[#DC2626] bg-[#DC2626]/5 dark:bg-[#DC2626]/15 ring-1 ring-[#DC2626]/30'
                      : 'border-stone-200 dark:border-[#32242A] bg-white dark:bg-[#141013]'
                  }`}
                >
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <Database className="h-3.5 w-3.5 text-[#DC2626] dark:text-[#FACC15]" />
                    Firebase Cloud
                  </div>
                  <div className="text-[11px] text-[#57534E] dark:text-stone-400 mt-0.5">
                    {isFirebaseConfigured ? connectionState : 'Config Pending'}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setBackendMode('server')}
                  className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                    backendMode === 'server'
                      ? 'border-[#F59E0B] bg-amber-50 dark:bg-amber-950/30 ring-1 ring-[#F59E0B]/40'
                      : 'border-stone-200 dark:border-[#32242A] bg-white dark:bg-[#141013]'
                  }`}
                >
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-[#D97706] dark:text-[#FACC15]" />
                    License Server
                  </div>
                  <div className="text-[11px] text-[#57534E] dark:text-stone-400 mt-0.5">
                    Express API Active
                  </div>
                </button>
              </div>
            </div>

            {/* Firebase Auth Box when Firebase Mode selected */}
            {backendMode === 'firebase' && (
              <div className="p-3.5 rounded-xl border border-stone-200 dark:border-[#32242A] bg-[#FAF9F7] dark:bg-[#141013] space-y-2.5">
                {!isFirebaseConfigured ? (
                  <div className="space-y-2 text-xs">
                    <div className="flex items-start gap-2 text-[#B45309] dark:text-[#FACC15] font-medium">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>
                        Firebase runtime config (<code className="font-mono">firebase-applet-config.json</code> or{' '}
                        <code className="font-mono">VITE_FIREBASE_*</code>) is not attached yet.
                      </span>
                    </div>
                    <p className="text-[11px] text-[#57534E] dark:text-stone-400 leading-relaxed">
                      Firestore rules & schemas are ready for <code className="font-mono">/licenses/&#123;key&#125;</code>. You can switch to <strong>License Server</strong> mode to register & unlock immediately, or provide Firebase config.
                    </p>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setBackendMode('server')}
                    >
                      Use License Auth Server Now
                    </Button>
                  </div>
                ) : user ? (
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{user.displayName || user.email}</div>
                      <div className="text-[11px] text-[#57534E] dark:text-stone-400 truncate">
                        Firebase UID Verified · {projectId}
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => void signOutUser()}>
                      <LogOut className="h-3.5 w-3.5" />
                      Sign Out
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="text-xs font-medium">
                      Sign in with Google to validate keys on Firebase ({projectId})
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => void signInWithGoogle()}
                    >
                      <LogIn className="h-3.5 w-3.5" />
                      Sign In with Google
                    </Button>
                    {authError && (
                      <div className="text-[11px] text-red-600 dark:text-red-400">{authError}</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </Surface>
        </div>

        {/* Right Column: Registration, Verification & Unlock Tabs */}
        <div className="lg:col-span-7 space-y-4">
          <Surface padding="lg" className="space-y-5">
            {/* Tabs */}
            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-stone-100 dark:bg-[#141013] border border-stone-200 dark:border-[#32242A]">
              {(
                [
                  { id: 'activate', label: 'Activate Key', icon: Unlock },
                  { id: 'register', label: 'Register & Get Key', icon: UserPlus },
                  { id: 'keys', label: 'My Keys', icon: KeyRound },
                ] as const
              ).map((item) => {
                const Icon = item.icon;
                const active = tab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setTab(item.id);
                      setErrorMsg(null);
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-[#DC2626] text-white'
                        : 'text-[#57534E] dark:text-stone-300 hover:text-[#1C1917] dark:hover:text-white'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </button>
                );
              })}
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="p-3 rounded-xl border border-red-300 bg-red-50 dark:border-red-900/60 dark:bg-red-950/40 text-xs font-medium text-red-700 dark:text-red-300"
              >
                {errorMsg}
              </div>
            )}

            {noticeMsg && (
              <div className="p-3 rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-700/50 dark:bg-amber-950/30 text-xs font-medium text-[#92400E] dark:text-[#FDE047] flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#DC2626] dark:text-[#FACC15]" />
                <span>{noticeMsg}</span>
              </div>
            )}

            {backendMode === 'server' && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-2.5 rounded-lg bg-[#FAF9F7] dark:bg-[#141013] border border-stone-200 dark:border-[#32242A]">
                <label className="text-[11px] font-medium text-[#57534E] dark:text-stone-400 shrink-0">
                  License Auth Server URL:
                </label>
                <input
                  type="url"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  className="flex-1 h-8 px-2.5 rounded-md text-xs font-mono bg-white dark:bg-[#1B1417] border border-stone-200 dark:border-[#32242A]"
                />
              </div>
            )}

            {/* TAB 1: ACTIVATE KEY */}
            {tab === 'activate' && (
              <form onSubmit={(e) => void handleActivateSubmit(e)} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5">
                    Registration / License Key
                  </label>
                  <input
                    type="text"
                    required
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value.toUpperCase())}
                    placeholder="WND-COMM-XXXXXXXX-XXXXXXXX"
                    className="w-full h-11 px-3.5 rounded-xl text-sm font-mono tracking-wider bg-white dark:bg-[#141013] border border-stone-200 dark:border-[#32242A] focus:outline-none focus:ring-2 focus:ring-[#DC2626]"
                  />
                  <p className="mt-1.5 text-[11px] text-[#57534E] dark:text-stone-400">
                    Validates key status, expiration, platform scope, and binds device ID{' '}
                    <code className="font-mono">{deviceId.slice(0, 14)}...</code> before unlocking.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setTab('register')}
                    className="text-xs font-medium text-[#DC2626] dark:text-[#FACC15] hover:underline cursor-pointer"
                  >
                    Need a registration key? Register now
                  </button>

                  <Button type="submit" variant="primary" size="md" disabled={loading}>
                    <Unlock className="h-4 w-4" />
                    {loading ? 'Verifying Key...' : 'Verify & Unlock App'}
                  </Button>
                </div>
              </form>
            )}

            {/* TAB 2: REGISTER & ISSUE KEY */}
            {tab === 'register' && (
              <form onSubmit={(e) => void handleRegisterAndUnlock(e)} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className={backendMode === 'firebase' ? 'sm:col-span-2' : ''}>
                    <label className="block text-xs font-medium mb-1">Organization Name</label>
                    <input
                      type="text"
                      required
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      placeholder="e.g. Apex Hardware Pvt Ltd"
                      className="w-full h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-stone-200 dark:border-[#32242A]"
                    />
                  </div>

                  {backendMode === 'server' && (
                    <>
                      <div>
                        <label className="block text-xs font-medium mb-1">Full Name</label>
                        <input
                          type="text"
                          required
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Aarav Sharma"
                          className="w-full h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-stone-200 dark:border-[#32242A]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Work Email</label>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="owner@company.com"
                          className="w-full h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-stone-200 dark:border-[#32242A]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Password</label>
                        <input
                          type="password"
                          required
                          minLength={6}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Min 6 characters"
                          className="w-full h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-stone-200 dark:border-[#32242A]"
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold">
                    License Edition
                    {backendMode === 'firebase' && !isBootstrapAdmin && (
                      <span className="ml-1.5 font-normal text-[#57534E] dark:text-stone-400">
                        (Standard Firebase self-registration issues Community Edition · 3 devices)
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {WENDORO_LICENSE_PLANS.filter((p) =>
                      backendMode === 'firebase' && !isBootstrapAdmin
                        ? p.tier === 'free'
                        : ['free', 'starter', 'business', 'professional', 'enterprise', 'self_hosted'].includes(p.tier),
                    ).map((plan) => {
                      const active = selectedTier === plan.tier;
                      return (
                        <button
                          key={plan.tier}
                          type="button"
                          onClick={() => setSelectedTier(plan.tier)}
                          className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                            active
                              ? 'border-[#DC2626] ring-1 ring-[#DC2626] bg-[#DC2626]/5 dark:bg-[#DC2626]/15'
                              : 'border-stone-200 dark:border-[#32242A] bg-white dark:bg-[#141013]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 text-xs font-bold">
                            <span>{plan.name}</span>
                            <span className="font-mono text-[#DC2626] dark:text-[#FACC15]">
                              {plan.tier === 'free'
                                ? 'Free'
                                : `${formatNumericCurrency(plan.monthlyPriceInr, 'INR', 0)}/mo`}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#57534E] dark:text-stone-400 mt-0.5">
                            {plan.maxUsers} users
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-1.5">
                    {(
                      [
                        { id: 'both', label: 'Desktop + Android' },
                        { id: 'desktop', label: 'Desktop' },
                        { id: 'android', label: 'Android' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setLicensedPlatform(opt.id)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium border cursor-pointer ${
                          licensedPlatform === opt.id
                            ? 'bg-[#FACC15] text-[#1C1917] border-[#EAB308] font-semibold'
                            : 'border-stone-200 dark:border-[#32242A] text-[#57534E] dark:text-stone-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <Button type="submit" variant="primary" size="md" disabled={loading}>
                    <Sparkles className="h-4 w-4" />
                    {loading ? 'Issuing Key...' : 'Register, Activate & Unlock'}
                  </Button>
                </div>
              </form>
            )}

            {/* TAB 3: MY REGISTERED KEYS */}
            {tab === 'keys' && (
              <div className="space-y-4">
                {backendMode === 'firebase' ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-[#57534E] dark:text-stone-400">
                      {firebaseReadyForSession
                        ? `Keys registered to ${user?.email}`
                        : 'Sign in with Google on the left panel to view your Firebase keys.'}
                    </span>
                    {firebaseReadyForSession && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={loading}
                        onClick={() => void handleLoadFirebaseKeys()}
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                      </Button>
                    )}
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => void handleServerLoginKeys(e)}
                    className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end"
                  >
                    <div>
                      <label className="block text-xs font-medium mb-1">Email</label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-stone-200 dark:border-[#32242A]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Password</label>
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-stone-200 dark:border-[#32242A]"
                      />
                    </div>
                    <Button type="submit" variant="secondary" size="md" disabled={loading}>
                      <LogIn className="h-4 w-4" />
                      Fetch My Keys
                    </Button>
                  </form>
                )}

                {myKeys.length > 0 && (
                  <div className="space-y-2">
                    {myKeys.map((lic) => (
                      <div
                        key={lic.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl border border-stone-200 dark:border-[#32242A] bg-[#FAF9F7] dark:bg-[#141013]"
                      >
                        <div>
                          <div className="font-mono text-xs font-bold text-[#DC2626] dark:text-[#FACC15] flex items-center gap-2">
                            <span>{lic.licenseKey}</span>
                            <span className="px-1.5 py-0.5 rounded bg-stone-200/70 dark:bg-[#251B20] text-[10px] text-[#1C1917] dark:text-stone-200 uppercase">
                              {lic.status}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#57534E] dark:text-stone-400 mt-0.5">
                            {lic.planName} · {lic.organizationName} · {lic.usedDevices}/{lic.maxDevices} devices
                          </div>
                        </div>
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={loading || lic.status !== 'active'}
                          onClick={() => void handleActivateSubmit(undefined, lic.licenseKey)}
                        >
                          <Check className="h-3.5 w-3.5" />
                          Activate & Unlock
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Surface>
        </div>
      </main>
    </div>
  );
}
