import React, { useState } from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import { Surface } from '@/src/components/ui/Surface';

interface CriterionItem {
  id: string;
  phase: 'phase0' | 'phase1';
  title: string;
  verification: string;
  completed: boolean;
}

const CRITERIA_ITEMS: CriterionItem[] = [
  {
    id: 'AC-0.1',
    phase: 'phase0',
    title: 'WENDORO Technical Architecture Document',
    verification: 'docs/ARCHITECTURE.md defines 3-layer modularity, RLS isolation, and portable adapters.',
    completed: true,
  },
  {
    id: 'AC-0.2',
    phase: 'phase0',
    title: 'Core PostgreSQL Drizzle Schema',
    verification: 'src/db/schema/*.ts defines identity, organization, core, subscriptions, and audit tables.',
    completed: true,
  },
  {
    id: 'AC-0.3',
    phase: 'phase0',
    title: 'Versioned SQL Migration & RLS Policies',
    verification: 'src/db/migrations/0000_core_foundation_rls.sql + src/db/rls-context.ts.',
    completed: true,
  },
  {
    id: 'AC-0.4',
    phase: 'phase0',
    title: 'Identity & Multi-Tenancy Zod Contracts',
    verification: 'src/core/contracts/tenancy.ts separates user identity from company/branch roles.',
    completed: true,
  },
  {
    id: 'AC-0.5',
    phase: 'phase0',
    title: 'Enterprise Design System & Dual-Theme Shell',
    verification: 'Light/Dark tokens, collapsible sidebar, company/branch switchers, and Ctrl+K palette.',
    completed: true,
  },
  {
    id: 'AC-1.1',
    phase: 'phase1',
    title: 'Better Auth + PostgreSQL Integration',
    verification: 'Live registration, login, session cookies, and multi-company onboarding flow.',
    completed: false,
  },
  {
    id: 'AC-1.2',
    phase: 'phase1',
    title: 'Organization, Branch, Department & RBAC APIs',
    verification: 'Validated /api/v1/org/* endpoints enforcing membership and backend entitlements.',
    completed: false,
  },
  {
    id: 'AC-1.3',
    phase: 'phase1',
    title: 'Cross-Tenant Security Integration Tests',
    verification: 'Automated test suite verifying Company A cannot access Company B records via API or SQL.',
    completed: false,
  },
];

export function MilestonePlanView() {
  const [filter, setFilter] = useState<'all' | 'phase0' | 'phase1'>('all');

  const items = CRITERIA_ITEMS.filter((i) =>
    filter === 'all' ? true : i.phase === filter,
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#16B8A6] mb-1">
            Foundation Sign-Off & Phase 1 Gate
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-[#1C1917] dark:text-slate-100">
            Milestone 1 Plan & Acceptance Criteria
          </h1>
          <p className="mt-1.5 text-sm text-[#718096] dark:text-slate-400 max-w-2xl">
            Phase 0 establishes the architectural, schema, and UI foundation. Phase 1 begins
            upon approval to wire Better Auth, PostgreSQL migrations, and RBAC endpoints.
          </p>
        </div>

        <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-[#251B20] self-start">
          {([
            { id: 'all', label: 'All Gates' },
            { id: 'phase0', label: 'Phase 0 Ready' },
            { id: 'phase1', label: 'Phase 1 Next' },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap ${
                filter === tab.id
                  ? 'bg-white dark:bg-[#1B1417] text-[#1C1917] dark:text-slate-100 shadow-xs'
                  : 'text-[#718096] dark:text-slate-400 hover:text-[#1C1917] dark:hover:text-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <Surface padding="none">
        <div className="divide-y divide-slate-200 dark:divide-[#32242A]">
          {items.map((item) => (
            <div
              key={item.id}
              className="p-4 flex items-start justify-between gap-4"
            >
              <div className="flex items-start gap-3">
                {item.completed ? (
                  <CheckCircle2 className="h-5 w-5 text-[#16B8A6] shrink-0 mt-0.5" />
                ) : (
                  <Circle className="h-5 w-5 text-slate-400 dark:text-slate-500 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="flex items-center gap-2 text-xs text-[#718096] dark:text-slate-400">
                    <span className="font-mono font-semibold">{item.id}</span>
                    <span aria-hidden="true">·</span>
                    <span>{item.phase === 'phase0' ? 'Phase 0 Foundation' : 'Phase 1 Milestone'}</span>
                  </div>
                  <h3 className="mt-0.5 text-sm font-semibold text-[#1C1917] dark:text-slate-100">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-xs text-[#718096] dark:text-slate-400">
                    {item.verification}
                  </p>
                </div>
              </div>

              <span
                className={`text-xs font-medium whitespace-nowrap shrink-0 ${
                  item.completed
                    ? 'text-[#16B8A6]'
                    : 'text-[#718096] dark:text-slate-400'
                }`}
              >
                {item.completed ? 'Implemented' : 'Scheduled'}
              </span>
            </div>
          ))}
        </div>
      </Surface>
    </div>
  );
}
