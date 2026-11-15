import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Copy,
  HardDrive,
  KeyRound,
  Laptop,
  LogIn,
  Moon,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Sun,
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
import { WENDORO_MODULES } from '@/src/core/registry/modules';
import {
  listUserLicensesInFirebase,
  registerLicenseInFirebase,
  validateLicenseKeyFormat,
  verifyAndActivateLicenseInFirebase,
} from '@/src/lib/firebaseLicense';
import { formatNumericCurrency } from '@/src/lib/utils';

interface RegionPreset {
  id: string;
  label: string;
  countryCode: string;
  currency: string;
  timezone: string;
  defaultCity: string;
}

const REGION_PRESETS: RegionPreset[] = [
  { id: 'IN', label: 'India (INR · GST)', countryCode: 'IN', currency: 'INR', timezone: 'Asia/Kolkata', defaultCity: 'Bengaluru' },
  { id: 'US', label: 'United States (USD)', countryCode: 'US', currency: 'USD', timezone: 'America/New_York', defaultCity: 'New York' },
  { id: 'EU', label: 'European Union (EUR)', countryCode: 'DE', currency: 'EUR', timezone: 'Europe/Berlin', defaultCity: 'Munich' },
  { id: 'GB', label: 'United Kingdom (GBP)', countryCode: 'GB', currency: 'GBP', timezone: 'Europe/London', defaultCity: 'London' },
  { id: 'SG', label: 'Singapore (SGD)', countryCode: 'SG', currency: 'SGD', timezone: 'Asia/Singapore', defaultCity: 'Singapore' },
];

const BUSINESS_PRESETS = [
  {
    id: 'commerce',
    title: 'Retail, POS & Distribution',
    industry: 'Retail & Distribution',
    description: 'Catalogue, CRM, Sales, Purchase, Inventory, Accounting & Retail POS.',
    modules: ['catalogue', 'crm', 'sales', 'purchase', 'inventory', 'accounting', 'industry_retail'],
  },
  {
    id: 'services',
    title: 'Services & Agency',
    industry: 'Professional Services',
    description: 'CRM, Projects, Accounting, HRMS, Documents & Client Retainers.',
    modules: ['crm', 'projects', 'accounting', 'hrms', 'documents', 'industry_services'],
  },
  {
    id: 'manufacturing',
    title: 'Manufacturing & Hardware',
    industry: 'Manufacturing & Hardware',
    description: 'Catalogue, Purchase, Inventory, Accounting, BOM Manufacturing & Electronics RMA.',
    modules: ['catalogue', 'purchase', 'inventory', 'accounting', 'industry_manufacturing', 'industry_electronics'],
  },
  {
    id: 'full',
    title: 'Full ERP Suite',
    industry: 'Multi-Operations Enterprise',
    description: 'All business apps enabled across Finance, Supply Chain, CRM, HRMS & Support.',
    modules: ['catalogue', 'crm', 'sales', 'purchase', 'inventory', 'accounting', 'hrms', 'projects', 'support', 'documents', 'marketing'],
  },
];

const WIZARD_STEPS = [
  { num: 1, title: 'Local Company & Apps', icon: Building2 },
  { num: 2, title: 'License & Activation', icon: KeyRound },
  { num: 3, title: 'Native Launch', icon: HardDrive },
] as const;

