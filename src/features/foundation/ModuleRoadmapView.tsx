import React from 'react';
import { ArrowLeft, Layers } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { Surface } from '@/src/components/ui/Surface';
import { useTenant } from '@/src/components/shell/TenantProvider';
import { WENDORO_MODULES } from '@/src/core/registry/modules';

export function ModuleRoadmapView({
  moduleSlug,
  onBack,
}: {
  moduleSlug: string;
  onBack: () => void;
}) {
  const { activeCompany, toggleCompanyModule } = useTenant();
  const mod = WENDORO_MODULES.find((m) => m.slug === moduleSlug);

  if (!mod) {
    return (
      <Surface>
        <p className="text-sm text-[#718096] dark:text-slate-400">
          Module specification not found.
        </p>
        <div className="mt-4">
          <Button variant="outline" size="sm" onClick={onBack}>
            Return to Overview
          </Button>
        </div>
      </Surface>
    );
  }

  const isEnabled = mod.alwaysActive || activeCompany.enabledModules.includes(mod.slug);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#718096] hover:text-[#1C1917] dark:text-slate-400 dark:hover:text-slate-100 mb-2 cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Executive Shell
          </button>
          <h1 className="text-2xl font-bold tracking-tight text-[#1C1917] dark:text-slate-100">
            {mod.name}
          </h1>
          <p className="mt-1 text-xs text-[#718096] dark:text-slate-400 font-mono">
            Layer: {mod.layer.toUpperCase()} · Schema: {mod.schemaNamespace}.* · Target:{' '}
            {mod.targetPhase}
          </p>
        </div>

        {!mod.alwaysActive && (
          <Button
            variant={isEnabled ? 'outline' : 'primary'}
            size="sm"
            onClick={() => toggleCompanyModule(mod.slug)}
          >
            {isEnabled
              ? `Disable for ${activeCompany.companyCode}`
              : `Enable for ${activeCompany.companyCode}`}
          </Button>
        )}
      </div>

      <Surface>
        <div className="flex items-start gap-3">
          <Layers className="h-5 w-5 text-[#DC2626] shrink-0 mt-0.5" />
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-[#1C1917] dark:text-slate-100">
              Module Specification & Implementation Boundary
            </h2>
            <p className="text-sm text-[#718096] dark:text-slate-400 leading-relaxed">
              {mod.description}
            </p>
            <p className="text-xs text-[#718096] dark:text-slate-400">
              This module is scheduled for <span className="font-semibold">{mod.targetPhase}</span>{' '}
              and is intentionally kept free of static mock transactions during Phase 0 Foundation.
              Its full implementation will include PostgreSQL migrations, RLS policies, Zod API
              contracts, RBAC permissions, and automated integration tests.
            </p>
          </div>
        </div>
      </Surface>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Surface>
          <h3 className="text-sm font-semibold text-[#1C1917] dark:text-slate-100 mb-3">
            Planned Capabilities
          </h3>
          <ul className="space-y-2 text-xs text-[#1C1917] dark:text-slate-200">
            {mod.capabilities.map((cap) => (
              <li
                key={cap}
                className="py-1.5 border-b last:border-b-0 border-slate-200/70 dark:border-[#32242A]"
              >
                {cap}
              </li>
            ))}
          </ul>
        </Surface>

        <Surface>
          <h3 className="text-sm font-semibold text-[#1C1917] dark:text-slate-100 mb-3">
            Core Platform Dependencies
          </h3>
          {mod.dependencies.length === 0 ? (
            <p className="text-xs text-[#718096] dark:text-slate-400">
              Base Layer A service with no upstream module dependencies.
            </p>
          ) : (
            <ul className="space-y-2 text-xs">
              {mod.dependencies.map((dep) => (
                <li
                  key={dep}
                  className="py-1.5 border-b last:border-b-0 border-slate-200/70 dark:border-[#32242A] font-mono text-[#DC2626]"
                >
                  {dep}
                </li>
              ))}
            </ul>
          )}
        </Surface>
      </div>
    </div>
  );
}
