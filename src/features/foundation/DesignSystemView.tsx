import React, { useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { DataColumn, DataTable } from '@/src/components/ui/DataTable';
import { Surface } from '@/src/components/ui/Surface';
import { useTheme } from '@/src/components/shell/ThemeProvider';
import {
  LicensePlanDefinition,
  WENDORO_LICENSE_PLANS,
} from '@/src/core/contracts/licensing';
import { formatNumericCurrency } from '@/src/lib/utils';

const PALETTE_TOKENS = [
  { name: 'Midnight Navy', hex: '#101B35', role: 'Navigation Rail & Dark Surface' },
  { name: 'Electric Blue', hex: '#4169F5', role: 'Primary Actions & Focus Ring' },
  { name: 'Violet', hex: '#8B5CF6', role: 'Industry Extensions & AI Highlights' },
  { name: 'Teal', hex: '#16B8A6', role: 'Nominal / Active & Verified State' },
  { name: 'Background Light', hex: '#F6F8FC', role: 'Light Workspace Canvas' },
  { name: 'Surface', hex: '#FFFFFF', role: 'Primary Elevated Surface' },
  { name: 'Text Primary', hex: '#182238', role: 'High-Contrast Copy' },
  { name: 'Muted Text', hex: '#718096', role: 'Secondary Metadata & Labels' },
];

export function DesignSystemView() {
  const { theme, toggleTheme } = useTheme();
  const [tableState, setTableState] = useState<'populated' | 'loading' | 'empty' | 'error'>('populated');
  const [currency, setCurrency] = useState<'INR' | 'USD'>('INR');

  const columns: DataColumn<LicensePlanDefinition>[] = [
    {
      key: 'tier',
      header: 'Plan & Edition',
      sortable: true,
      sortValue: (r) => r.name,
      render: (r) => (
        <div>
          <div className="font-semibold">{r.name}</div>
          <div className="text-[11px] text-[#718096] dark:text-slate-400">
            {r.edition === 'open_source'
              ? 'Open-Source (Apache-2.0)'
              : r.edition === 'commercial'
                ? 'Commercial Cloud'
                : 'OEM / Self-Hosted'}
          </div>
        </div>
      ),
    },
    {
      key: 'segment',
      header: 'Target Organization',
      render: (r) => (
        <span className="text-[#718096] dark:text-slate-400">{r.targetSegment}</span>
      ),
    },
    {
      key: 'users',
      header: 'Users',
      align: 'right',
      numeric: true,
      sortable: true,
      sortValue: (r) => r.maxUsers,
      render: (r) => <span>{r.maxUsers.toLocaleString()}</span>,
    },
    {
      key: 'companies',
      header: 'Companies',
      align: 'right',
      numeric: true,
      sortable: true,
      sortValue: (r) => r.maxCompanies,
      render: (r) => <span>{r.maxCompanies.toLocaleString()}</span>,
    },
    {
      key: 'price',
      header: `Monthly (${currency})`,
      align: 'right',
      numeric: true,
      render: (r) => (
        <span>
          {formatNumericCurrency(
            currency === 'INR' ? r.monthlyPriceInr : r.monthlyPriceUsd,
            currency,
            2,
          )}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#4169F5] mb-1">
            WENDORO UI Foundation · Light & Dark Tokens
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-[#182238] dark:text-slate-100">
            Design System Specimen
          </h1>
          <p className="mt-1.5 text-sm text-[#718096] dark:text-slate-400 max-w-2xl">
            Lightweight enterprise UI governed by 1px hairline elevation, zero-pill metadata,
            tabular numerals for financial alignment, and accessible light/dark surface pairing.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={toggleTheme}>
          {theme === 'dark' ? (
            <>
              <Sun className="h-4 w-4 text-amber-400" />
              Switch to Light Mode
            </>
          ) : (
            <>
              <Moon className="h-4 w-4 text-[#4169F5]" />
              Switch to Dark Mode
            </>
          )}
        </Button>
      </div>

      {/* Color Palette */}
      <Surface>
        <h2 className="text-sm font-semibold text-[#182238] dark:text-slate-100 mb-4">
          Approved WENDORO Palette
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {PALETTE_TOKENS.map((token) => (
            <div
              key={token.name}
              className="rounded-lg border border-slate-200 dark:border-[#223257] overflow-hidden"
            >
              <div
                className="h-12 w-full border-b border-slate-200/70 dark:border-[#223257]"
                style={{ backgroundColor: token.hex }}
              />
              <div className="p-2.5 bg-white dark:bg-[#0E172E]">
                <div className="text-xs font-semibold text-[#182238] dark:text-slate-100">
                  {token.name}
                </div>
                <div className="font-mono text-[11px] text-[#718096] dark:text-slate-400">
                  {token.hex}
                </div>
                <div className="text-[11px] text-[#718096] dark:text-slate-400 mt-0.5">
                  {token.role}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Surface>

      {/* Typography & Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Surface>
          <h2 className="text-sm font-semibold text-[#182238] dark:text-slate-100 mb-4">
            Typography Hierarchy (2+1 System)
          </h2>
          <div className="space-y-4">
            <div>
              <div className="text-[11px] text-[#718096] dark:text-slate-400">
                Display · Plus Jakarta Sans
              </div>
              <div className="font-display text-xl font-bold text-[#182238] dark:text-slate-100">
                Universal Multi-Tenant Operations
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[#718096] dark:text-slate-400">
                Body Prose · DM Sans
              </div>
              <p className="text-sm text-[#182238] dark:text-slate-200 leading-relaxed">
                Clean, dense, scannable enterprise interfaces prioritizing information clarity
                and keyboard accessibility over decorative visual noise.
              </p>
            </div>
            <div>
              <div className="text-[11px] text-[#718096] dark:text-slate-400">
                Tabular Financials & Keys · JetBrains Mono
              </div>
              <div className="font-mono text-sm tabular-nums text-[#182238] dark:text-slate-100">
                {formatNumericCurrency('148920.4500', 'USD', 4)} · TENANT_RLS_VERIFIED
              </div>
            </div>
          </div>
        </Surface>

        <Surface>
          <h2 className="text-sm font-semibold text-[#182238] dark:text-slate-100 mb-4">
            Interactive Button Primitives
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary">Primary Action</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Revoke Access</Button>
          </div>
          <p className="mt-4 text-xs text-[#718096] dark:text-slate-400 leading-relaxed">
            All interactive controls enforce single-line labels (<code className="font-mono">whitespace-nowrap</code>),
            consistent height proportions, and WCAG AA <code className="font-mono">focus-visible</code> rings.
          </p>
        </Surface>
      </div>

      {/* DataTable + State Completeness Specimen */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[#182238] dark:text-slate-100">
              Open-Source & Commercial License Matrix
            </h2>
            <p className="text-xs text-[#718096] dark:text-slate-400">
              Canonical entitlements from <code className="font-mono">licensing.ts</code> with
              table state switcher.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-[#162342]">
              {(['INR', 'USD'] as const).map((cur) => (
                <button
                  key={cur}
                  type="button"
                  onClick={() => setCurrency(cur)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap ${
                    currency === cur
                      ? 'bg-white dark:bg-[#101B35] text-[#182238] dark:text-slate-100 shadow-xs'
                      : 'text-[#718096] dark:text-slate-400 hover:text-[#182238] dark:hover:text-slate-100'
                  }`}
                >
                  {cur}
                </button>
              ))}
            </div>

            <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-[#162342]">
              {(['populated', 'loading', 'empty', 'error'] as const).map((state) => (
                <button
                  key={state}
                  type="button"
                  onClick={() => setTableState(state)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize cursor-pointer whitespace-nowrap ${
                    tableState === state
                      ? 'bg-white dark:bg-[#101B35] text-[#182238] dark:text-slate-100 shadow-xs'
                      : 'text-[#718096] dark:text-slate-400 hover:text-[#182238] dark:hover:text-slate-100'
                  }`}
                >
                  {state}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DataTable
          data={tableState === 'empty' ? [] : WENDORO_LICENSE_PLANS}
          columns={columns}
          getRowKey={(r) => r.tier}
          isLoading={tableState === 'loading'}
          error={
            tableState === 'error'
              ? 'Simulated API failure: Unable to fetch subscription tier quotas from backend.'
              : null
          }
          onRetry={() => setTableState('populated')}
          searchPlaceholder="Filter license tiers..."
          searchPredicate={(row, q) =>
            `${row.name} ${row.tier} ${row.targetSegment}`.toLowerCase().includes(q)
          }
          emptyTitle="No license tiers matched"
          emptyDescription="Reset the state switcher or create a custom plan tier to populate the licensing grid."
          emptyActionLabel="Restore Plans"
          onEmptyAction={() => setTableState('populated')}
        />
      </section>
    </div>
  );
}