export interface SetupWizardProps {
  isModalOrEmbedded?: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

export function SetupWizard({
  isModalOrEmbedded = false,
  onComplete,
  onSkip,
}: SetupWizardProps) {
  const { theme, toggleTheme } = useTheme();
  const { user, authReady, isConfigured: isFirebaseConfigured, signInWithGoogle } = useFirebase();
  const { completeSetupWizard, licenseActivation, setLicenseActivation } = useTenant();

  const [step, setStep] = useState<number>(1);

  // Step 1: Local Business Profile & Offline Modules
  const [regionId, setRegionId] = useState<string>('IN');
  const [companyName, setCompanyName] = useState<string>(
    licenseActivation?.organizationName && licenseActivation.organizationName !== 'My Organization'
      ? licenseActivation.organizationName
      : '',
  );
  const [companyCode, setCompanyCode] = useState<string>('');
  const [branchCity, setBranchCity] = useState<string>('Bengaluru');
  const [selectedPreset, setSelectedPreset] = useState<string>('commerce');
  const [industryClassification, setIndustryClassification] = useState<string>('Retail & Distribution');
  const [enabledModules, setEnabledModules] = useState<string[]>(BUSINESS_PRESETS[0].modules);
  const [showCustomModules, setShowCustomModules] = useState(false);

  // Step 2: Native License Registration & Local Device Binding
  const [licenseTab, setLicenseTab] = useState<'activate' | 'register' | 'keys'>(
    licenseActivation ? 'activate' : 'register',
  );
  const [showEndpointOverride, setShowEndpointOverride] = useState(false);
  const [serverUrl, setServerUrl] = useState<string>(
    licenseActivation?.serverUrl && licenseActivation.serverUrl.startsWith('http')
      ? licenseActivation.serverUrl
      : typeof window !== 'undefined' && window.location.origin.startsWith('http')
        ? window.location.origin
        : 'http://localhost:3000',
  );
  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>(licenseActivation?.email ?? '');
  const [password, setPassword] = useState<string>('');
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>(
    licenseActivation?.planTier ?? 'free',
  );
  const [licensedPlatform, setLicensedPlatform] = useState<LicensedPlatform>(
    licenseActivation?.platform ?? 'both',
  );
  const [currencyDisplay, setCurrencyDisplay] = useState<'INR' | 'USD'>('INR');
  const [licenseKeyInput, setLicenseKeyInput] = useState<string>(
    licenseActivation?.licenseKey ?? '',
  );
  const [activatedState, setActivatedState] = useState<LicenseActivationState | undefined>(
    licenseActivation,
  );
  const [accountLicenses, setAccountLicenses] = useState<ServerLicenseSummary[]>([]);
  const [authLoading, setAuthLoading] = useState(false);
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  // Step 3: Native Initialization Helpers
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);

  const deviceId = useMemo(() => getOrCreateDeviceId(), []);
  const devicePlatform = useMemo(() => detectClientPlatform(), []);
  const deviceName = useMemo(() => getDefaultDeviceName(), []);
  const useFirebaseForLicense = isFirebaseConfigured && authReady && Boolean(user?.emailVerified);
  const isBootstrapAdmin = user?.email?.toLowerCase() === 'wendoro.dev@gmail.com';

  const region = useMemo(
    () => REGION_PRESETS.find((r) => r.id === regionId) ?? REGION_PRESETS[0],
    [regionId],
  );

  const selectableModules = useMemo(
    () => WENDORO_MODULES.filter((m) => m.layer !== 'core'),
    [],
  );

