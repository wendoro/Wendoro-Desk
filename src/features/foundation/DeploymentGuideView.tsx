import React, { useState } from 'react';
import {
  Activity,
  Check,
  CheckCircle2,
  Cloud,
  Copy,
  ExternalLink,
  FileCode2,
  GitBranch,
  KeyRound,
  Lock,
  Monitor,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Terminal,
} from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { Surface } from '@/src/components/ui/Surface';
import { useTenant } from '@/src/components/shell/TenantProvider';
import { verifyLicenseWithServer } from '@/src/core/engine/licenseClient';
import {
  CLOUDFLARE_DEPLOY_URL,
  DeploymentTargetId,
  OSS_GOVERNANCE_FILES,
  WENDORO_DEPLOYMENT_TARGETS,
  WENDORO_REPO_URL,
} from '@/src/core/registry/deployments';
import { cn } from '@/src/lib/utils';

const TARGET_ICONS: Record<DeploymentTargetId, React.ComponentType<{ className?: string }>> = {
  cloudflare: Cloud,
  'desktop-electron': Monitor,
  'android-app': Smartphone,
  'license-server': Server,
};

interface HealthProbeResult {
  checkedAt: string;
  message: string;
  runtime?: string;
  registeredAccounts?: number;
  issuedLicenses?: number;
  activeActivations?: number;
}

