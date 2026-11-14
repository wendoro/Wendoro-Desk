import React, { useState } from 'react';
import {
  Activity,
  Check,
  CheckCircle2,
  Cloud,
  Container,
  Copy,
  ExternalLink,
  FileCode2,
  GitBranch,
  Globe,
  HardDrive,
  Lock,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  Terminal,
} from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { Surface } from '@/src/components/ui/Surface';
import { useFirebase } from '@/src/components/shell/FirebaseProvider';
import {
  DeploymentTargetId,
  OSS_GOVERNANCE_FILES,
  WENDORO_DEPLOYMENT_TARGETS,
  WENDORO_REPO_URL,
} from '@/src/core/registry/deployments';
import { cn } from '@/src/lib/utils';

const TARGET_ICONS: Record<DeploymentTargetId, React.ComponentType<{ className?: string }>> = {
  cloudflare: Cloud,
  docker: Container,
  'node-paas': Server,
  'vercel-netlify': Globe,
  'desktop-airgap': HardDrive,
};

interface HealthProbeResult {
  checkedAt: string;
  mode: 'node-express' | 'static-edge';
  message: string;
}

export function DeploymentGuideView({
  onNavigate,
}: {
  onNavigate: (routeId: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<DeploymentTargetId>('cloudflare');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [probeLoading, setProbeLoading] = useState(false);
  const [probeResult, setProbeResult] = useState<HealthProbeResult | null>(null);

  const { connectionState, isConfigured } = useFirebase();

  const selectedTarget =
    WENDORO_DEPLOYMENT_TARGETS.find((t) => t.id === selectedId) ??
    WENDORO_DEPLOYMENT_TARGETS[0];

  const handleCopy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      // Clipboard may be unavailable in restricted contexts
    }
  };

  const runHealthProbe = async () => {
    setProbeLoading(true);
    try {
      const response = await fetch('/api/health', { cache: 'no-store' });
      const contentType = response.headers.get('content-type') ?? '';
      if (response.ok && contentType.includes('application/json')) {
        const data = (await response.json()) as { status?: string; runtime?: string };
        setProbeResult({
          checkedAt: new Date().toLocaleTimeString(),
          mode: 'node-express',
          message: `200 OK · ${data.runtime ?? 'node-express'} (${data.status ?? 'ok'})`,
        });
      } else {
        setProbeResult({
          checkedAt: new Date().toLocaleTimeString(),
          mode: 'static-edge',
          message: 'Static SPA / Edge Asset mode active (no Node /api/health server attached).',
        });
      }
    } catch {
      setProbeResult({
        checkedAt: new Date().toLocaleTimeString(),
        mode: 'static-edge',
        message: 'Static SPA / Edge Asset mode active.',
      });
    } finally {
      setProbeLoading(false);
    }
  };

  const TargetIcon = TARGET_ICONS[selectedTarget.id];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#4169F5] mb-1">
            Open-Source Distribution · BakeWeb
          </p>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-[#182238] dark:text-slate-100 text-balance">
            Deploy & Distribute WENDORO ERP
          </h1>
          <p className="mt-1.5 text-sm text-[#718096] dark:text-slate-400 max-w-2xl">
            Run Wendoro-Desk anywhere — serverless on Cloudflare Workers, self-hosted via
            Docker Compose + PostgreSQL 16, on Node.js PaaS providers, or on edge CDNs
            without vendor lock-in.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <a
            href={WENDORO_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium border border-slate-200 dark:border-[#223257] bg-white dark:bg-[#101B35] text-[#182238] dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-[#162342] whitespace-nowrap transition-colors"
          >
            <GitBranch className="h-3.5 w-3.5 text-[#4169F5]" />
            GitHub Repo
            <ExternalLink className="h-3 w-3 text-[#718096]" />
          </a>
          <Button variant="outline" size="sm" onClick={() => onNavigate('setup')}>
            <SlidersHorizontal className="h-3.5 w-3.5 text-[#16B8A6]" />
            Open Setup Wizard
          </Button>
          <a
            href={`https://deploy.workers.cloudflare.com/?url=${encodeURIComponent(WENDORO_REPO_URL)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium bg-[#4169F5] text-white hover:bg-[#3257DB] whitespace-nowrap transition-colors"
          >
            <Cloud className="h-3.5 w-3.5" />
            Deploy to Cloudflare
            <ExternalLink className="h-3 w-3 opacity-80" />
          </a>
        </div>
      </div>

      {/* Platform Target Selector */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
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
                  ? 'bg-white dark:bg-[#101B35] border-[#4169F5] ring-1 ring-[#4169F5]'
                  : 'bg-white/70 dark:bg-[#101B35]/60 border-slate-200 dark:border-[#223257] hover:bg-white dark:hover:bg-[#101B35]',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <Icon
                  className={cn(
                    'h-4 w-4 shrink-0',
                    active ? 'text-[#4169F5]' : 'text-[#718096] dark:text-slate-400',
                  )}
                />
                <span className="text-[11px] font-medium text-[#718096] dark:text-slate-400 truncate">
                  {target.category.split('·')[0].trim()}
                </span>
              </div>
              <div>
                <div className="text-sm font-semibold text-[#182238] dark:text-slate-100 whitespace-nowrap truncate">
                  {target.shortLabel}
                </div>
                <div className="text-[11px] text-[#718096] dark:text-slate-400 truncate mt-0.5">
                  {target.configFiles[0]}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Deployment Target Detail */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left 2 Columns: Architecture & Commands */}
        <div className="xl:col-span-2 space-y-6">
          <Surface padding="lg" className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-200 dark:border-[#223257]">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-[#4169F5] font-medium">
                  <TargetIcon className="h-4 w-4" />
                  <span>{selectedTarget.category}</span>
                </div>
                <h2 className="text-xl font-bold text-[#182238] dark:text-slate-100">
                  {selectedTarget.name}
                </h2>
                <p className="text-xs text-[#718096] dark:text-slate-400 leading-relaxed max-w-2xl">
                  {selectedTarget.summary}
                </p>
              </div>
              <div className="shrink-0 text-left sm:text-right">
                <div className="text-[11px] text-[#718096] dark:text-slate-400">
                  Target Runtime
                </div>
                <div className="text-xs font-semibold font-mono text-[#182238] dark:text-slate-100 mt-0.5">
                  {selectedTarget.runtime}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {selectedTarget.highlights.map((item) => (
                <div key={item} className="flex items-start gap-2.5 text-xs">
                  <CheckCircle2 className="h-4 w-4 text-[#16B8A6] shrink-0 mt-0.5" />
                  <span className="text-[#182238] dark:text-slate-200 leading-relaxed">
                    {item}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-2 flex flex-wrap items-center gap-2 text-xs text-[#718096] dark:text-slate-400">
              <FileCode2 className="h-3.5 w-3.5 text-[#4169F5]" />
              <span>Included files:</span>
              {selectedTarget.configFiles.map((file, idx) => (
                <React.Fragment key={file}>
                  {idx > 0 && <span aria-hidden="true">·</span>}
                  <code className="font-mono text-[11px] text-[#182238] dark:text-slate-200">
                    {file}
                  </code>
                </React.Fragment>
              ))}
            </div>
          </Surface>

          {/* Copyable Steps */}
          <Surface padding="lg" className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-[#4169F5]" />
                <h3 className="text-sm font-semibold text-[#182238] dark:text-slate-100">
                  Deployment Commands
                </h3>
              </div>
              <span className="text-[11px] text-[#718096] dark:text-slate-400">
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
                    className="rounded-lg border border-slate-200 dark:border-[#223257] overflow-hidden"
                  >
                    <div className="flex items-center justify-between gap-3 px-3.5 py-2 bg-[#F6F8FC] dark:bg-[#0E172E] border-b border-slate-200 dark:border-[#223257]">
                      <span className="text-xs font-medium text-[#182238] dark:text-slate-100">
                        {step.title}
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleCopy(copyId, step.command)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-[#4169F5] hover:underline cursor-pointer whitespace-nowrap"
                      >
                        {isCopied ? (
                          <>
                            <Check className="h-3 w-3 text-[#16B8A6]" />
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
                    <pre className="p-3.5 text-xs font-mono text-[#182238] dark:text-slate-100 bg-white dark:bg-[#0B1224] overflow-x-auto leading-relaxed">
                      {step.command}
                    </pre>
                    {step.note && (
                      <div className="px-3.5 py-2 text-[11px] text-[#718096] dark:text-slate-400 bg-white dark:bg-[#101B35] border-t border-slate-200/80 dark:border-[#223257]">
                        {step.note}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Surface>

          {/* Environment Variables & Secret Hygiene */}
          <Surface padding="none" className="overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-[#223257] flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-[#8B5CF6]" />
                <h3 className="text-sm font-semibold text-[#182238] dark:text-slate-100">
                  Environment Variables & Secret Hygiene
                </h3>
              </div>
              <span className="text-[11px] text-[#718096] dark:text-slate-400">
                Zero secrets committed to Git
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F6F8FC] dark:bg-[#0E172E] border-b border-slate-200 dark:border-[#223257] text-[#718096] dark:text-slate-400">
                  <tr>
                    <th className="py-2.5 px-4 font-medium whitespace-nowrap">Variable</th>
                    <th className="py-2.5 px-4 font-medium whitespace-nowrap">Scope</th>
                    <th className="py-2.5 px-4 font-medium">Purpose & Injection</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/80 dark:divide-[#223257]">
                  {selectedTarget.envVars.map((env) => (
                    <tr key={env.name}>
                      <td className="py-3 px-4 font-mono text-[11px] font-semibold text-[#182238] dark:text-slate-100 whitespace-nowrap">
                        {env.name}
                        {env.required && (
                          <span className="ml-1.5 text-[10px] font-sans font-medium text-[#4169F5]">
                            required
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={cn(
                            'text-[11px] font-medium',
                            env.scope === 'server'
                              ? 'text-[#8B5CF6]'
                              : 'text-[#16B8A6]',
                          )}
                        >
                          {env.scope === 'server' ? 'Server Secret' : 'Public Client'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[#718096] dark:text-slate-400">
                        <div className="text-[#182238] dark:text-slate-200">{env.description}</div>
                        <div className="font-mono text-[11px] mt-0.5">{env.example}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Surface>
        </div>

        {/* Right Column: Runtime Readiness & Open-Source Governance */}
        <div className="space-y-6">
          <Surface padding="lg" className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-[#16B8A6]" />
                <h3 className="text-sm font-semibold text-[#182238] dark:text-slate-100">
                  Runtime Readiness
                </h3>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void runHealthProbe()}
                disabled={probeLoading}
              >
                {probeLoading ? 'Checking...' : 'Test /api/health'}
              </Button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-2 border-b border-slate-200/80 dark:border-[#223257]">
                <span className="text-[#718096] dark:text-slate-400">Firebase SDK</span>
                <span className="font-medium text-[#182238] dark:text-slate-100 capitalize">
                  {isConfigured ? connectionState : 'Unconfigured (Safe Mode)'}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-200/80 dark:border-[#223257]">
                <span className="text-[#718096] dark:text-slate-400">PostgreSQL Migration</span>
                <span className="font-mono text-[11px] text-[#182238] dark:text-slate-100">
                  0000_core_foundation_rls.sql
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-200/80 dark:border-[#223257]">
                <span className="text-[#718096] dark:text-slate-400">Lockfile Strategy</span>
                <span className="font-mono text-[11px] text-[#182238] dark:text-slate-100">
                  package-lock.json + .npmrc
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-[#718096] dark:text-slate-400">Node Engine</span>
                <span className="font-mono text-[11px] text-[#182238] dark:text-slate-100">
                  Node 24 LTS
                </span>
              </div>
            </div>

            {probeResult && (
              <div className="rounded-lg p-3 bg-[#F6F8FC] dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257] text-xs space-y-1">
                <div className="flex items-center justify-between text-[11px] text-[#718096] dark:text-slate-400">
                  <span>Health Probe</span>
                  <span className="font-mono tabular-nums">{probeResult.checkedAt}</span>
                </div>
                <div className="font-medium text-[#182238] dark:text-slate-100">
                  {probeResult.message}
                </div>
              </div>
            )}
          </Surface>

          <Surface padding="lg" className="space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#4169F5]" />
              <h3 className="text-sm font-semibold text-[#182238] dark:text-slate-100">
                Open-Source Distribution Package
              </h3>
            </div>
            <p className="text-xs text-[#718096] dark:text-slate-400 leading-relaxed">
              Every Wendoro-Desk release ships with standard open-source governance,
              contributor guidelines, and public-repo secret protection.
            </p>
            <div className="divide-y divide-slate-200/80 dark:divide-[#223257]">
              {OSS_GOVERNANCE_FILES.map((item) => (
                <div key={item.file} className="py-2.5 first:pt-0 last:pb-0">
                  <div className="font-mono text-xs font-semibold text-[#182238] dark:text-slate-100">
                    {item.file}
                  </div>
                  <div className="text-[11px] text-[#718096] dark:text-slate-400 mt-0.5 leading-relaxed">
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
