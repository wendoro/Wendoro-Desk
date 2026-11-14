import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Cloud,
  Copy,
  Database,
  Download,
  KeyRound,
  Layers,
  Moon,
  RefreshCw,
  Server,
  ShieldCheck,
  Sun,
} from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { Surface } from '@/src/components/ui/Surface';
import { useFirebase } from '@/src/components/shell/FirebaseProvider';
import { useTenant } from '@/src/components/shell/TenantProvider';
import { useTheme } from '@/src/components/shell/ThemeProvider';
import { WENDORO_LICENSE_PLANS } from '@/src/core/contracts/licensing';
import { SubscriptionTier } from '@/src/core/contracts/tenancy';
import { WENDORO_MODULES } from '@/src/core/registry/modules';
import { formatNumericCurrency } from '@/src/lib/utils';

interface RegionPreset {
  id: string;
  label: string;
  countryCode: string;
  currency: string;
  timezone: string;
  taxLabel: string;
  taxPlaceholder: string;
  defaultCity: string;
  fiscalHint: string;
}

const REGION_PRESETS: RegionPreset[] = [
  {
    id: 'IN',
    label: 'India (INR · GST)',
    countryCode: 'IN',
    currency: 'INR',
    timezone: 'Asia/Kolkata',
    taxLabel: 'GSTIN (Optional)',
    taxPlaceholder: '29AABCU9603R1ZM',
    defaultCity: 'Bengaluru',
    fiscalHint: 'April – March Fiscal Year · CGST/SGST/IGST Ready',
  },
  {
    id: 'US',
    label: 'United States (USD)',
    countryCode: 'US',
    currency: 'USD',
    timezone: 'America/New_York',
    taxLabel: 'EIN / Tax ID (Optional)',
    taxPlaceholder: '12-3456789',
    defaultCity: 'New York',
    fiscalHint: 'January – December Fiscal Year',
  },
  {
    id: 'EU',
    label: 'European Union (EUR)',
    countryCode: 'DE',
    currency: 'EUR',
    timezone: 'Europe/Berlin',
    taxLabel: 'EU VAT ID (Optional)',
    taxPlaceholder: 'DE123456789',
    defaultCity: 'Munich',
    fiscalHint: 'January – December Fiscal Year · VAT Ready',
  },
  {
    id: 'GB',
    label: 'United Kingdom (GBP)',
    countryCode: 'GB',
    currency: 'GBP',
    timezone: 'Europe/London',
    taxLabel: 'UK VAT / CRN (Optional)',
    taxPlaceholder: 'GB123456789',
    defaultCity: 'London',
    fiscalHint: 'April – March Fiscal Year',
  },
  {
    id: 'SG',
    label: 'Singapore (SGD)',
    countryCode: 'SG',
    currency: 'SGD',
    timezone: 'Asia/Singapore',
    taxLabel: 'UEN / GST Reg (Optional)',
    taxPlaceholder: '201912345A',
    defaultCity: 'Singapore',
    fiscalHint: 'Multi-Currency ASEAN Hub Ready',
  },
];

const BUSINESS_PRESETS = [
  {
    id: 'commerce',
    title: 'Commerce & Distribution',
    industry: 'Retail & Distribution',
    description: 'Catalogue, CRM, Sales, Purchase, Inventory, Accounting & Retail POS.',
    modules: ['catalogue', 'crm', 'sales', 'purchase', 'inventory', 'accounting', 'industry_retail'],
  },
  {
    id: 'services',
    title: 'Services & Consulting',
    industry: 'Professional Services',
    description: 'CRM, Projects, Accounting, HRMS, Documents & Client Retainers.',
    modules: ['crm', 'projects', 'accounting', 'hrms', 'documents', 'industry_services'],
  },
  {
    id: 'manufacturing',
    title: 'Manufacturing & Electronics',
    industry: 'Manufacturing & Hardware',
    description: 'Catalogue, Purchase, Inventory, Accounting, BOM Manufacturing & Electronics RMA.',
    modules: ['catalogue', 'purchase', 'inventory', 'accounting', 'industry_manufacturing', 'industry_electronics'],
  },
  {
    id: 'minimal',
    title: 'Minimal Core Only',
    industry: 'Universal Business',
    description: 'Start lightweight with Core Identity, RBAC & Accounting, then activate apps later.',
    modules: ['accounting'],
  },
];

