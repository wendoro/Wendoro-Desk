import React, { useRef, useState } from 'react';
import {
  Building2,
  Check,
  Database,
  Download,
  KeyRound,
  Layers,
  MapPin,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { Surface } from '@/src/components/ui/Surface';
import { useErpData } from '@/src/components/shell/ErpDataProvider';
import { useTenant } from '@/src/components/shell/TenantProvider';
import { WENDORO_MODULES } from '@/src/core/registry/modules';
import { DesignSystemView } from '@/src/features/foundation/DesignSystemView';
import { IdentityTenancyView } from '@/src/features/foundation/IdentityTenancyView';
import { MilestonePlanView } from '@/src/features/foundation/MilestonePlanView';
import { SchemaExplorerView } from '@/src/features/foundation/SchemaExplorerView';

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
    licenseKey,
    switchCompany,
    addBranchToActiveCompany,
    toggleCompanyModule,
    resetSetupWizard,
  } = useTenant();
  const {
    data,
    exportCompanyBackupJson,
    importCompanyBackupJson,
    clearActiveCompanyData,
  } = useErpData();

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
    setBackupMessage(`Exported backup JSON for ${activeCompany.companyName}.`);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBackupError(null);
    setBackupMessage(null);
    try {
      const text = await file.text();
      const { importedCount } = importCompanyBackupJson(text);
      setBackupMessage(
        `Imported ${importedCount} operational records into ${activeCompany.companyName}.`,
      );
    } catch (err) {
      setBackupError(
        err instanceof Error ? err.message : 'Unable to parse backup JSON file.',
      );
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
    data.ledgerEntries.length +
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
          <h1 className="text-2xl font-bold tracking-tight text-[#182238] dark:text-slate-100">
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
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 dark:border-[#223257] pb-3">
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
                  ? 'bg-[#4169F5] text-white'
                  : 'text-[#718096] dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#162342]'
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
              <div className="h-9 w-9 rounded-lg bg-[#F6F8FC] dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257] flex items-center justify-center shrink-0">
                <KeyRound className="h-4 w-4 text-[#4169F5]" />
              </div>
              <div>
                <div className="text-sm font-semibold text-[#182238] dark:text-slate-100 capitalize">
                  Active Plan: {principal.subscriptionTier} Edition
                </div>
                <div className="text-xs text-[#718096] dark:text-slate-400">
                  {licenseKey
                    ? `Commercial License Key Active (${licenseKey.slice(0, 8)}...)`
                    : 'MIT Open Source Core — self-hosted with all standard ERP modules unlocked.'}
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => onNavigate('setup')}>
              Configure Plan / Company
            </Button>
          </Surface>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-[#182238] dark:text-slate-100">
              Layer B · Business Applications
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {businessModules.map((mod) => {
                const enabled = activeCompany.enabledModules.includes(mod.slug);
                return (
                  <button
                    key={mod.slug}
                    type="button"
                    onClick={() => toggleCompanyModule(mod.slug)}
                    className={`text-left p-4 rounded-xl border transition-colors cursor-pointer flex items-start justify-between gap-3 ${
                      enabled
                        ? 'bg-white dark:bg-[#101B35] border-[#4169F5]'
                        : 'bg-[#F6F8FC]/60 dark:bg-[#0E172E]/70 border-slate-200 dark:border-[#223257] opacity-80 hover:opacity-100'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[#182238] dark:text-slate-100">
                        {mod.name}
                      </div>
                      <p className="mt-1 text-xs text-[#718096] dark:text-slate-400 line-clamp-2">
                        {mod.description}
                      </p>
                    </div>
                    <span
                      className={`h-5 w-5 rounded-md border flex items-center justify-center shrink-0 ${
                        enabled
                          ? 'bg-[#4169F5] border-[#4169F5] text-white'
                          : 'border-slate-300 dark:border-[#2B3E6B]'
                      }`}
                    >
                      {enabled && <Check className="h-3.5 w-3.5" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-[#182238] dark:text-slate-100">
              Layer C · Industry Application Packages
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {industryModules.map((mod) => {
                const enabled = activeCompany.enabledModules.includes(mod.slug);
                return (
                  <button
                    key={mod.slug}
                    type="button"
                    onClick={() => toggleCompanyModule(mod.slug)}
                    className={`text-left p-4 rounded-xl border transition-colors cursor-pointer flex items-start justify-between gap-3 ${
                      enabled
                        ? 'bg-white dark:bg-[#101B35] border-[#8B5CF6]'
                        : 'bg-[#F6F8FC]/60 dark:bg-[#0E172E]/70 border-slate-200 dark:border-[#223257] opacity-80 hover:opacity-100'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[#182238] dark:text-slate-100">
                        {mod.name}
                      </div>
                      <p className="mt-1 text-xs text-[#718096] dark:text-slate-400 line-clamp-2">
                        {mod.description}
                      </p>
                    </div>
                    <span
                      className={`h-5 w-5 rounded-md border flex items-center justify-center shrink-0 ${
                        enabled
                          ? 'bg-[#8B5CF6] border-[#8B5CF6] text-white'
                          : 'border-slate-300 dark:border-[#2B3E6B]'
                      }`}
                    >
                      {enabled && <Check className="h-3.5 w-3.5" />}
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
              <h2 className="text-sm font-semibold text-[#182238] dark:text-slate-100">
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
                        ? 'border-[#4169F5] bg-[#EFF3FA]/60 dark:bg-[#162342]'
                        : 'border-slate-200 dark:border-[#223257]'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[#182238] dark:text-slate-100 truncate">
                        {m.companyName}
                      </div>
                      <div className="text-xs text-[#718096] dark:text-slate-400">
                        {m.companyCode} · {m.baseCurrency} · {m.countryCode} ·{' '}
                        {m.branches.length} branches
                      </div>
                    </div>
                    {isActive ? (
                      <span className="text-xs font-semibold text-[#4169F5] shrink-0">
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
            <h2 className="text-sm font-semibold text-[#182238] dark:text-slate-100">
              Branches for {activeCompany.companyName}
            </h2>
            <div className="space-y-2">
              {activeCompany.branches.map((b) => (
                <div
                  key={b.id}
                  className="p-3 rounded-lg border border-slate-200 dark:border-[#223257] flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <MapPin className="h-4 w-4 text-[#16B8A6] shrink-0" />
                    <div>
                      <div className="font-semibold text-[#182238] dark:text-slate-100">
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

            <form onSubmit={handleAddBranch} className="pt-3 border-t border-slate-200 dark:border-[#223257] space-y-3">
              <div className="text-xs font-semibold text-[#182238] dark:text-slate-100">
                Add Branch Location
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  required
                  value={branchCode}
                  onChange={(e) => setBranchCode(e.target.value)}
                  placeholder="Code (e.g. BLR-02)"
                  className="h-9 px-3 rounded-lg text-xs font-mono uppercase bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
                />
                <input
                  type="text"
                  required
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  placeholder="Branch Name"
                  className="h-9 px-3 rounded-lg text-xs bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
                />
                <input
                  type="text"
                  value={branchCity}
                  onChange={(e) => setBranchCity(e.target.value)}
                  placeholder="City"
                  className="h-9 px-3 rounded-lg text-xs bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Surface padding="lg" className="space-y-4">
              <h2 className="text-sm font-semibold text-[#182238] dark:text-slate-100">
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
              <h2 className="text-sm font-semibold text-[#182238] dark:text-slate-100">
                Workspace Reset Controls
              </h2>
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border border-slate-200 dark:border-[#223257]">
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
                          setBackupMessage(`Cleared operational records for ${activeCompany.companyName}.`);
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

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border border-slate-200 dark:border-[#223257]">
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
                    ? 'bg-[#101B35] text-white border-[#101B35] dark:bg-[#4169F5] dark:border-[#4169F5]'
                    : 'bg-white dark:bg-[#101B35] border-slate-200 dark:border-[#223257] text-[#182238] dark:text-slate-200'
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
