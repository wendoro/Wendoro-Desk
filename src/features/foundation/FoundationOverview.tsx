import React, { useState } from 'react';
import { ArrowRight, Building2, Database, Layers, Rocket, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { Surface } from '@/src/components/ui/Surface';
import { useTenant } from '@/src/components/shell/TenantProvider';
import { WENDORO_MODULES, ModuleLayer } from '@/src/core/registry/modules';

export function FoundationOverview({
  onNavigate,
}: {
  onNavigate: (routeId: string) => void;
}) {
  const { principal, activeCompany, activeBranchId, toggleCompanyModule } = useTenant();
  const [layerFilter, setLayerFilter] = useState<'all' | ModuleLayer>('all');

  const activeBranch = activeCompany.branches.find((b) => b.id === activeBranchId);

  const visibleModules = WENDORO_MODULES.filter((m) =>
    layerFilter === 'all' ? true : m.layer === layerFilter,
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#4169F5] mb-1">
            Phase 0 · Open-Core ERP by BakeWeb
          </p>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-[#182238] dark:text-slate-100 text-balance">
            WENDORO Business Operating System
          </h1>
          <p className="mt-1.5 text-sm text-[#718096] dark:text-slate-400 max-w-2xl">
            Multi-tenant architecture foundation, PostgreSQL Row-Level Security schema,
            identity separation model, and portable multi-cloud deployment shell.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Button variant="outline" size="sm" onClick={() => onNavigate('setup')}>
            <SlidersHorizontal className="h-4 w-4 text-[#16B8A6]" />
            Setup Wizard
          </Button>
          <Button variant="outline" size="sm" onClick={() => onNavigate('deploy')}>
            <Rocket className="h-4 w-4 text-[#8B5CF6]" />
            Deploy
          </Button>
          <Button variant="outline" size="sm" onClick={() => onNavigate('schema')}>
            <Database className="h-4 w-4 text-[#4169F5]" />
            Inspect Schema
          </Button>
          <Button variant="primary" size="sm" onClick={() => onNavigate('milestone')}>
            Review Milestone 1
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Active Tenant & Company Isolation Context */}
      <Surface padding="lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-[#718096] dark:text-slate-400">
              <Building2 className="h-4 w-4 text-[#4169F5]" />
              <span>Active Company Context</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">{activeCompany.companyCode}</span>
            </div>
            <h2 className="text-lg font-semibold text-[#182238] dark:text-slate-100">
              {activeCompany.legalName}
            </h2>
            <p className="text-xs text-[#718096] dark:text-slate-400">
              {activeCompany.industryClassification} · Base Currency {activeCompany.baseCurrency} ·{' '}
              {activeCompany.timezone}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-4 lg:pt-0 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-[#223257] lg:pl-6">
            <div>
              <div className="text-xs text-[#718096] dark:text-slate-400">Assigned Role</div>
              <div className="mt-1 text-sm font-semibold text-[#182238] dark:text-slate-100">
                {activeCompany.roleName}
              </div>
              <div className="text-[11px] text-[#718096] dark:text-slate-400">
                Scope: {activeCompany.roleScope}
              </div>
            </div>

            <div>
              <div className="text-xs text-[#718096] dark:text-slate-400">Branch Scope</div>
              <div className="mt-1 text-sm font-semibold text-[#182238] dark:text-slate-100">
                {activeBranch ? activeBranch.code : 'All Branches'}
              </div>
              <div className="text-[11px] text-[#718096] dark:text-slate-400 truncate max-w-[140px]">
                {activeBranch ? activeBranch.name : `${activeCompany.branches.length} locations`}
              </div>
            </div>

            <div>
              <div className="text-xs text-[#718096] dark:text-slate-400">Active Modules</div>
              <div className="mt-1 text-sm font-semibold font-mono tabular-nums text-[#182238] dark:text-slate-100">
                {activeCompany.enabledModules.length} / {WENDORO_MODULES.length}
              </div>
              <div className="text-[11px] text-[#718096] dark:text-slate-400">
                Company-scoped
              </div>
            </div>

            <div>
              <div className="text-xs text-[#718096] dark:text-slate-400">Subscription</div>
              <div className="mt-1 text-sm font-semibold capitalize text-[#16B8A6]">
                {principal.subscriptionTier}
              </div>
              <div className="text-[11px] text-[#718096] dark:text-slate-400">
                RLS Enforced
              </div>
            </div>
          </div>
        </div>
      </Surface>

      {/* Architectural Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Surface>
          <div className="flex items-center gap-2.5 mb-2">
            <Layers className="h-4 w-4 text-[#4169F5]" />
            <h3 className="text-sm font-semibold text-[#182238] dark:text-slate-100">
              Three-Layer Modularity
            </h3>
          </div>
          <p className="text-xs text-[#718096] dark:text-slate-400 leading-relaxed">
            Layer A Core Services (Identity, RBAC, Audit, AI Gateway) power independent
            Layer B Business Apps and optional Layer C Industry Packages without core coupling.
          </p>
        </Surface>

        <Surface>
          <div className="flex items-center gap-2.5 mb-2">
            <Database className="h-4 w-4 text-[#8B5CF6]" />
            <h3 className="text-sm font-semibold text-[#182238] dark:text-slate-100">
              PostgreSQL + RLS Isolation
            </h3>
          </div>
          <p className="text-xs text-[#718096] dark:text-slate-400 leading-relaxed">
            Domain schemas use UUID primary keys, NUMERIC(19, 4) financial precision,
            immutable audit triggers, and transaction-scoped{' '}
            <code className="text-[11px]">set_config()</code> RLS policies.
          </p>
        </Surface>

        <Surface>
          <div className="flex items-center gap-2.5 mb-2">
            <ShieldCheck className="h-4 w-4 text-[#16B8A6]" />
            <h3 className="text-sm font-semibold text-[#182238] dark:text-slate-100">
              Identity vs. Authorization
            </h3>
          </div>
          <p className="text-xs text-[#718096] dark:text-slate-400 leading-relaxed">
            Better Auth manages human authentication globally while{' '}
            <code className="text-[11px]">organization.memberships</code> assigns distinct
            company and branch roles per business.
          </p>
        </Surface>
      </div>

      {/* Independent Module Activation Matrix */}
      <section aria-labelledby="module-activation-heading" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2
              id="module-activation-heading"
              className="text-base font-semibold text-[#182238] dark:text-slate-100"
            >
              Company Module Activation Registry
            </h2>
            <p className="text-xs text-[#718096] dark:text-slate-400 mt-0.5">
              Toggle Layer B or Layer C applications for{' '}
              <span className="font-medium text-[#182238] dark:text-slate-200">
                {activeCompany.companyName}
              </span>{' '}
              to observe sidebar adaptation per company.
            </p>
          </div>

          <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-[#162342] self-start">
            {(['all', 'core', 'business', 'industry'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setLayerFilter(tab)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors cursor-pointer whitespace-nowrap ${
                  layerFilter === tab
                    ? 'bg-white dark:bg-[#101B35] text-[#182238] dark:text-slate-100 shadow-xs'
                    : 'text-[#718096] dark:text-slate-400 hover:text-[#182238] dark:hover:text-slate-100'
                }`}
              >
                {tab === 'all' ? 'All Layers' : `Layer: ${tab}`}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visibleModules.map((mod) => {
            const isEnabled =
              mod.alwaysActive || activeCompany.enabledModules.includes(mod.slug);

            return (
              <Surface key={mod.slug} className="flex flex-col justify-between gap-4">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs text-[#718096] dark:text-slate-400">
                        {mod.layer.toUpperCase()} · {mod.targetPhase}
                      </div>
                      <h3 className="mt-1 text-sm font-semibold text-[#182238] dark:text-slate-100">
                        {mod.name}
                      </h3>
                    </div>

                    <button
                      type="button"
                      disabled={mod.alwaysActive}
                      onClick={() => toggleCompanyModule(mod.slug)}
                      aria-pressed={isEnabled}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                        mod.alwaysActive
                          ? 'bg-slate-100 dark:bg-[#162342] text-[#718096] dark:text-slate-400 cursor-not-allowed'
                          : isEnabled
                            ? 'bg-[#16B8A6]/15 text-[#0F8A7C] dark:text-[#2DD4BF] hover:bg-[#16B8A6]/25 cursor-pointer'
                            : 'bg-slate-100 dark:bg-[#162342] text-[#718096] dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#1E2F57] cursor-pointer'
                      }`}
                    >
                      {mod.alwaysActive ? 'Required' : isEnabled ? 'Active' : 'Disabled'}
                    </button>
                  </div>

                  <p className="mt-2 text-xs text-[#718096] dark:text-slate-400 leading-relaxed">
                    {mod.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-200/80 dark:border-[#223257] flex items-center justify-between text-xs">
                  <span className="font-mono text-[11px] text-[#718096] dark:text-slate-400 truncate">
                    schema: {mod.schemaNamespace}
                  </span>
                  {mod.layer !== 'core' && (
                    <button
                      type="button"
                      onClick={() => onNavigate(`module:${mod.slug}`)}
                      className="text-[#4169F5] font-medium hover:underline cursor-pointer whitespace-nowrap"
                    >
                      Module Spec
                    </button>
                  )}
                </div>
              </Surface>
            );
          })}
        </div>
      </section>
    </div>
  );
}