const WIZARD_STEPS = [
  { num: 1, title: 'Organization & Region', icon: Building2 },
  { num: 2, title: 'Modules & Industry', icon: Layers },
  { num: 3, title: 'Edition & License', icon: KeyRound },
  { num: 4, title: 'Cloud & Identity', icon: Cloud },
  { num: 5, title: 'Review & Launch', icon: ShieldCheck },
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
  const { completeSetupWizard } = useTenant();
  const {
    user,
    connectionState,
    isConfigured,
    projectId,
    firestoreDatabaseId,
    authError,
    signInWithGoogle,
    syncWorkspacePresence,
  } = useFirebase();

  const [step, setStep] = useState<number>(1);
  const [regionId, setRegionId] = useState<string>('IN');
  const [companyName, setCompanyName] = useState<string>('');
  const [legalName, setLegalName] = useState<string>('');
  const [companyCode, setCompanyCode] = useState<string>('');
  const [taxNumber, setTaxNumber] = useState<string>('');
  const [branchCode, setBranchCode] = useState<string>('HQ-01');
  const [branchName, setBranchName] = useState<string>('Headquarters');
  const [branchCity, setBranchCity] = useState<string>('');

  const [selectedPreset, setSelectedPreset] = useState<string>('commerce');
  const [industryClassification, setIndustryClassification] = useState<string>(
    'Retail & Distribution',
  );
  const [enabledModules, setEnabledModules] = useState<string[]>(
    BUSINESS_PRESETS[0].modules,
  );

  const [currencyDisplay, setCurrencyDisplay] = useState<'INR' | 'USD'>('INR');
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>('free');
  const [licenseKey, setLicenseKey] = useState<string>('');
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);
  const [infraMode, setInfraMode] = useState<'standalone' | 'cloudflare-neon' | 'docker-postgres'>(
    'cloudflare-neon',
  );
  const [dbProvider, setDbProvider] = useState<'neon' | 'supabase' | 'postgres-self'>('neon');
  const [serverProbe, setServerProbe] = useState<{
    checking: boolean;
    checkedAt: string | null;
    mode: 'node-express' | 'static-edge' | null;
    databaseConfigured: boolean;
    authSecretConfigured: boolean;
    aiGatewayConfigured: boolean;
  }>({
    checking: false,
    checkedAt: null,
    mode: null,
    databaseConfigured: false,
    authSecretConfigured: false,
    aiGatewayConfigured: false,
  });

  const region = useMemo(
    () => REGION_PRESETS.find((r) => r.id === regionId) ?? REGION_PRESETS[0],
    [regionId],
  );

  const selectedPlan = useMemo(
    () => WENDORO_LICENSE_PLANS.find((p) => p.tier === selectedTier) ?? WENDORO_LICENSE_PLANS[0],
    [selectedTier],
  );

  const selectableModules = useMemo(
    () => WENDORO_MODULES.filter((m) => m.layer !== 'core'),
    [],
  );

  const handleRegionSelect = (nextRegionId: string) => {
    const preset = REGION_PRESETS.find((r) => r.id === nextRegionId);
    if (!preset) return;
    setRegionId(nextRegionId);
    setBranchCity(preset.defaultCity);
    setBranchName(`${preset.defaultCity} Headquarters`);
    setBranchCode(`${preset.defaultCity.slice(0, 3).toUpperCase()}-HQ`);
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

  const copyCommand = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCmd(id);
      setTimeout(() => setCopiedCmd(null), 1800);
    } catch {
      setCopiedCmd(null);
    }
  };

  const handleNext = () => {
    setValidationError(null);
    if (step === 1) {
      if (!companyName.trim() || !companyCode.trim() || !branchName.trim() || !branchCode.trim()) {
        setValidationError('Company name, company code, branch name, and branch code are required.');
        return;
      }
      if (
        regionId === 'IN' &&
        taxNumber.trim().length > 0 &&
        !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i.test(taxNumber.trim())
      ) {
        setValidationError('GSTIN must follow the 15-character Indian GST format (or leave blank for now).');
        return;
      }
    }
    setStep((s) => Math.min(5, s + 1));
  };

  const handleLaunch = async () => {
    setLaunching(true);
    setValidationError(null);
    try {
      const slug = companyCode
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'wendoro-org';

      const createdCompany = completeSetupWizard({
        tenantName: companyName.trim(),
        tenantSlug: slug,
        companyName: companyName.trim(),
        legalName: legalName.trim() || companyName.trim(),
        companyCode: companyCode.trim(),
        industryClassification,
        countryCode: region.countryCode,
        baseCurrency: region.currency,
        timezone: region.timezone,
        taxRegistrationNumber: taxNumber.trim() || undefined,
        branchCode: branchCode.trim(),
        branchName: branchName.trim(),
        branchCity: branchCity.trim(),
        enabledModules,
        subscriptionTier: selectedTier,
        licenseKey: licenseKey.trim() || undefined,
      });

      if (user && user.emailVerified) {
        await syncWorkspacePresence({
          companyId: createdCompany.companyId,
          companyName: createdCompany.companyName,
          activeRoute: 'overview',
        });
      }

      onComplete();
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Unable to finalize setup.');
    } finally {
      setLaunching(false);
    }
  };

  const checkServerStatus = async () => {
    setServerProbe((prev) => ({ ...prev, checking: true }));
    try {
      const res = await fetch('/api/setup/status', { cache: 'no-store' });
      const contentType = res.headers.get('content-type') ?? '';
      if (res.ok && contentType.includes('application/json')) {
        const data = (await res.json()) as {
          databaseConfigured?: boolean;
          authSecretConfigured?: boolean;
          aiGatewayConfigured?: boolean;
        };
        setServerProbe({
          checking: false,
          checkedAt: new Date().toLocaleTimeString(),
          mode: 'node-express',
          databaseConfigured: Boolean(data.databaseConfigured),
          authSecretConfigured: Boolean(data.authSecretConfigured),
          aiGatewayConfigured: Boolean(data.aiGatewayConfigured),
        });
      } else {
        setServerProbe({
          checking: false,
          checkedAt: new Date().toLocaleTimeString(),
          mode: 'static-edge',
          databaseConfigured: false,
          authSecretConfigured: false,
          aiGatewayConfigured: false,
        });
      }
    } catch {
      setServerProbe({
        checking: false,
        checkedAt: new Date().toLocaleTimeString(),
        mode: 'static-edge',
        databaseConfigured: false,
        authSecretConfigured: false,
        aiGatewayConfigured: false,
      });
    }
  };

  const downloadTemplateFile = (filename: string, content: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const safeDbSlug =
    companyCode
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/(^_|_$)/g, '') || 'wendoro';

  const envTemplateContent = `# WENDORO ERP Environment Configuration (${companyName})
# Replace placeholder values with your own credentials before starting.
DATABASE_URL="postgresql://wendoro:<YOUR_PASSWORD>@${
    dbProvider === 'neon'
      ? 'ep-your-endpoint.neon.tech'
      : dbProvider === 'supabase'
        ? 'db.your-project.supabase.co'
        : 'localhost'
  }:5432/${safeDbSlug}?sslmode=require"
BETTER_AUTH_SECRET="<RUN_OPENSSL_RAND_HEX_32>"
GEMINI_API_KEY="<OPTIONAL_GEMINI_API_KEY>"
APP_URL="https://erp.example.com"
`;

  const firebaseTemplateContent = JSON.stringify(
    {
      projectId: 'YOUR_FIREBASE_PROJECT_ID',
      appId: 'YOUR_FIREBASE_WEB_APP_ID',
      apiKey: 'YOUR_FIREBASE_WEB_API_KEY',
      authDomain: 'YOUR_FIREBASE_PROJECT_ID.firebaseapp.com',
      firestoreDatabaseId: '(default)',
      storageBucket: 'YOUR_FIREBASE_PROJECT_ID.firebasestorage.app',
      messagingSenderId: 'YOUR_FIREBASE_SENDER_ID',
    },
    null,
    2,
  );

  const migrationCommand = 'psql "$DATABASE_URL" -f src/db/migrations/0000_core_foundation_rls.sql';
  const cloudflareSecretsCommand =
    'npx wrangler secret put DATABASE_URL && npx wrangler secret put BETTER_AUTH_SECRET && npx wrangler secret put GEMINI_API_KEY';
  const dockerCommand = 'cp .env.example .env && docker compose up -d --build';

  return (
    <div
      className={
        isModalOrEmbedded
          ? 'space-y-6'
          : 'min-h-screen bg-[#F6F8FC] dark:bg-[#0B1224] text-[#182238] dark:text-slate-100 flex flex-col'
      }
    >
      {!isModalOrEmbedded && (
        <header className="h-14 shrink-0 bg-white dark:bg-[#101B35] border-b border-slate-200 dark:border-[#223257] px-4 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-[#4169F5] flex items-center justify-center font-display font-bold text-sm text-white">
              W
            </div>
            <span className="font-display text-base font-bold tracking-tight whitespace-nowrap">
              WENDORO Setup
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-[#223257] bg-white dark:bg-[#0E172E] cursor-pointer"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-amber-400" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>
            <Button variant="ghost" size="sm" onClick={onSkip}>
              Skip Setup
            </Button>
          </div>
        </header>
      )}

      <div
        className={
          isModalOrEmbedded
            ? 'space-y-6'
            : 'flex-1 w-full max-w-5xl mx-auto px-4 py-8 lg:px-8 space-y-6'
        }
      >
        {/* Intro + Stepper */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-[#4169F5] mb-1">
                BakeWeb · Wendoro-Desk Post-Deploy Onboarding
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-[#182238] dark:text-slate-100">
                Initialize Your WENDORO Workspace
              </h1>
              <p className="mt-1 text-sm text-[#718096] dark:text-slate-400">
                Configure your organization, India GST or global currency defaults, active
                modules, licensing edition, and cloud readiness in 5 steps.
              </p>
            </div>
            {isModalOrEmbedded && (
              <Button variant="outline" size="sm" onClick={onSkip}>
                Cancel Wizard
              </Button>
            )}
          </div>

          {/* 5-Step Progress Bar */}
          <nav aria-label="Setup Steps" className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {WIZARD_STEPS.map((s) => {
              const Icon = s.icon;
              const isCurrent = step === s.num;
              const isDone = step > s.num;
              return (
                <button
                  key={s.num}
                  type="button"
                  onClick={() => {
                    if (s.num <= step) setStep(s.num);
                  }}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                    isCurrent
                      ? 'bg-white dark:bg-[#101B35] border-[#4169F5] text-[#182238] dark:text-slate-100'
                      : isDone
                        ? 'bg-white/70 dark:bg-[#101B35]/70 border-slate-200 dark:border-[#223257] text-[#16B8A6]'
                        : 'bg-slate-100/70 dark:bg-[#0E172E] border-slate-200/70 dark:border-[#223257] text-[#718096] dark:text-slate-400'
                  }`}
                >
                  <span
                    className={`h-6 w-6 rounded-md text-xs font-mono font-semibold flex items-center justify-center shrink-0 ${
                      isCurrent
                        ? 'bg-[#4169F5] text-white'
                        : isDone
                          ? 'bg-[#16B8A6]/15 text-[#16B8A6]'
                          : 'bg-slate-200 dark:bg-[#162342]'
                    }`}
                  >
                    {isDone ? <Check className="h-3.5 w-3.5" /> : s.num}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-medium truncate flex items-center gap-1">
                      <Icon className="h-3 w-3 shrink-0 hidden xl:inline" />
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
            className="p-3.5 rounded-xl border border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30 text-xs font-medium text-red-700 dark:text-red-300"
          >
            {validationError}
          </div>
        )}

        {/* Step 1: Organization & Region */}
        {step === 1 && (
          <Surface padding="lg" className="space-y-6">
            <div>
              <h2 className="text-base font-semibold text-[#182238] dark:text-slate-100">
                01. Country Preset & Legal Entity
              </h2>
              <p className="text-xs text-[#718096] dark:text-slate-400 mt-0.5">
                Pick a regional compliance preset. India presets configure INR, Asia/Kolkata,
                and April–March GST fiscal calendars automatically.
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
                      ? 'bg-[#4169F5] text-white border-[#4169F5]'
                      : 'bg-[#F6F8FC] dark:bg-[#0E172E] border-slate-200 dark:border-[#223257] text-[#182238] dark:text-slate-200 hover:border-[#4169F5]'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="text-xs text-[#16B8A6] font-medium">
              Active Compliance Profile: {region.fiscalHint}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#182238] dark:text-slate-200 mb-1.5">
                  Company Display Name
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Acme Retail Pvt Ltd"
                  className="w-full h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257] focus:outline-none focus:ring-2 focus:ring-[#4169F5]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#182238] dark:text-slate-200 mb-1.5">
                  Company Code
                </label>
                <input
                  type="text"
                  value={companyCode}
                  onChange={(e) => setCompanyCode(e.target.value.toUpperCase())}
                  placeholder="e.g. ACME-IN"
                  className="w-full h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257] focus:outline-none focus:ring-2 focus:ring-[#4169F5]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#182238] dark:text-slate-200 mb-1.5">
                  Registered Legal Name
                </label>
                <input
                  type="text"
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder="e.g. Acme Retail Private Limited"
                  className="w-full h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257] focus:outline-none focus:ring-2 focus:ring-[#4169F5]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#182238] dark:text-slate-200 mb-1.5">
                  {region.taxLabel}
                </label>
                <input
                  type="text"
                  value={taxNumber}
                  onChange={(e) => setTaxNumber(e.target.value.toUpperCase())}
                  placeholder={region.taxPlaceholder}
                  className="w-full h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257] focus:outline-none focus:ring-2 focus:ring-[#4169F5]"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-[#223257] grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#182238] dark:text-slate-200 mb-1.5">
                  HQ Branch Name
                </label>
                <input
                  type="text"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  placeholder="e.g. Main Headquarters"
                  className="w-full h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257] focus:outline-none focus:ring-2 focus:ring-[#4169F5]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#182238] dark:text-slate-200 mb-1.5">
                  Branch Code
                </label>
                <input
                  type="text"
                  value={branchCode}
                  onChange={(e) => setBranchCode(e.target.value.toUpperCase())}
                  placeholder="e.g. HQ-01"
                  className="w-full h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257] focus:outline-none focus:ring-2 focus:ring-[#4169F5]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#182238] dark:text-slate-200 mb-1.5">
                  City
                </label>
                <input
                  type="text"
                  value={branchCity}
                  onChange={(e) => setBranchCity(e.target.value)}
                  placeholder={`e.g. ${region.defaultCity}`}
                  className="w-full h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257] focus:outline-none focus:ring-2 focus:ring-[#4169F5]"
                />
              </div>
            </div>
          </Surface>
        )}

        {/* Step 2: Modules & Industry */}
        {step === 2 && (
          <Surface padding="lg" className="space-y-6">
            <div>
              <h2 className="text-base font-semibold text-[#182238] dark:text-slate-100">
                02. Operational Profile & Module Activation
              </h2>
              <p className="text-xs text-[#718096] dark:text-slate-400 mt-0.5">
                Start with a recommended template or activate individual Layer B & Layer C modules.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {BUSINESS_PRESETS.map((preset) => {
                const active = selectedPreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handlePresetSelect(preset.id)}
                    className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                      active
                        ? 'border-[#4169F5] bg-[#4169F5]/5 dark:bg-[#4169F5]/10'
                        : 'border-slate-200 dark:border-[#223257] bg-[#F6F8FC]/60 dark:bg-[#0E172E] hover:border-[#4169F5]/60'
                    }`}
                  >
                    <div className="text-xs font-semibold text-[#182238] dark:text-slate-100">
                      {preset.title}
                    </div>
                    <p className="mt-1 text-[11px] text-[#718096] dark:text-slate-400 leading-relaxed">
                      {preset.description}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium text-[#718096] dark:text-slate-400">
                Active Modules ({enabledModules.length} selected + Core Identity & RBAC)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {selectableModules.map((mod) => {
                  const checked = enabledModules.includes(mod.slug);
                  return (
                    <button
                      key={mod.slug}
                      type="button"
                      onClick={() => toggleModule(mod.slug)}
                      aria-pressed={checked}
                      className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border text-left text-xs transition-colors cursor-pointer ${
                        checked
                          ? 'border-[#16B8A6] bg-[#16B8A6]/10 text-[#182238] dark:text-slate-100'
                          : 'border-slate-200 dark:border-[#223257] bg-white dark:bg-[#0E172E] text-[#718096] dark:text-slate-400'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate">{mod.name}</div>
                        <div className="text-[11px] opacity-80">
                          {mod.layer === 'industry' ? 'Industry Package' : 'Business App'}
                        </div>
                      </div>
                      <span
                        className={`h-4 w-4 rounded flex items-center justify-center shrink-0 ${
                          checked
                            ? 'bg-[#16B8A6] text-white'
                            : 'border border-slate-300 dark:border-[#223257]'
                        }`}
                      >
                        {checked && <Check className="h-3 w-3" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </Surface>
        )}

        {/* Step 3: Edition & License */}
        {step === 3 && (
          <Surface padding="lg" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-[#182238] dark:text-slate-100">
                  03. Open-Source Edition or Commercial License
                </h2>
                <p className="text-xs text-[#718096] dark:text-slate-400 mt-0.5">
                  Run free under Apache-2.0 Open Source or activate a commercial BakeWeb tier.
                </p>
              </div>

              <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-[#162342] self-start">
                {(['INR', 'USD'] as const).map((cur) => (
                  <button
                    key={cur}
                    type="button"
                    onClick={() => setCurrencyDisplay(cur)}
                    className={`px-3 py-1 text-xs font-medium rounded-md cursor-pointer ${
                      currencyDisplay === cur
                        ? 'bg-white dark:bg-[#101B35] text-[#182238] dark:text-slate-100 shadow-xs'
                        : 'text-[#718096] dark:text-slate-400'
                    }`}
                  >
                    {cur}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {WENDORO_LICENSE_PLANS.map((plan) => {
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
                    className={`p-4 rounded-xl border text-left transition-colors cursor-pointer flex flex-col justify-between gap-3 ${
                      active
                        ? 'border-[#4169F5] ring-1 ring-[#4169F5] bg-[#4169F5]/5 dark:bg-[#4169F5]/10'
                        : 'border-slate-200 dark:border-[#223257] bg-white dark:bg-[#0E172E] hover:border-[#4169F5]/60'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-[#182238] dark:text-slate-100">
                          {plan.name}
                        </span>
                        <span className="font-mono text-xs font-semibold text-[#4169F5] tabular-nums">
                          {price}/mo
                        </span>
                      </div>
                      <div className="text-[11px] text-[#718096] dark:text-slate-400 mt-0.5">
                        {plan.targetSegment} · Up to {plan.maxUsers} users · {plan.maxCompanies}{' '}
                        {plan.maxCompanies === 1 ? 'company' : 'companies'}
                      </div>
                      <ul className="mt-2.5 space-y-1 text-[11px] text-[#182238] dark:text-slate-300">
                        {plan.highlights.map((h) => (
                          <li key={h}>· {h}</li>
                        ))}
                      </ul>
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedTier !== 'free' && (
              <div className="pt-3 border-t border-slate-200 dark:border-[#223257]">
                <label className="block text-xs font-medium text-[#182238] dark:text-slate-200 mb-1.5">
                  BakeWeb Commercial License Key (Optional for 14-Day Evaluation)
                </label>
                <input
                  type="text"
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                  placeholder={`WDR-${selectedTier.toUpperCase()}-XXXX-XXXX`}
                  className="w-full max-w-md h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257] focus:outline-none focus:ring-2 focus:ring-[#4169F5]"
                />
              </div>
            )}
          </Surface>
        )}

        {/* Step 4: Cloud & Identity */}
        {step === 4 && (
          <Surface padding="lg" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-[#182238] dark:text-slate-100">
                  04. Connect Your Own Database & Keys (Post-Deploy)
                </h2>
                <p className="text-xs text-[#718096] dark:text-slate-400 mt-0.5">
                  Because WENDORO is open-source, no vendor keys or shared databases are
                  shipped in the repository. Run standalone now or attach your own backend
                  after deployment.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void checkServerStatus()}
                disabled={serverProbe.checking}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${serverProbe.checking ? 'animate-spin' : ''}`} />
                {serverProbe.checking ? 'Checking...' : 'Check Server Readiness'}
              </Button>
            </div>

            {/* Deployment Infrastructure Selector */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                {
                  id: 'standalone' as const,
                  title: 'Standalone Mode',
                  desc: 'Start immediately in your browser with zero external database or keys.',
                  icon: Layers,
                },
                {
                  id: 'cloudflare-neon' as const,
                  title: 'Cloudflare + PostgreSQL',
                  desc: 'Add DATABASE_URL, Hyperdrive & secrets in Cloudflare Dashboard after deploy.',
                  icon: Cloud,
                },
                {
                  id: 'docker-postgres' as const,
                  title: 'Docker / Self-Hosted VPS',
                  desc: 'Boot PostgreSQL 16 + Node 24 Express server with .env on your own host.',
                  icon: Server,
                },
              ].map((option) => {
                const Icon = option.icon;
                const active = infraMode === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setInfraMode(option.id)}
                    aria-pressed={active}
                    className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                      active
                        ? 'border-[#4169F5] ring-1 ring-[#4169F5] bg-[#4169F5]/5 dark:bg-[#4169F5]/10'
                        : 'border-slate-200 dark:border-[#223257] bg-[#F6F8FC]/60 dark:bg-[#0E172E]'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#182238] dark:text-slate-100">
                      <Icon className="h-4 w-4 text-[#4169F5]" />
                      <span>{option.title}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-[#718096] dark:text-slate-400 leading-relaxed">
                      {option.desc}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Left: Database & Server Secrets Binding Guide */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-[#223257] bg-[#F6F8FC]/70 dark:bg-[#0E172E] space-y-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#182238] dark:text-slate-100">
                    <Database className="h-4 w-4 text-[#8B5CF6]" />
                    <span>PostgreSQL & Server Secrets</span>
                  </div>
                  <div className="inline-flex items-center gap-1 p-0.5 rounded-md bg-slate-200/70 dark:bg-[#162342]">
                    {(['neon', 'supabase', 'postgres-self'] as const).map((prov) => (
                      <button
                        key={prov}
                        type="button"
                        onClick={() => setDbProvider(prov)}
                        className={`px-2 py-0.5 text-[11px] font-medium rounded cursor-pointer ${
                          dbProvider === prov
                            ? 'bg-white dark:bg-[#101B35] text-[#182238] dark:text-slate-100'
                            : 'text-[#718096] dark:text-slate-400'
                        }`}
                      >
                        {prov === 'neon' ? 'Neon' : prov === 'supabase' ? 'Supabase' : 'Self-Hosted'}
                      </button>
                    ))}
                  </div>
                </div>

                {infraMode === 'standalone' ? (
                  <p className="text-xs text-[#718096] dark:text-slate-400 leading-relaxed">
                    You are launching in <strong>Standalone Mode</strong>. Your company
                    profile, modules, and evaluation workspace save cleanly in this browser
                    with no database required. Switch to Cloudflare or Docker anytime later.
                  </p>
                ) : (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-[#101B35] text-slate-100 font-mono text-[11px]">
                        <span className="truncate">{migrationCommand}</span>
                        <button
                          type="button"
                          onClick={() => void copyCommand('mig', migrationCommand)}
                          className="text-slate-300 hover:text-white shrink-0 cursor-pointer"
                          aria-label="Copy migration command"
                        >
                          {copiedCmd === 'mig' ? (
                            <Check className="h-3.5 w-3.5 text-[#16B8A6]" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-[#101B35] text-slate-100 font-mono text-[11px]">
                        <span className="truncate">
                          {infraMode === 'cloudflare-neon'
                            ? cloudflareSecretsCommand
                            : dockerCommand}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            void copyCommand(
                              'infra',
                              infraMode === 'cloudflare-neon'
                                ? cloudflareSecretsCommand
                                : dockerCommand,
                            )
                          }
                          className="text-slate-300 hover:text-white shrink-0 cursor-pointer"
                          aria-label="Copy deployment secret command"
                        >
                          {copiedCmd === 'infra' ? (
                            <Check className="h-3.5 w-3.5 text-[#16B8A6]" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          downloadTemplateFile(
                            `${safeDbSlug}.env.example`,
                            envTemplateContent,
                            'text/plain',
                          )
                        }
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download .env Template
                      </Button>
                      <span className="text-[11px] text-[#718096] dark:text-slate-400">
                        Add secrets in Cloudflare Dashboard or server `.env` — never in browser UI.
                      </span>
                    </div>
                  </>
                )}

                {serverProbe.checkedAt && (
                  <div className="pt-2.5 border-t border-slate-200 dark:border-[#223257] text-[11px] space-y-1">
                    <div className="flex justify-between text-[#718096] dark:text-slate-400">
                      <span>Detected Runtime ({serverProbe.checkedAt})</span>
                      <span className="font-mono text-[#182238] dark:text-slate-200">
                        {serverProbe.mode === 'node-express' ? 'Node Express Server' : 'Static Edge SPA'}
                      </span>
                    </div>
                    {serverProbe.mode === 'node-express' && (
                      <div className="flex flex-wrap gap-x-4 gap-y-1 pt-0.5">
                        <span>
                          DB:{' '}
                          <strong className={serverProbe.databaseConfigured ? 'text-[#16B8A6]' : 'text-[#718096]'}>
                            {serverProbe.databaseConfigured ? 'Connected' : 'Pending'}
                          </strong>
                        </span>
                        <span>
                          Auth Secret:{' '}
                          <strong className={serverProbe.authSecretConfigured ? 'text-[#16B8A6]' : 'text-[#718096]'}>
                            {serverProbe.authSecretConfigured ? 'Set' : 'Pending'}
                          </strong>
                        </span>
                        <span>
                          AI Key:{' '}
                          <strong className={serverProbe.aiGatewayConfigured ? 'text-[#16B8A6]' : 'text-[#718096]'}>
                            {serverProbe.aiGatewayConfigured ? 'Set' : 'Optional'}
                          </strong>
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right: Firebase Auth & Firestore Realtime */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-[#223257] bg-[#F6F8FC]/70 dark:bg-[#0E172E] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#182238] dark:text-slate-100">
                    Firebase Auth & Firestore Realtime (Optional)
                  </span>
                  <span className="text-xs font-medium text-[#16B8A6] capitalize">
                    {isConfigured ? connectionState : 'Standalone Mode'}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-[#718096] dark:text-slate-400 space-y-1">
                  <div>project_id: {projectId}</div>
                  <div className="truncate">database_id: {firestoreDatabaseId}</div>
                </div>
                <div className="pt-1 space-y-2.5">
                  {!isConfigured ? (
                    <>
                      <p className="text-xs text-[#718096] dark:text-slate-400 leading-relaxed">
                        No Firebase project is bundled in the public repo. When you want
                        Google Sign-In & Firestore presence, add{' '}
                        <code className="font-mono text-[11px] text-[#182238] dark:text-slate-200">
                          VITE_FIREBASE_*
                        </code>{' '}
                        in your Cloudflare/CI build settings or use{' '}
                        <code className="font-mono text-[11px] text-[#182238] dark:text-slate-200">
                          firebase-applet-config.json
                        </code>{' '}
                        locally.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          downloadTemplateFile(
                            'firebase-applet-config.json',
                            firebaseTemplateContent,
                            'application/json',
                          )
                        }
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download Firebase Config Template
                      </Button>
                    </>
                  ) : user ? (
                    <div className="flex items-center gap-2 text-xs font-medium text-[#16B8A6]">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Connected as {user.email}</span>
                    </div>
                  ) : (
                    <Button variant="primary" size="sm" onClick={() => void signInWithGoogle()}>
                      Connect Google Admin Account
                    </Button>
                  )}
                  {authError && (
                    <p className="text-xs text-red-600 dark:text-red-400">{authError}</p>
                  )}
                </div>
              </div>
            </div>
          </Surface>
        )}

        {/* Step 5: Review & Launch */}
        {step === 5 && (
          <Surface padding="lg" className="space-y-5">
            <div>
              <h2 className="text-base font-semibold text-[#182238] dark:text-slate-100">
                05. Review Configuration & Launch Workspace
              </h2>
              <p className="text-xs text-[#718096] dark:text-slate-400 mt-0.5">
                Confirm your company isolation boundaries and module activations before launching.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div className="p-3.5 rounded-lg border border-slate-200 dark:border-[#223257]">
                <div className="text-[#718096] dark:text-slate-400">Company & Region</div>
                <div className="mt-1 font-semibold text-sm text-[#182238] dark:text-slate-100">
                  {companyName}
                </div>
                <div className="mt-0.5 font-mono text-[#718096] dark:text-slate-400">
                  {companyCode} · {region.countryCode} · {region.currency}
                </div>
                {taxNumber && (
                  <div className="mt-0.5 font-mono text-[#16B8A6]">Tax ID: {taxNumber}</div>
                )}
              </div>

              <div className="p-3.5 rounded-lg border border-slate-200 dark:border-[#223257]">
                <div className="text-[#718096] dark:text-slate-400">Headquarters Branch</div>
                <div className="mt-1 font-semibold text-sm text-[#182238] dark:text-slate-100">
                  {branchName}
                </div>
                <div className="mt-0.5 font-mono text-[#718096] dark:text-slate-400">
                  {branchCode} · {branchCity}
                </div>
              </div>

              <div className="p-3.5 rounded-lg border border-slate-200 dark:border-[#223257]">
                <div className="text-[#718096] dark:text-slate-400">Edition & Quotas</div>
                <div className="mt-1 font-semibold text-sm text-[#182238] dark:text-slate-100">
                  {selectedPlan.name}
                </div>
                <div className="mt-0.5 text-[#718096] dark:text-slate-400">
                  {enabledModules.length + 2} Active Modules · Max {selectedPlan.maxUsers} Users
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

          {step < 5 ? (
            <Button variant="primary" size="md" onClick={handleNext}>
              Continue
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="primary"
              size="md"
              disabled={launching}
              onClick={() => void handleLaunch()}
            >
              {launching ? 'Provisioning Workspace...' : 'Complete Setup & Launch Workspace'}
              <CheckCircle2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