  function suggestCode(name: string): string {
    const clean = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);
    return clean ? `${clean}-01` : '';
  }

  const handleCompanyNameChange = (value: string) => {
    setCompanyName(value);
    if (!companyCode || companyCode === suggestCode(companyName)) {
      setCompanyCode(suggestCode(value));
    }
  };

  const handleRegionSelect = (nextRegionId: string) => {
    const preset = REGION_PRESETS.find((r) => r.id === nextRegionId);
    if (!preset) return;
    setRegionId(nextRegionId);
    setBranchCity(preset.defaultCity);
    setCurrencyDisplay(preset.currency === 'INR' ? 'INR' : 'USD');
  };

  const handlePresetSelect = (presetId: string) => {
    const preset = BUSINESS_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setSelectedPreset(presetId);
    setIndustryClassification(preset.industry);
    setEnabledModules(preset.modules);
  };

  const toggleModule = (slug: string) => {
    setSelectedPreset('custom');
    setEnabledModules((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  };

  const copyText = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      setCopiedId(null);
    }
  };

  const handleRegisterAndIssueKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setAuthNotice(null);
    setAuthLoading(true);
    try {
      const org = companyName.trim() || 'My Organization';
      let activated: LicenseActivationState;

      if (useFirebaseForLicense) {
        activated = await registerLicenseInFirebase({
          organizationName: org,
          planTier: isBootstrapAdmin ? selectedTier : 'free',
          platform: licensedPlatform,
          deviceId,
          deviceName,
        });
      } else {
        const registered = await registerLicenseWithServer({
          serverUrl,
          email,
          password,
          fullName,
          organizationName: org,
          planTier: selectedTier,
          platform: licensedPlatform,
        });
        activated = await activateLicenseKeyWithServer({
          serverUrl: registered.serverUrl,
          licenseKey: registered.license.licenseKey,
          deviceName,
        });
      }

      setLicenseKeyInput(activated.licenseKey);
      setSelectedTier(activated.planTier);
      setActivatedState(activated);
      setLicenseActivation(activated);
      setAuthNotice(
        `License ${activated.licenseKey} registered and bound to ${deviceName}.`,
      );
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Unable to register license.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleActivateExistingKey = async (e?: React.FormEvent, keyOverride?: string) => {
    if (e) e.preventDefault();
    setValidationError(null);
    setAuthNotice(null);

    const fmt = validateLicenseKeyFormat(keyOverride ?? licenseKeyInput);
    if (!fmt.valid) {
      setValidationError(fmt.error || 'Enter a valid WENDORO registration key.');
      return;
    }

    setAuthLoading(true);
    try {
      const activated = useFirebaseForLicense
        ? await verifyAndActivateLicenseInFirebase({
            licenseKey: fmt.normalized,
            deviceId,
            deviceName,
          })
        : await activateLicenseKeyWithServer({
            serverUrl,
            licenseKey: fmt.normalized,
            deviceName,
          });

      setLicenseKeyInput(activated.licenseKey);
      setSelectedTier(activated.planTier);
      setActivatedState(activated);
      setLicenseActivation(activated);
      setAuthNotice(
        `License ${activated.licenseKey} verified (${activated.planName}) for this native device.`,
      );
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Unable to activate license key.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLoadKeys = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setValidationError(null);
    setAuthNotice(null);
    setAuthLoading(true);
    try {
      if (useFirebaseForLicense) {
        const list = await listUserLicensesInFirebase();
        setAccountLicenses(list);
        setAuthNotice(
          list.length > 0
            ? `Found ${list.length} Firebase license ${list.length === 1 ? 'key' : 'keys'}. Select one to bind this device.`
            : 'No keys registered on Firebase yet. Switch to Register & Get Key.',
        );
      } else {
        const result = await loginLicenseAccount({ serverUrl, email, password });
        setAccountLicenses(result.licenses);
        setAuthNotice(
          result.licenses.length > 0
            ? `Signed in as ${result.user.email}. Select a key to activate this device.`
            : `No keys found for ${result.user.email}. Switch to Register & Get Key.`,
        );
      }
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Unable to fetch license keys.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleNext = () => {
    setValidationError(null);
    if (step === 1 && !companyName.trim()) {
      setValidationError('Enter your company or shop name to initialize local storage.');
      return;
    }
    if (step === 2 && !activatedState) {
      setValidationError('Activate or register a valid license key before continuing.');
      return;
    }
    setStep((s) => Math.min(3, s + 1));
  };

  const handleLaunch = () => {
    setLaunching(true);
    setValidationError(null);
    try {
      const cleanName = companyName.trim() || 'My Organization';
      const cleanCode = (companyCode.trim() || suggestCode(cleanName) || 'WND-01').toUpperCase();
      const slug = cleanCode.toLowerCase().replace(/[^a-z0-9-]+/g, '-') || 'wendoro-org';

      completeSetupWizard({
        tenantName: cleanName,
        tenantSlug: slug,
        companyName: cleanName,
        legalName: cleanName,
        companyCode: cleanCode,
        industryClassification,
        countryCode: region.countryCode,
        baseCurrency: region.currency,
        timezone: region.timezone,
        branchCode: 'HQ-01',
        branchName: `${branchCity.trim() || region.defaultCity} Headquarters`,
        branchCity: branchCity.trim() || region.defaultCity,
        enabledModules,
        subscriptionTier: activatedState?.planTier ?? selectedTier,
        licenseKey: activatedState?.licenseKey ?? (licenseKeyInput.trim() || undefined),
        licenseActivation: activatedState,
      });

      onComplete();
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Unable to launch workspace.');
    } finally {
      setLaunching(false);
    }
  };

  return (
    <div
      className={
        isModalOrEmbedded
          ? 'space-y-6'
          : 'min-h-screen bg-[#FAF9F7] dark:bg-[#141013] text-[#1C1917] dark:text-stone-100 flex flex-col'
      }
    >
      {!isModalOrEmbedded && (
        <header className="h-14 shrink-0 bg-[#181214] text-stone-100 border-b border-[#32242A] px-4 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-[#DC2626] flex items-center justify-center font-display font-bold text-sm text-white relative">
              W
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-[#FACC15]" />
            </div>
            <span className="font-display text-sm font-bold tracking-tight whitespace-nowrap">
              WENDORO Native Setup
            </span>
          </div>

          <div className="flex items-center gap-2">
            {activatedState && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#251B20] border border-[#3A2B31] text-[11px] font-mono text-[#FACC15]">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                {activatedState.licenseKey}
              </span>
            )}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-[#32242A] bg-[#1B1417] text-stone-200 hover:bg-[#251B20] cursor-pointer"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-[#FACC15]" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>
          </div>
        </header>
      )}

      <div
        className={
          isModalOrEmbedded
            ? 'space-y-6'
            : 'flex-1 w-full max-w-4xl mx-auto px-4 py-8 lg:px-8 space-y-6'
        }
      >
        {/* Native Stepper Header */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-[#DC2626] dark:text-[#FACC15] mb-1">
                Native Desktop & Android Onboarding · Offline-First Storage
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-[#1C1917] dark:text-stone-100">
                Local Workspace & License Setup
              </h1>
              <p className="mt-1 text-sm text-[#57534E] dark:text-stone-400">
                Configure your local company store, verify your registration key, and start working offline immediately.
              </p>
            </div>
            {isModalOrEmbedded && (
              <Button variant="outline" size="sm" onClick={onSkip}>
                Return to Workspace
              </Button>
            )}
          </div>

          <nav aria-label="Setup Steps" className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {WIZARD_STEPS.map((s) => {
              const Icon = s.icon;
              const isCurrent = step === s.num;
              const isDone = step > s.num;
              const canJump =
                s.num <= step ||
                (s.num === 2 && Boolean(companyName.trim())) ||
                (s.num === 3 && Boolean(companyName.trim()) && Boolean(activatedState));

              return (
                <button
                  key={s.num}
                  type="button"
                  onClick={() => {
                    if (canJump) setStep(s.num);
                  }}
                  className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                    isCurrent
                      ? 'bg-white dark:bg-[#1B1417] border-[#DC2626] ring-1 ring-[#DC2626]/30 text-[#1C1917] dark:text-stone-100'
                      : isDone
                        ? 'bg-white/80 dark:bg-[#1B1417]/70 border-amber-300 dark:border-[#FACC15]/40 text-[#B45309] dark:text-[#FACC15]'
                        : 'bg-stone-100/80 dark:bg-[#161114] border-stone-200 dark:border-[#32242A] text-[#57534E] dark:text-stone-400'
                  }`}
                >
                  <span
                    className={`h-7 w-7 rounded-lg text-xs font-mono font-bold flex items-center justify-center shrink-0 ${
                      isCurrent
                        ? 'bg-[#DC2626] text-white'
                        : isDone
                          ? 'bg-[#FACC15] text-[#1C1917]'
                          : 'bg-stone-200 dark:bg-[#2A1E22]'
                    }`}
                  >
                    {isDone ? <Check className="h-4 w-4" /> : s.num}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate flex items-center gap-1.5">
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{s.title}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {validationError && (
          <div
            role="alert"
            className="p-3.5 rounded-xl border border-red-300 bg-red-50 dark:border-red-900/60 dark:bg-red-950/40 text-xs font-medium text-red-700 dark:text-red-300"
          >
            {validationError}
          </div>
        )}

        {authNotice && (
          <div className="p-3.5 rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-700/50 dark:bg-amber-950/30 text-xs font-medium text-[#92400E] dark:text-[#FDE047] flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#DC2626] dark:text-[#FACC15]" />
            <span>{authNotice}</span>
          </div>
        )}

        {/* STEP 1: LOCAL COMPANY & OFFLINE MODULES */}
        {step === 1 && (
          <Surface padding="lg" className="space-y-6">
            <div>
              <h2 className="text-base font-semibold text-[#1C1917] dark:text-stone-100">
                1. Local Company Profile & Business Apps
              </h2>
              <p className="text-xs text-[#57534E] dark:text-stone-400 mt-0.5">
                All accounting ledgers, invoices, and inventory records are stored natively on this device.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {REGION_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleRegionSelect(preset.id)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                    regionId === preset.id
                      ? 'bg-[#DC2626] text-white border-[#DC2626]'
                      : 'bg-[#FAF9F7] dark:bg-[#141013] border-stone-200 dark:border-[#32242A] text-[#1C1917] dark:text-stone-200 hover:border-[#DC2626]'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#1C1917] dark:text-stone-200 mb-1.5">
                  Company / Shop Name
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => handleCompanyNameChange(e.target.value)}
                  placeholder="e.g. Apex Retail Pvt Ltd"
                  className="w-full h-10 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-stone-200 dark:border-[#32242A] focus:outline-none focus:ring-2 focus:ring-[#DC2626]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1C1917] dark:text-stone-200 mb-1.5">
                  Company Code
                </label>
                <input
                  type="text"
                  value={companyCode}
                  onChange={(e) => setCompanyCode(e.target.value.toUpperCase())}
                  placeholder="APEX-01"
                  className="w-full h-10 px-3 rounded-lg text-sm font-mono uppercase bg-white dark:bg-[#141013] border border-stone-200 dark:border-[#32242A] focus:outline-none focus:ring-2 focus:ring-[#DC2626]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1C1917] dark:text-stone-200 mb-1.5">
                  HQ City
                </label>
                <input
                  type="text"
                  value={branchCity}
                  onChange={(e) => setBranchCity(e.target.value)}
                  placeholder={region.defaultCity}
                  className="w-full h-10 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-stone-200 dark:border-[#32242A] focus:outline-none focus:ring-2 focus:ring-[#DC2626]"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#1C1917] dark:text-stone-200">
                  Select Native App Bundle ({enabledModules.length} modules)
                </span>
                <button
                  type="button"
                  onClick={() => setShowCustomModules((v) => !v)}
                  className="text-xs font-medium text-[#DC2626] dark:text-[#FACC15] hover:underline cursor-pointer"
                >
                  {showCustomModules ? 'Hide individual apps' : 'Customize individual apps'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {BUSINESS_PRESETS.map((preset) => {
                  const active = selectedPreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handlePresetSelect(preset.id)}
                      className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                        active
                          ? 'border-[#DC2626] bg-[#DC2626]/5 dark:bg-[#DC2626]/15 ring-1 ring-[#DC2626]/30'
                          : 'border-stone-200 dark:border-[#32242A] bg-[#FAF9F7]/70 dark:bg-[#141013] hover:border-[#DC2626]/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-[#1C1917] dark:text-stone-100">
                          {preset.title}
                        </span>
                        {active && <CheckCircle2 className="h-4 w-4 text-[#DC2626] dark:text-[#FACC15] shrink-0" />}
                      </div>
                      <p className="mt-1 text-[11px] text-[#57534E] dark:text-stone-400 leading-relaxed">
                        {preset.description}
                      </p>
                    </button>
                  );
                })}
              </div>

              {showCustomModules && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
                  {selectableModules.map((mod) => {
                    const checked = enabledModules.includes(mod.slug);
                    return (
                      <button
                        key={mod.slug}
                        type="button"
                        onClick={() => toggleModule(mod.slug)}
                        className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-left text-xs transition-colors cursor-pointer ${
                          checked
                            ? 'border-[#F59E0B] bg-amber-50 dark:bg-amber-950/30 text-[#1C1917] dark:text-stone-100'
                            : 'border-stone-200 dark:border-[#32242A] bg-white dark:bg-[#141013] text-[#57534E] dark:text-stone-400'
                        }`}
                      >
                        <span className="truncate font-medium">{mod.name}</span>
                        <span
                          className={`h-4 w-4 rounded flex items-center justify-center shrink-0 ${
                            checked ? 'bg-[#DC2626] text-white' : 'border border-stone-300 dark:border-[#32242A]'
                          }`}
                        >
                          {checked && <Check className="h-3 w-3" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </Surface>
        )}

        {/* STEP 2: LOCAL DEVICE ACTIVATION & LICENSE REGISTRATION */}
        {step === 2 && (
          <Surface padding="lg" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-[#1C1917] dark:text-stone-100">
                  2. License Registration & Local Device Activation
                </h2>
                <p className="text-xs text-[#57534E] dark:text-stone-400 mt-0.5">
                  Verify or register a license key to bind <code className="font-mono">{deviceName}</code> ({devicePlatform}).
                </p>
              </div>

              <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-stone-100 dark:bg-[#141013] border border-stone-200 dark:border-[#32242A] self-start">
                {(
                  [
                    { id: 'activate', label: 'Activate Key', icon: KeyRound },
                    { id: 'register', label: 'Register & Get Key', icon: UserPlus },
                    { id: 'keys', label: 'My Keys', icon: LogIn },
                  ] as const
                ).map((item) => {
                  const Icon = item.icon;
                  const active = licenseTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setLicenseTab(item.id)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
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
            </div>

            {/* Active License Status Card */}
            {activatedState && (
              <div className="p-4 rounded-xl border border-[#F59E0B]/60 bg-gradient-to-r from-[#DC2626]/8 via-amber-50 to-[#FACC15]/15 dark:from-[#DC2626]/20 dark:via-[#1B1417] dark:to-[#FACC15]/10 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-[#DC2626] dark:text-[#FACC15]" />
                    <span className="text-xs font-bold text-[#1C1917] dark:text-stone-100">
                      Device Activated · {activatedState.planName}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-[#B45309] dark:text-[#FACC15] tabular-nums">
                    {activatedState.usedDevices} / {activatedState.maxDevices} seats · {activatedState.platform}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-white/90 dark:bg-[#141013] border border-stone-200 dark:border-[#32242A]">
                  <code className="font-mono text-sm font-bold tracking-wider text-[#DC2626] dark:text-[#FACC15]">
                    {activatedState.licenseKey}
                  </code>
                  <button
                    type="button"
                    onClick={() => void copyText('active-key', activatedState.licenseKey)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#1C1917] dark:text-stone-200 hover:text-[#DC2626] cursor-pointer"
                  >
                    {copiedId === 'active-key' ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" /> Copy Key
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Local Hardware ID & Optional Firebase Google Sign-In */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-[#FAF9F7] dark:bg-[#141013] border border-stone-200 dark:border-[#32242A] text-xs">
              <div className="flex items-center gap-2 min-w-0">
                {devicePlatform === 'android' ? (
                  <Smartphone className="h-3.5 w-3.5 text-[#F59E0B] shrink-0" />
                ) : (
                  <Laptop className="h-3.5 w-3.5 text-[#DC2626] shrink-0" />
                )}
                <span className="text-[#57534E] dark:text-stone-400">Device ID:</span>
                <code className="font-mono text-[11px] truncate">{deviceId}</code>
              </div>

              <div className="flex items-center gap-2">
                {isFirebaseConfigured && !user && (
                  <Button variant="outline" size="sm" onClick={() => void signInWithGoogle()}>
                    Sign In with Google
                  </Button>
                )}
                <button
                  type="button"
                  onClick={() => setShowEndpointOverride((v) => !v)}
                  className="text-[11px] font-medium text-[#57534E] dark:text-stone-400 hover:text-[#DC2626] cursor-pointer"
                >
                  {showEndpointOverride ? 'Hide server address' : 'Custom license server'}
                </button>
              </div>
            </div>

            {showEndpointOverride && !useFirebaseForLicense && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg bg-[#FAF9F7] dark:bg-[#141013] border border-stone-200 dark:border-[#32242A]">
                <label className="text-xs font-medium text-[#57534E] dark:text-stone-400 shrink-0">
                  License Server URL:
                </label>
                <input
                  type="url"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  className="flex-1 h-8 px-2.5 rounded-md text-xs font-mono bg-white dark:bg-[#1B1417] border border-stone-200 dark:border-[#32242A]"
                />
              </div>
            )}

            {licenseTab === 'activate' && (
              <form onSubmit={(e) => void handleActivateExistingKey(e)} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5">
                    Enter Registration Key
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      required
                      value={licenseKeyInput}
                      onChange={(e) => setLicenseKeyInput(e.target.value.toUpperCase())}
                      placeholder="WND-COMM-XXXXXXXX-XXXXXXXX"
                      className="flex-1 h-10 px-3 rounded-lg text-sm font-mono tracking-wider bg-white dark:bg-[#141013] border border-stone-200 dark:border-[#32242A] focus:outline-none focus:ring-2 focus:ring-[#DC2626]"
                    />
                    <Button type="submit" variant="primary" size="md" disabled={authLoading}>
                      <KeyRound className="h-4 w-4" />
                      {authLoading ? 'Verifying...' : 'Activate Device'}
                    </Button>
                  </div>
                </div>
              </form>
            )}

            {licenseTab === 'register' && (
              <form onSubmit={(e) => void handleRegisterAndIssueKey(e)} className="space-y-4">
                {!useFirebaseForLicense && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1">Full Name</label>
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Aarav Sharma"
                        className="w-full h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-stone-200 dark:border-[#32242A] focus:outline-none focus:ring-2 focus:ring-[#DC2626]"
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
                        className="w-full h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-stone-200 dark:border-[#32242A] focus:outline-none focus:ring-2 focus:ring-[#DC2626]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Account Password</label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Min 6 characters"
                        className="w-full h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-stone-200 dark:border-[#32242A] focus:outline-none focus:ring-2 focus:ring-[#DC2626]"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold">Select License Edition</span>
                    <div className="inline-flex items-center gap-1 p-0.5 rounded-md bg-stone-100 dark:bg-[#141013]">
                      {(['INR', 'USD'] as const).map((cur) => (
                        <button
                          key={cur}
                          type="button"
                          onClick={() => setCurrencyDisplay(cur)}
                          className={`px-2 py-0.5 text-[11px] font-medium rounded cursor-pointer ${
                            currencyDisplay === cur
                              ? 'bg-white dark:bg-[#1B1417] text-[#1C1917] dark:text-white shadow-xs'
                              : 'text-[#57534E] dark:text-stone-400'
                          }`}
                        >
                          {cur}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {WENDORO_LICENSE_PLANS.filter((p) =>
                      useFirebaseForLicense && !isBootstrapAdmin
                        ? p.tier === 'free'
                        : ['free', 'starter', 'business', 'professional', 'enterprise', 'self_hosted'].includes(p.tier),
                    ).map((plan) => {
                      const active = selectedTier === plan.tier;
                      const price =
                        currencyDisplay === 'INR'
                          ? formatNumericCurrency(plan.monthlyPriceInr, 'INR', 0)
                          : formatNumericCurrency(plan.monthlyPriceUsd, 'USD', 0);
                      return (
                        <button
                          key={plan.tier}
                          type="button"
                          onClick={() => setSelectedTier(plan.tier)}
                          className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                            active
                              ? 'border-[#DC2626] ring-1 ring-[#DC2626] bg-[#DC2626]/5 dark:bg-[#DC2626]/15'
                              : 'border-stone-200 dark:border-[#32242A] bg-white dark:bg-[#141013]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-bold">{plan.name}</span>
                            <span className="font-mono text-xs font-semibold text-[#DC2626] dark:text-[#FACC15] tabular-nums">
                              {plan.tier === 'free' ? 'Free' : `${price}/mo`}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#57534E] dark:text-stone-400 mt-0.5">
                            {plan.maxUsers} users · {plan.maxCompanies} {plan.maxCompanies === 1 ? 'company' : 'companies'}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-[#57534E] dark:text-stone-400">
                      Issue Key For:
                    </span>
                    {(
                      [
                        { id: 'both', label: 'Desktop + Android' },
                        { id: 'desktop', label: 'Desktop Only' },
                        { id: 'android', label: 'Android Only' },
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

                  <Button type="submit" variant="primary" size="md" disabled={authLoading}>
                    <Sparkles className="h-4 w-4" />
                    {authLoading ? 'Generating Key...' : 'Register & Activate Key'}
                  </Button>
                </div>
              </form>
            )}

            {licenseTab === 'keys' && (
              <div className="space-y-4">
                {useFirebaseForLicense ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-[#57534E] dark:text-stone-400">
                      Fetch keys registered to {user?.email}
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={authLoading}
                      onClick={() => void handleLoadKeys()}
                    >
                      <LogIn className="h-3.5 w-3.5" />
                      {authLoading ? 'Loading...' : 'Refresh My Keys'}
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={(e) => void handleLoadKeys(e)} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                    <div>
                      <label className="block text-xs font-medium mb-1">Registered Email</label>
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
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-stone-200 dark:border-[#32242A]"
                      />
                    </div>
                    <Button type="submit" variant="secondary" size="md" disabled={authLoading}>
                      <LogIn className="h-4 w-4" />
                      {authLoading ? 'Signing In...' : 'Fetch My Keys'}
                    </Button>
                  </form>
                )}

                {accountLicenses.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <div className="text-xs font-semibold">Issued License Keys</div>
                    {accountLicenses.map((lic) => (
                      <div
                        key={lic.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border border-stone-200 dark:border-[#32242A] bg-[#FAF9F7] dark:bg-[#141013]"
                      >
                        <div>
                          <div className="font-mono text-xs font-bold text-[#DC2626] dark:text-[#FACC15]">
                            {lic.licenseKey}
                          </div>
                          <div className="text-[11px] text-[#57534E] dark:text-stone-400">
                            {lic.planName} · {lic.organizationName} · {lic.usedDevices}/{lic.maxDevices} devices
                          </div>
                        </div>
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={authLoading}
                          onClick={() => void handleActivateExistingKey(undefined, lic.licenseKey)}
                        >
                          Bind This Device
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Surface>
        )}

        {/* STEP 3: LOCAL NATIVE STORAGE SUMMARY & LAUNCH */}
        {step === 3 && (
          <Surface padding="lg" className="space-y-6">
            <div>
              <h2 className="text-base font-semibold text-[#1C1917] dark:text-stone-100">
                3. Confirm Native Installation & Launch
              </h2>
              <p className="text-xs text-[#57534E] dark:text-stone-400 mt-0.5">
                Review your local offline-first configuration and activated device license before entering the ERP.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-stone-200 dark:border-[#32242A] bg-[#FAF9F7] dark:bg-[#141013] space-y-2.5 text-xs">
                <div className="flex items-center gap-2 font-bold text-sm text-[#1C1917] dark:text-stone-100">
                  <HardDrive className="h-4 w-4 text-[#DC2626]" />
                  Local Workspace Profile
                </div>
                <div className="flex justify-between gap-2 pt-1">
                  <span className="text-[#57534E] dark:text-stone-400">Organization</span>
                  <span className="font-semibold">{companyName || 'My Organization'}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-[#57534E] dark:text-stone-400">Company Code</span>
                  <span className="font-mono font-semibold">
                    {(companyCode.trim() || suggestCode(companyName || 'WND')).toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-[#57534E] dark:text-stone-400">HQ & Currency</span>
                  <span className="font-medium">
                    {branchCity || region.defaultCity} · {region.currency}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-[#57534E] dark:text-stone-400">Enabled Apps</span>
                  <span className="font-semibold">{enabledModules.length} local modules</span>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-stone-200 dark:border-[#32242A] bg-[#FAF9F7] dark:bg-[#141013] space-y-2.5 text-xs">
                <div className="flex items-center gap-2 font-bold text-sm text-[#1C1917] dark:text-stone-100">
                  <ShieldCheck className="h-4 w-4 text-[#D97706] dark:text-[#FACC15]" />
                  Verified Native License
                </div>
                <div className="flex justify-between gap-2 pt-1">
                  <span className="text-[#57534E] dark:text-stone-400">License Key</span>
                  <code className="font-mono font-bold text-[#DC2626] dark:text-[#FACC15]">
                    {activatedState?.licenseKey || licenseKeyInput}
                  </code>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-[#57534E] dark:text-stone-400">Edition</span>
                  <span className="font-semibold">{activatedState?.planName ?? selectedTier}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-[#57534E] dark:text-stone-400">Device Binding</span>
                  <span className="font-medium capitalize">
                    {devicePlatform} · {deviceName}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-[#57534E] dark:text-stone-400">Storage Mode</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    100% Local Offline Store
                  </span>
                </div>
              </div>
            </div>
          </Surface>
        )}

        {/* Navigation Footer */}
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            size="md"
            disabled={step === 1}
            onClick={() => setStep((s) => Math.max(1, s - 1))}
          >
            <ArrowLeft className="h-4 w-4" />
            Previous
          </Button>

          {step < 3 ? (
            <Button variant="primary" size="md" onClick={handleNext}>
              Continue
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="primary"
              size="md"
              disabled={launching}
              onClick={handleLaunch}
            >
              {launching ? 'Initializing Local Store...' : 'Initialize Local Store & Launch'}
              <CheckCircle2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