export function DeploymentGuideView({
  onNavigate,
}: {
  onNavigate: (routeId: string) => void;
}) {
  const { licenseActivation } = useTenant();
  const [selectedId, setSelectedId] = useState<DeploymentTargetId>('cloudflare');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [probeLoading, setProbeLoading] = useState(false);
  const [probeResult, setProbeResult] = useState<HealthProbeResult | null>(null);

  const [verifyKeyInput, setVerifyKeyInput] = useState(licenseActivation?.licenseKey ?? '');
  const [verifyResult, setVerifyResult] = useState<{
    checked: boolean;
    valid: boolean;
    message: string;
  } | null>(null);

  const selectedTarget =
    WENDORO_DEPLOYMENT_TARGETS.find((t) => t.id === selectedId) ??
    WENDORO_DEPLOYMENT_TARGETS[0];

  const handleCopy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      // Clipboard unavailable
    }
  };

  const runHealthProbe = async () => {
    setProbeLoading(true);
    try {
      const res = await fetch('/api/licenses/status', { cache: 'no-store' });
      const contentType = res.headers.get('content-type') ?? '';
      if (res.ok && contentType.includes('application/json')) {
        const data = (await res.json()) as {
          status?: string;
          runtime?: string;
          registeredAccounts?: number;
          issuedLicenses?: number;
          activeActivations?: number;
        };
        setProbeResult({
          checkedAt: new Date().toLocaleTimeString(),
          message: `License Server Online (${data.status ?? 'ok'})`,
          runtime: data.runtime,
          registeredAccounts: data.registeredAccounts ?? 0,
          issuedLicenses: data.issuedLicenses ?? 0,
          activeActivations: data.activeActivations ?? 0,
        });
      } else {
        setProbeResult({
          checkedAt: new Date().toLocaleTimeString(),
          message: 'Offline local client active (License Server unreachable).',
        });
      }
    } catch {
      setProbeResult({
        checkedAt: new Date().toLocaleTimeString(),
        message: 'Offline local client active.',
      });
    } finally {
      setProbeLoading(false);
    }
  };

  const handleVerifyKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyKeyInput.trim()) return;
    try {
      const res = await verifyLicenseWithServer({
        serverUrl: licenseActivation?.serverUrl,
        licenseKey: verifyKeyInput,
      });
      setVerifyResult({
        checked: true,
        valid: res.valid,
        message: res.valid
          ? `Valid (${res.license?.planName} · ${res.license?.organizationName})`
          : res.message || 'Invalid or unknown license key.',
      });
    } catch (err) {
      setVerifyResult({
        checked: true,
        valid: false,
        message: err instanceof Error ? err.message : 'Unable to reach License Server.',
      });
    }
  };

  const TargetIcon = TARGET_ICONS[selectedTarget.id];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#DC2626] dark:text-[#FACC15] mb-1">
            Distribution & Edge Deployment · Cloudflare, Desktop & Android
          </p>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-[#1C1917] dark:text-stone-100 text-balance">
            Cloudflare One-Click, Desktop Software & Android APK
          </h1>
          <p className="mt-1.5 text-sm text-[#57534E] dark:text-stone-400 max-w-2xl">
            Deploy WENDORO and its License Auth Edge Worker to Cloudflare in one click, or
            package offline-first native installers for Windows, macOS, Linux, and Android.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <a
            href={CLOUDFLARE_DEPLOY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold bg-[#F59E0B] hover:bg-[#D97706] text-[#1C1917] whitespace-nowrap transition-colors"
          >
            <Cloud className="h-3.5 w-3.5" />
            Deploy to Cloudflare
            <ExternalLink className="h-3 w-3" />
          </a>
          <a
            href={WENDORO_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium border border-stone-200 dark:border-[#32242A] bg-white dark:bg-[#1B1417] text-[#1C1917] dark:text-stone-100 hover:bg-stone-50 dark:hover:bg-[#2A1E22] whitespace-nowrap transition-colors"
          >
            <GitBranch className="h-3.5 w-3.5 text-[#DC2626]" />
            Source Repo
            <ExternalLink className="h-3 w-3 text-[#57534E]" />
          </a>
          <Button variant="primary" size="sm" onClick={() => onNavigate('setup')}>
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Setup & License Wizard
          </Button>
        </div>
      </div>

      {/* 4-Card Platform Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {WENDORO_DEPLOYMENT_TARGETS.map((target) => {
          const Icon = TARGET_ICONS[target.id];
          const active = target.id === selectedTarget.id;
          return (
            <button
              key={target.id}
              type="button"
              onClick={() => setSelectedId(target.id)}
              aria-pressed={active}
              className={cn(
                'text-left p-4 rounded-xl border transition-colors cursor-pointer flex flex-col justify-between gap-2.5',
                active
                  ? 'bg-white dark:bg-[#1B1417] border-[#DC2626] ring-1 ring-[#DC2626]'
                  : 'bg-white/80 dark:bg-[#1B1417]/60 border-stone-200 dark:border-[#32242A] hover:bg-white dark:hover:bg-[#1B1417]',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <Icon
                  className={cn(
                    'h-4 w-4 shrink-0',
                    active ? 'text-[#DC2626] dark:text-[#FACC15]' : 'text-[#57534E] dark:text-stone-400',
                  )}
                />
                <span className="text-[11px] font-medium text-[#57534E] dark:text-stone-400 truncate">
                  {target.category.split('·')[0].trim()}
                </span>
              </div>
              <div>
                <div className="text-sm font-semibold text-[#1C1917] dark:text-stone-100 whitespace-nowrap truncate">
                  {target.shortLabel}
                </div>
                <div className="text-[11px] text-[#57534E] dark:text-stone-400 truncate mt-0.5">
                  {target.configFiles[0]}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Target Detail */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <Surface padding="lg" className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-stone-200 dark:border-[#32242A]">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-[#DC2626] dark:text-[#FACC15] font-semibold">
                  <TargetIcon className="h-4 w-4" />
                  <span>{selectedTarget.category}</span>
                </div>
                <h2 className="text-xl font-bold text-[#1C1917] dark:text-stone-100">
                  {selectedTarget.name}
                </h2>
                <p className="text-xs text-[#57534E] dark:text-stone-400 leading-relaxed max-w-2xl">
                  {selectedTarget.summary}
                </p>
              </div>
              <div className="shrink-0 text-left sm:text-right">
                <div className="text-[11px] text-[#57534E] dark:text-stone-400">
                  Target Runtime
                </div>
                <div className="text-xs font-semibold font-mono text-[#1C1917] dark:text-stone-100 mt-0.5">
                  {selectedTarget.runtime}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {selectedTarget.highlights.map((item) => (
                <div key={item} className="flex items-start gap-2.5 text-xs">
                  <CheckCircle2 className="h-4 w-4 text-[#D97706] dark:text-[#FACC15] shrink-0 mt-0.5" />
                  <span className="text-[#1C1917] dark:text-stone-200 leading-relaxed">
                    {item}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-2 flex flex-wrap items-center gap-2 text-xs text-[#57534E] dark:text-stone-400">
              <FileCode2 className="h-3.5 w-3.5 text-[#DC2626]" />
              <span>Included files:</span>
              {selectedTarget.configFiles.map((file, idx) => (
                <React.Fragment key={file}>
                  {idx > 0 && <span aria-hidden="true">·</span>}
                  <code className="font-mono text-[11px] text-[#1C1917] dark:text-stone-200">
                    {file}
                  </code>
                </React.Fragment>
              ))}
            </div>
          </Surface>

          {/* Build Commands */}
          <Surface padding="lg" className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-[#DC2626]" />
                <h3 className="text-sm font-semibold text-[#1C1917] dark:text-stone-100">
                  Build & Packaging Steps
                </h3>
              </div>
              <span className="text-[11px] text-[#57534E] dark:text-stone-400">
                {selectedTarget.scalingProfile}
              </span>
            </div>

            <div className="space-y-4">
              {selectedTarget.steps.map((step, index) => {
                const copyId = `${selectedTarget.id}-step-${index}`;
                const isCopied = copiedKey === copyId;
                return (
                  <div
                    key={copyId}
                    className="rounded-lg border border-stone-200 dark:border-[#32242A] overflow-hidden"
                  >
                    <div className="flex items-center justify-between gap-3 px-3.5 py-2 bg-[#FAF9F7] dark:bg-[#141013] border-b border-stone-200 dark:border-[#32242A]">
                      <span className="text-xs font-medium text-[#1C1917] dark:text-stone-100">
                        {step.title}
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleCopy(copyId, step.command)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-[#DC2626] dark:text-[#FACC15] hover:underline cursor-pointer whitespace-nowrap"
                      >
                        {isCopied ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-600" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="p-3.5 text-xs font-mono text-[#1C1917] dark:text-stone-100 bg-white dark:bg-[#120E10] overflow-x-auto leading-relaxed">
                      {step.command}
                    </pre>
                    {step.note && (
                      <div className="px-3.5 py-2 text-[11px] text-[#57534E] dark:text-stone-400 bg-white dark:bg-[#1B1417] border-t border-stone-200/80 dark:border-[#32242A]">
                        {step.note}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Surface>

          {selectedTarget.envVars.length > 0 && (
            <Surface padding="none" className="overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-200 dark:border-[#32242A] flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-[#D97706] dark:text-[#FACC15]" />
                  <h3 className="text-sm font-semibold text-[#1C1917] dark:text-stone-100">
                    Environment Variables
                  </h3>
                </div>
                <span className="text-[11px] text-[#57534E] dark:text-stone-400">
                  Zero secrets committed to Git
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF9F7] dark:bg-[#141013] border-b border-stone-200 dark:border-[#32242A] text-[#57534E] dark:text-stone-400">
                    <tr>
                      <th className="py-2.5 px-4 font-medium whitespace-nowrap">Variable</th>
                      <th className="py-2.5 px-4 font-medium whitespace-nowrap">Scope</th>
                      <th className="py-2.5 px-4 font-medium">Purpose</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200/80 dark:divide-[#32242A]">
                    {selectedTarget.envVars.map((env) => (
                      <tr key={env.name}>
                        <td className="py-3 px-4 font-mono text-[11px] font-semibold text-[#1C1917] dark:text-stone-100 whitespace-nowrap">
                          {env.name}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="text-[11px] font-medium text-[#DC2626] dark:text-[#FACC15]">
                            {env.scope === 'server' ? 'License Server' : 'Native Client'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-[#57534E] dark:text-stone-400">
                          <div className="text-[#1C1917] dark:text-stone-200">{env.description}</div>
                          <div className="font-mono text-[11px] mt-0.5">{env.example}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Surface>
          )}
        </div>

        {/* Right Column: Live License Server Probe & Key Verifier */}
        <div className="space-y-6">
          <Surface padding="lg" className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-[#DC2626]" />
                <h3 className="text-sm font-semibold text-[#1C1917] dark:text-stone-100">
                  License Server Status
                </h3>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void runHealthProbe()}
                disabled={probeLoading}
              >
                {probeLoading ? 'Checking...' : 'Check Server'}
              </Button>
            </div>

            {licenseActivation ? (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-xs space-y-1">
                <div className="font-semibold text-[#92400E] dark:text-[#FACC15]">
                  This Device Is Licensed
                </div>
                <div className="font-mono text-[11px] text-[#1C1917] dark:text-stone-200">
                  {licenseActivation.licenseKey}
                </div>
                <div className="text-[11px] text-[#57534E] dark:text-stone-400">
                  {licenseActivation.planName} · {licenseActivation.organizationName}
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-[#FAF9F7] dark:bg-[#141013] border border-stone-200 dark:border-[#32242A] text-xs text-[#57534E] dark:text-stone-400">
                No license key activated on this device yet. Use the Setup Wizard to register & generate a key.
              </div>
            )}

            <form onSubmit={(e) => void handleVerifyKey(e)} className="space-y-2 pt-2 border-t border-stone-200 dark:border-[#32242A]">
              <label className="block text-xs font-medium text-[#1C1917] dark:text-stone-200">
                Quick Verify License Key
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={verifyKeyInput}
                  onChange={(e) => setVerifyKeyInput(e.target.value.toUpperCase())}
                  placeholder="WND-COMM-..."
                  className="flex-1 h-8 px-2.5 rounded-lg text-xs font-mono bg-white dark:bg-[#141013] border border-stone-200 dark:border-[#32242A] focus:outline-none focus:ring-2 focus:ring-[#DC2626]"
                />
                <Button type="submit" variant="secondary" size="sm">
                  <KeyRound className="h-3.5 w-3.5" />
                  Verify
                </Button>
              </div>
              {verifyResult?.checked && (
                <div
                  className={cn(
                    'text-[11px] font-medium',
                    verifyResult.valid
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400',
                  )}
                >
                  {verifyResult.message}
                </div>
              )}
            </form>

            {probeResult && (
              <div className="rounded-lg p-3 bg-[#FAF9F7] dark:bg-[#141013] border border-stone-200 dark:border-[#32242A] text-xs space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-[#57534E] dark:text-stone-400">
                  <span>Server Ping</span>
                  <span className="font-mono tabular-nums">{probeResult.checkedAt}</span>
                </div>
                <div className="font-medium text-[#1C1917] dark:text-stone-100">
                  {probeResult.message}
                  {probeResult.runtime ? ` · ${probeResult.runtime}` : ''}
                </div>
                {probeResult.issuedLicenses !== undefined && (
                  <div className="text-[11px] text-[#57534E] dark:text-stone-400 pt-1 border-t border-stone-200 dark:border-[#32242A] flex justify-between">
                    <span>Accounts: {probeResult.registeredAccounts}</span>
                    <span>Keys: {probeResult.issuedLicenses}</span>
                    <span>Devices: {probeResult.activeActivations}</span>
                  </div>
                )}
              </div>
            )}
          </Surface>

          <Surface padding="lg" className="space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#D97706] dark:text-[#FACC15]" />
              <h3 className="text-sm font-semibold text-[#1C1917] dark:text-stone-100">
                Desktop & Android Files
              </h3>
            </div>
            <div className="divide-y divide-stone-200/80 dark:divide-[#32242A]">
              {OSS_GOVERNANCE_FILES.map((item) => (
                <div key={item.file} className="py-2.5 first:pt-0 last:pb-0">
                  <div className="font-mono text-xs font-semibold text-[#1C1917] dark:text-stone-100">
                    {item.file}
                  </div>
                  <div className="text-[11px] text-[#57534E] dark:text-stone-400 mt-0.5 leading-relaxed">
                    {item.purpose}
                  </div>
                </div>
              ))}
            </div>
          </Surface>
        </div>
      </div>
    </div>
  );
}
