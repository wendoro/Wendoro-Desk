import React, { useRef, useState } from 'react';
import {
  Building2,
  Check,
  CloudUpload,
  Database,
  Download,
  KeyRound,
  Layers,
  Lock,
  MapPin,
  Plus,
  RotateCcw,
  ShieldCheck,
  Store,
  Trash2,
  Upload,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { Surface } from '@/src/components/ui/Surface';
import { useToast } from '@/src/components/ui/ToastProvider';
import { useErpData } from '@/src/components/shell/ErpDataProvider';
import { useTenant } from '@/src/components/shell/TenantProvider';
import {
  USER_TYPE_PROFILES,
  getMarketplaceEntry,
  getUserTypeProfile,
} from '@/src/core/contracts/marketplace';
import { WENDORO_MODULES } from '@/src/core/registry/modules';
import { DesignSystemView } from '@/src/features/foundation/DesignSystemView';
import { IdentityTenancyView } from '@/src/features/foundation/IdentityTenancyView';
import { MilestonePlanView } from '@/src/features/foundation/MilestonePlanView';
import { SchemaExplorerView } from '@/src/features/foundation/SchemaExplorerView';
import { formatNumericCurrency } from '@/src/lib/utils';

export type AdminTabId = 'modules' | 'org' | 'data' | 'architecture';
export type ArchSubTabId = 'schema' | 'identity' | 'design' | 'milestone';

export function SystemAdminView({
  onNavigate,
  initialTab = 'modules',
  initialArchTab = 'schema',
}: {
  onNavigate: (routeId: string) => void;
  initialTab?: AdminTabId;
  initialArchTab?: ArchSubTabId;
}) {
  const {
    principal,
    activeCompany,
    activeUserType,
    licenseKey,
    licenseActivation,
    purchasedModules,
    isModuleEntitled,
    setCompanyUserType,
    clearLicenseActivation,
    switchCompany,
    addBranchToActiveCompany,
    toggleCompanyModule,
    resetSetupWizard,
  } = useTenant();
  const {
    storageMode,
    syncState,
    data,
    exportCompanyBackupJson,
    importCompanyBackupJson,
    clearActiveCompanyData,
  } = useErpData();
  const { pushToast } = useToast();

  const [tab, setTab] = useState<AdminTabId>(initialTab);
  const [archTab, setArchTab] = useState<ArchSubTabId>(initialArchTab);

  // Branch Form
  const [branchCode, setBranchCode] = useState('');
  const [branchName, setBranchName] = useState('');
  const [branchCity, setBranchCity] = useState('');

  // Backup / Reset States
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [confirmClearData, setConfirmClearData] = useState(false);
  const [confirmResetWizard, setConfirmResetWizard] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const businessModules = WENDORO_MODULES.filter((m) => m.layer === 'business');
  const industryModules = WENDORO_MODULES.filter((m) => m.layer === 'industry');
  const activeUserProfile = getUserTypeProfile(activeUserType);
  const currency: 'INR' | 'USD' = activeCompany.baseCurrency === 'INR' ? 'INR' : 'USD';

  const handleModuleCardClick = (slug: string, name: string) => {
    const ok = toggleCompanyModule(slug);
    if (!ok) {
      pushToast({
        variant: 'info',
        category: 'system',
        title: `${name} Requires Marketplace Purchase`,
        description: 'Opening the Module Marketplace so you can add this module to your license.',
        durationMs: 3500,
      });
      onNavigate('marketplace');
    }
  };

  const handleAddBranch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchCode.trim() || !branchName.trim()) return;
    addBranchToActiveCompany({
      code: branchCode,
      name: branchName,
      city: branchCity,
    });
    setBranchCode('');
    setBranchName('');
    setBranchCity('');
  };

  const handleDownloadBackup = () => {
    const json = exportCompanyBackupJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wendoro-${activeCompany.companyCode.toLowerCase()}-backup.json`;
    a.click();
    URL.revokeObjectURL(url);
    setBackupError(null);
    const msg = `Exported backup JSON for ${activeCompany.companyName}.`;
    setBackupMessage(msg);
    pushToast({
      variant: 'success',
      category: 'export',
      title: 'JSON Backup Exported',
      description: msg,
    });
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBackupError(null);
    setBackupMessage(null);
    try {
      const text = await file.text();
      const { importedCount } = importCompanyBackupJson(text);
      const msg = `Imported ${importedCount} operational records into ${activeCompany.companyName}.`;
      setBackupMessage(msg);
      pushToast({
        variant: 'success',
        category: 'system',
        title: 'Backup Restored to IndexedDB',
        description: msg,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unable to parse backup JSON file.';
      setBackupError(errMsg);
      pushToast({
        variant: 'error',
        category: 'system',
        title: 'Backup Import Failed',
        description: errMsg,
      });
    } finally {
      e.target.value = '';
    }
  };

  const totalRecordsCount =
    data.catalogue.length +
    data.contacts.length +
    data.salesOrders.length +
    data.purchaseOrders.length +
    data.stockMovements.length +
    data.journals.length +
    data.employees.length +
    data.projectTasks.length +
    data.supportTickets.length +
    data.documents.length +
    data.campaigns.length +
    data.industryRecords.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1C1917] dark:text-slate-100">
            Modules & Workspace Settings
          </h1>
          <p className="mt-1 text-xs text-[#718096] dark:text-slate-400">
            Activate business applications, manage branches, export backups, or inspect platform architecture.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => onNavigate('setup')}>
          <Plus className="h-3.5 w-3.5" />
          New Company Setup
        </Button>
      </div>

      {/* Primary Admin Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 dark:border-[#32242A] pb-3">
        {(
          [
            { id: 'modules', label: 'Modules & Licensing', icon: Layers },
            { id: 'org', label: 'Companies & Branches', icon: Building2 },
            { id: 'data', label: 'Data & Backups', icon: Database },
            { id: 'architecture', label: 'Platform Architecture', icon: ShieldCheck },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`inline-flex items-center gap-2 h-8 px-3 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                active
                  ? 'bg-[#DC2626] text-white'
                  : 'text-[#718096] dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#251B20]'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: MODULES & LICENSING */}
      {tab === 'modules' && (
        <div className="space-y-6">
          <Surface padding="md" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-[#FAF9F7] dark:bg-[#141013] border border-slate-200 dark:border-[#32242A] flex items-center justify-center shrink-0">
                <KeyRound className="h-4 w-4 text-[#DC2626]" />
              </div>
              <div>
                <div className="text-sm font-semibold text-[#1C1917] dark:text-slate-100 capitalize">
                  Active Plan: {principal.subscriptionTier.replace('_', ' ')} Edition · {activeUserProfile.shortLabel}
                </div>
                <div className="text-xs text-[#718096] dark:text-slate-400">
                  {licenseActivation
                    ? `Verified Key (${licenseActivation.licenseKey}) · ${purchasedModules.length} Marketplace add-on(s) · ${licenseActivation.usedDevices}/${licenseActivation.maxDevices} devices`
                    : licenseKey
                      ? `License Key Entered (${licenseKey}) · Activate on Setup Wizard to bind device`
                      : 'No license key activated yet — open Setup & License to register or activate your key.'}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary" size="sm" onClick={() => onNavigate('marketplace')}>
                <Store className="h-3.5 w-3.5" />
                Open Marketplace
              </Button>
              <Button variant="outline" size="sm" onClick={() => clearLicenseActivation()}>
                <Lock className="h-3.5 w-3.5 text-[#DC2626]" />
                Lock & Re-Verify
              </Button>
              <Button variant="outline" size="sm" onClick={() => onNavigate('setup')}>
                Manage License
              </Button>
            </div>
          </Surface>

          {/* Business User Type Switcher */}
          <Surface padding="md" className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-[#1C1917] dark:text-slate-100">
                User Type Profile ({activeUserProfile.title})
              </div>
              <div className="text-[11px] text-[#718096] dark:text-slate-400">
                Tailors Marketplace recommendations and module starter bundles for {activeCompany.companyName}.
              </div>
            </div>
            <select
              aria-label="Select business user type"
              value={activeUserType}
              onChange={(e) => setCompanyUserType(e.target.value as typeof activeUserType)}
              className="h-9 px-3 rounded-lg text-xs font-medium bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A] text-[#1C1917] dark:text-slate-100"
            >
              {USER_TYPE_PROFILES.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.title}
                </option>
              ))}
            </select>
          </Surface>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-[#1C1917] dark:text-slate-100">
              Layer B · Business Applications
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {businessModules.map((mod) => {
                const entitled = isModuleEntitled(mod.slug);
                const enabled = entitled && activeCompany.enabledModules.includes(mod.slug);
                const listing = getMarketplaceEntry(mod.slug)?.listing;
                const priceText = listing
                  ? formatNumericCurrency(
                      currency === 'INR' ? listing.priceInr : listing.priceUsd,
                      currency,
                      0,
                    )
                  : '';

                return (
                  <button
                    key={mod.slug}
                    type="button"
                    onClick={() => handleModuleCardClick(mod.slug, mod.name)}
                    className={`text-left p-4 rounded-xl border transition-colors cursor-pointer flex items-start justify-between gap-3 ${
                      enabled
                        ? 'bg-white dark:bg-[#1B1417] border-[#DC2626]'
                        : entitled
                          ? 'bg-[#FAF9F7]/60 dark:bg-[#141013]/70 border-slate-200 dark:border-[#32242A] hover:border-[#DC2626]/60'
                          : 'bg-[#FAF9F7]/40 dark:bg-[#141013]/50 border-slate-200 dark:border-[#32242A] opacity-80 hover:opacity-100 hover:border-[#F59E0B]'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[#1C1917] dark:text-slate-100">
                        {mod.name}
                      </div>
                      <p className="mt-1 text-xs text-[#718096] dark:text-slate-400 line-clamp-2">
                        {mod.description}
                      </p>
                      <div className="mt-2 text-[11px] font-mono text-[#57534E] dark:text-stone-400">
                        {!entitled
                          ? `Marketplace Add-On · ${priceText}`
                          : enabled
                            ? 'Licensed & Installed'
                            : 'Licensed · Click to Install'}
                      </div>
                    </div>
                    <span
                      className={`h-5 w-5 rounded-md border flex items-center justify-center shrink-0 ${
                        enabled
                          ? 'bg-[#DC2626] border-[#DC2626] text-white'
                          : !entitled
                            ? 'border-amber-400/60 text-[#D97706] dark:text-[#FACC15]'
                            : 'border-slate-300 dark:border-[#3A2B31]'
                      }`}
                    >
                      {enabled ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : !entitled ? (
                        <Lock className="h-3 w-3" />
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-[#1C1917] dark:text-slate-100">
              Layer C · Industry Application Packages
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {industryModules.map((mod) => {
                const entitled = isModuleEntitled(mod.slug);
                const enabled = entitled && activeCompany.enabledModules.includes(mod.slug);
                const listing = getMarketplaceEntry(mod.slug)?.listing;
                const priceText = listing
                  ? formatNumericCurrency(
                      currency === 'INR' ? listing.priceInr : listing.priceUsd,
                      currency,
                      0,
                    )
                  : '';

                return (
                  <button
                    key={mod.slug}
                    type="button"
                    onClick={() => handleModuleCardClick(mod.slug, mod.name)}
                    className={`text-left p-4 rounded-xl border transition-colors cursor-pointer flex items-start justify-between gap-3 ${
                      enabled
                        ? 'bg-white dark:bg-[#1B1417] border-[#F59E0B]'
                        : entitled
                          ? 'bg-[#FAF9F7]/60 dark:bg-[#141013]/70 border-slate-200 dark:border-[#32242A] hover:border-[#F59E0B]'
                          : 'bg-[#FAF9F7]/40 dark:bg-[#141013]/50 border-slate-200 dark:border-[#32242A] opacity-80 hover:opacity-100 hover:border-[#F59E0B]'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[#1C1917] dark:text-slate-100">
                        {mod.name}
                      </div>
                      <p className="mt-1 text-xs text-[#718096] dark:text-slate-400 line-clamp-2">
                        {mod.description}
                      </p>
                      <div className="mt-2 text-[11px] font-mono text-[#57534E] dark:text-stone-400">
                        {!entitled
                          ? `Marketplace Add-On · ${priceText}`
                          : enabled
                            ? 'Licensed & Installed'
                            : 'Licensed · Click to Install'}
                      </div>
                    </div>
                    <span
                      className={`h-5 w-5 rounded-md border flex items-center justify-center shrink-0 ${
                        enabled
                          ? 'bg-[#F59E0B] border-[#F59E0B] text-white'
                          : !entitled
                            ? 'border-amber-400/60 text-[#D97706] dark:text-[#FACC15]'
                            : 'border-slate-300 dark:border-[#3A2B31]'
                      }`}
                    >
                      {enabled ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : !entitled ? (
                        <Lock className="h-3 w-3" />
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* TAB 2: COMPANIES & BRANCHES */}
      {tab === 'org' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Surface padding="lg" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#1C1917] dark:text-slate-100">
                Registered Companies ({principal.memberships.length})
              </h2>
              <Button variant="outline" size="sm" onClick={() => onNavigate('setup')}>
                <Plus className="h-3.5 w-3.5" />
                Add Company
              </Button>
            </div>
            <div className="space-y-2">
              {principal.memberships.map((m) => {
                const isActive = m.companyId === activeCompany.companyId;
                return (
                  <div
                    key={m.companyId}
                    className={`p-3 rounded-lg border flex items-center justify-between gap-3 ${
                      isActive
                        ? 'border-[#DC2626] bg-[#FEF2F2]/70 dark:bg-[#251B20]'
                        : 'border-slate-200 dark:border-[#32242A]'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[#1C1917] dark:text-slate-100 truncate">
                        {m.companyName}
                      </div>
                      <div className="text-xs text-[#718096] dark:text-slate-400">
                        {m.companyCode} · {m.baseCurrency} · {m.countryCode} ·{' '}
                        {m.branches.length} branches
                      </div>
                    </div>
                    {isActive ? (
                      <span className="text-xs font-semibold text-[#DC2626] shrink-0">
                        Active
                      </span>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => switchCompany(m.companyId)}
                      >
                        Switch
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </Surface>

          <Surface padding="lg" className="space-y-4">
            <h2 className="text-sm font-semibold text-[#1C1917] dark:text-slate-100">
              Branches for {activeCompany.companyName}
            </h2>
            <div className="space-y-2">
              {activeCompany.branches.map((b) => (
                <div
                  key={b.id}
                  className="p-3 rounded-lg border border-slate-200 dark:border-[#32242A] flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <MapPin className="h-4 w-4 text-[#16B8A6] shrink-0" />
                    <div>
                      <div className="font-semibold text-[#1C1917] dark:text-slate-100">
                        {b.name}
                      </div>
                      <div className="text-[#718096] dark:text-slate-400 font-mono">
                        {b.code} · {b.city ?? b.countryCode}
                      </div>
                    </div>
                  </div>
                  {b.isHeadquarters && (
                    <span className="text-[11px] font-medium text-[#16B8A6]">HQ</span>
                  )}
                </div>
              ))}
            </div>

            <form onSubmit={handleAddBranch} className="pt-3 border-t border-slate-200 dark:border-[#32242A] space-y-3">
              <div className="text-xs font-semibold text-[#1C1917] dark:text-slate-100">
                Add Branch Location
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  required
                  value={branchCode}
                  onChange={(e) => setBranchCode(e.target.value)}
                  placeholder="Code (e.g. BLR-02)"
                  className="h-9 px-3 rounded-lg text-xs font-mono uppercase bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
                <input
                  type="text"
                  required
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  placeholder="Branch Name"
                  className="h-9 px-3 rounded-lg text-xs bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
                <input
                  type="text"
                  value={branchCity}
                  onChange={(e) => setBranchCity(e.target.value)}
                  placeholder="City"
                  className="h-9 px-3 rounded-lg text-xs bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
              </div>
              <Button type="submit" variant="primary" size="sm">
                <Plus className="h-3.5 w-3.5" />
                Add Branch
              </Button>
            </form>
          </Surface>
        </div>
      )}

      {/* TAB 3: DATA & BACKUPS */}
      {tab === 'data' && (
        <div className="space-y-5">
          {backupMessage && (
            <Surface padding="sm" className="text-xs font-medium text-[#16B8A6]">
              {backupMessage}
            </Surface>
          )}
          {backupError && (
            <Surface padding="sm" className="text-xs font-medium text-red-600">
              {backupError}
            </Surface>
          )}

          {/* Offline IndexedDB (Dexie.js) & Sync Engine Status */}
          <Surface padding="lg" className="space-y-4 border-[#DC2626]/20 dark:border-[#FACC15]/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-[#DC2626]/10 text-[#DC2626] dark:bg-[#FACC15]/15 dark:text-[#FACC15] flex items-center justify-center shrink-0">
                  {syncState.isOnline ? (
                    <Wifi className="h-4 w-4" />
                  ) : (
                    <WifiOff className="h-4 w-4" />
                  )}
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-[#1C1917] dark:text-slate-100">
                    Offline IndexedDB (Dexie.js) &amp; Sync Engine
                  </h2>
                  <p className="text-xs text-[#718096] dark:text-slate-400">
                    All CRM contacts, accounting journals, and inventory records persist locally on this device and synchronize only when a network connection is available.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={!syncState.isOnline || syncState.status === 'syncing' || syncState.pendingCount === 0}
                onClick={() => void syncState.triggerSync()}
              >
                <CloudUpload className="h-3.5 w-3.5 text-[#DC2626]" />
                {syncState.status === 'syncing'
                  ? 'Syncing...'
                  : syncState.pendingCount > 0
                    ? `Sync Queued (${syncState.pendingCount})`
                    : 'All Synced'}
              </Button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-[#FAF9F7] dark:bg-[#141013] border border-slate-200/80 dark:border-[#32242A]">
                <div className="text-[11px] text-[#718096] dark:text-slate-400">Storage Engine</div>
                <div className="mt-1 font-semibold font-mono text-[#1C1917] dark:text-slate-100">
                  {storageMode === 'indexeddb-dexie' ? 'IndexedDB (Dexie.js)' : storageMode}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-[#FAF9F7] dark:bg-[#141013] border border-slate-200/80 dark:border-[#32242A]">
                <div className="text-[11px] text-[#718096] dark:text-slate-400">Connectivity</div>
                <div className="mt-1 font-semibold text-[#1C1917] dark:text-slate-100">
                  {syncState.isOnline ? 'Online · Auto-Sync Active' : 'Offline · Local Queueing'}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-[#FAF9F7] dark:bg-[#141013] border border-slate-200/80 dark:border-[#32242A]">
                <div className="text-[11px] text-[#718096] dark:text-slate-400">Pending Outbox Queue</div>
                <div className="mt-1 font-semibold font-mono text-[#1C1917] dark:text-slate-100">
                  {syncState.pendingCount} batch(es)
                </div>
              </div>
              <div className="p-3 rounded-lg bg-[#FAF9F7] dark:bg-[#141013] border border-slate-200/80 dark:border-[#32242A]">
                <div className="text-[11px] text-[#718096] dark:text-slate-400">Last Synced</div>
                <div className="mt-1 font-semibold font-mono text-[#1C1917] dark:text-slate-100">
                  {syncState.lastSyncedAt
                    ? new Date(syncState.lastSyncedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })
                    : 'Not synced yet'}
                </div>
              </div>
            </div>

            {syncState.lastSyncError && (
              <div className="rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/20 px-3 py-2 text-xs text-red-700 dark:text-red-300">
                Last sync warning: {syncState.lastSyncError}
              </div>
            )}
          </Surface>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Surface padding="lg" className="space-y-4">
              <h2 className="text-sm font-semibold text-[#1C1917] dark:text-slate-100">
                Export & Restore ({activeCompany.companyName})
              </h2>
              <p className="text-xs text-[#718096] dark:text-slate-400">
                All operational records ({totalRecordsCount} total records in this company) can be exported as portable JSON or restored anytime.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="primary" size="sm" onClick={handleDownloadBackup}>
                  <Download className="h-3.5 w-3.5" />
                  Export JSON Backup
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Import JSON Backup
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json,.json"
                  onChange={handleImportFile}
                  className="hidden"
                />
              </div>
            </Surface>

            <Surface padding="lg" className="space-y-4">
              <h2 className="text-sm font-semibold text-[#1C1917] dark:text-slate-100">
                Workspace Reset Controls
              </h2>
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border border-slate-200 dark:border-[#32242A]">
                  <div>
                    <div className="text-xs font-semibold">Clear Active Company Records</div>
                    <div className="text-[11px] text-[#718096] dark:text-slate-400">
                      Removes catalogue, orders, stock movements, and ledger entries for {activeCompany.companyName}.
                    </div>
                  </div>
                  {confirmClearData ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setConfirmClearData(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          clearActiveCompanyData();
                          setConfirmClearData(false);
                          const msg = `Cleared operational records for ${activeCompany.companyName}.`;
                          setBackupMessage(msg);
                          pushToast({
                            variant: 'warning',
                            category: 'alert',
                            title: 'Company Records Cleared',
                            description: msg,
                          });
                        }}
                      >
                        Confirm Clear
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmClearData(true)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Clear Data
                    </Button>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border border-slate-200 dark:border-[#32242A]">
                  <div>
                    <div className="text-xs font-semibold">Re-run Setup Wizard from Scratch</div>
                    <div className="text-[11px] text-[#718096] dark:text-slate-400">
                      Resets local company configuration and re-opens the onboarding wizard.
                    </div>
                  </div>
                  {confirmResetWizard ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setConfirmResetWizard(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          resetSetupWizard();
                          setConfirmResetWizard(false);
                        }}
                      >
                        Confirm Reset
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmResetWizard(true)}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Reset Setup
                    </Button>
                  )}
                </div>
              </div>
            </Surface>
          </div>
        </div>
      )}

      {/* TAB 4: PLATFORM ARCHITECTURE & SPECS */}
      {tab === 'architecture' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { id: 'schema', label: 'PostgreSQL Schema & RLS' },
                { id: 'identity', label: 'Identity & Multi-Tenancy' },
                { id: 'design', label: 'Design Tokens & Components' },
                { id: 'milestone', label: 'Roadmap & Gates' },
              ] as const
            ).map((sub) => (
              <button
                key={sub.id}
                type="button"
                onClick={() => setArchTab(sub.id)}
                className={`h-8 px-3 rounded-lg text-xs font-medium border cursor-pointer transition-colors ${
                  archTab === sub.id
                    ? 'bg-[#1B1417] text-white border-[#1B1417] dark:bg-[#DC2626] dark:border-[#DC2626]'
                    : 'bg-white dark:bg-[#1B1417] border-slate-200 dark:border-[#32242A] text-[#1C1917] dark:text-slate-200'
                }`}
              >
                {sub.label}
              </button>
            ))}
          </div>

          {archTab === 'schema' && <SchemaExplorerView />}
          {archTab === 'identity' && <IdentityTenancyView />}
          {archTab === 'design' && <DesignSystemView />}
          {archTab === 'milestone' && <MilestonePlanView />}
        </div>
      )}
    </div>
  );
}
