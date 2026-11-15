import React, { useState } from 'react';
import { Database, Lock } from 'lucide-react';
import { DataColumn, DataTable } from '@/src/components/ui/DataTable';
import { Surface } from '@/src/components/ui/Surface';
import { SCHEMA_NAMESPACES } from '@/src/db/schema';

interface CoreTableSpec {
  schema: string;
  tableName: string;
  rlsPolicy: string;
  primaryKey: string;
  keyColumns: string;
  purpose: string;
}

const CORE_TABLES: CoreTableSpec[] = [
  {
    schema: 'identity',
    tableName: 'users',
    rlsPolicy: 'Global Identity (Session-scoped)',
    primaryKey: 'uuid',
    keyColumns: 'email (unique), full_name, mfa_enabled, is_platform_admin',
    purpose: 'Better Auth human/service principal decoupled from business roles',
  },
  {
    schema: 'identity',
    tableName: 'sessions',
    rlsPolicy: 'Owner user_id check',
    primaryKey: 'uuid',
    keyColumns: 'user_id, token (unique), active_tenant_id, active_company_id, active_branch_id',
    purpose: 'Tracks active company/branch context and device session revocation',
  },
  {
    schema: 'identity',
    tableName: 'accounts',
    rlsPolicy: 'Owner user_id check',
    primaryKey: 'uuid',
    keyColumns: 'user_id, provider_id, account_id, access_token_encrypted',
    purpose: 'Credential hashes and encrypted OAuth provider bindings',
  },
  {
    schema: 'organization',
    tableName: 'tenants',
    rlsPolicy: 'tenant_id = current_tenant_id()',
    primaryKey: 'uuid',
    keyColumns: 'slug (unique), name, status, data_region',
    purpose: 'Top-level billing, licensing & data isolation boundary',
  },
  {
    schema: 'organization',
    tableName: 'companies',
    rlsPolicy: 'RLS: tenant_id = current_tenant_id()',
    primaryKey: 'uuid',
    keyColumns: 'tenant_id, code, legal_name, base_currency, fiscal_year_start_month',
    purpose: 'Independent legal operating entities within a tenant',
  },
  {
    schema: 'organization',
    tableName: 'branches',
    rlsPolicy: 'RLS: tenant_id + company_id',
    primaryKey: 'uuid',
    keyColumns: 'tenant_id, company_id, code, name, is_headquarters',
    purpose: 'Physical or logical business locations per company',
  },
  {
    schema: 'organization',
    tableName: 'memberships',
    rlsPolicy: 'RLS: tenant_id = current_tenant_id()',
    primaryKey: 'uuid',
    keyColumns: 'tenant_id, company_id, user_id, default_branch_id, status',
    purpose: 'Links an identity user to a company with independent status',
  },
  {
    schema: 'organization',
    tableName: 'roles / role_permissions',
    rlsPolicy: 'RLS: tenant_id = current_tenant_id()',
    primaryKey: 'uuid',
    keyColumns: 'tenant_id, company_id, slug, scope (tenant | company | branch)',
    purpose: 'Composable RBAC definitions and permission mappings',
  },
  {
    schema: 'organization',
    tableName: 'company_modules',
    rlsPolicy: 'RLS: tenant_id + company_id',
    primaryKey: 'uuid',
    keyColumns: 'tenant_id, company_id, module_slug, layer, is_enabled',
    purpose: 'Independent per-company Layer B & Layer C application activation',
  },
  {
    schema: 'subscriptions',
    tableName: 'plans / tenant_subscriptions',
    rlsPolicy: 'Backend Entitlement Gate',
    primaryKey: 'uuid',
    keyColumns: 'tier, monthly_price NUMERIC(19,4), max_users, max_companies, allowed_modules',
    purpose: 'Hard backend enforcement of licensing quotas & module limits',
  },
  {
    schema: 'audit',
    tableName: 'audit_logs',
    rlsPolicy: 'RLS + Immutable Trigger',
    primaryKey: 'uuid',
    keyColumns: 'tenant_id, company_id, actor_user_id, action, before_state, after_state',
    purpose: 'Append-only audit trail protected against UPDATE and DELETE',
  },
];

export function SchemaExplorerView() {
  const [selectedSchema, setSelectedSchema] = useState<string>('all');

  const filteredTables =
    selectedSchema === 'all'
      ? CORE_TABLES
      : CORE_TABLES.filter((t) => t.schema === selectedSchema);

  const columns: DataColumn<CoreTableSpec>[] = [
    {
      key: 'table',
      header: 'Schema & Table',
      sortable: true,
      sortValue: (r) => `${r.schema}.${r.tableName}`,
      render: (r) => (
        <span className="font-mono text-xs font-medium text-[#DC2626]">
          {r.schema}.{r.tableName}
        </span>
      ),
    },
    {
      key: 'rls',
      header: 'Isolation / Policy',
      render: (r) => (
        <span className="inline-flex items-center gap-1.5 text-xs text-[#16B8A6] font-medium whitespace-nowrap">
          <Lock className="h-3 w-3 shrink-0" />
          {r.rlsPolicy}
        </span>
      ),
    },
    {
      key: 'columns',
      header: 'Core Columns & Constraints',
      render: (r) => (
        <span className="font-mono text-xs text-[#718096] dark:text-slate-400">
          {r.keyColumns}
        </span>
      ),
    },
    {
      key: 'purpose',
      header: 'Architectural Responsibility',
      render: (r) => <span className="text-xs">{r.purpose}</span>,
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-medium text-[#F59E0B] mb-1">
          PostgreSQL · Drizzle ORM · Migration 0000
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-[#1C1917] dark:text-slate-100">
          Architecture & Core Database Schema
        </h1>
        <p className="mt-1.5 text-sm text-[#718096] dark:text-slate-400 max-w-3xl">
          Domain-partitioned PostgreSQL schemas with UUID primary keys, strict foreign key
          integrity, NUMERIC(19, 4) financial columns, and transaction-scoped Row-Level Security.
        </p>
      </div>

      {/* Domain Schema Namespaces */}
      <Surface>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-[#1C1917] dark:text-slate-100 flex items-center gap-2">
            <Database className="h-4 w-4 text-[#DC2626]" />
            PostgreSQL Schema Namespaces ({SCHEMA_NAMESPACES.length})
          </h2>
          <span className="text-xs text-[#718096] dark:text-slate-400">
            5 Defined in Phase 0 · 10 Planned for Phases 3–10
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {SCHEMA_NAMESPACES.map((ns) => (
            <div
              key={ns.namespace}
              className="p-3 rounded-lg border border-slate-200 dark:border-[#32242A] bg-[#FAF9F7]/60 dark:bg-[#141013]"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-semibold text-[#1C1917] dark:text-slate-100">
                  {ns.namespace}.*
                </span>
                <span
                  className={`text-[11px] font-medium ${
                    ns.status === 'defined'
                      ? 'text-[#16B8A6]'
                      : 'text-[#718096] dark:text-slate-400'
                  }`}
                >
                  {ns.status === 'defined' ? 'Schema Defined' : ns.phase}
                </span>
              </div>
              <p className="mt-1 text-xs text-[#718096] dark:text-slate-400">
                {ns.description}
              </p>
            </div>
          ))}
        </div>
      </Surface>

      {/* Core Tables DataTable */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-[#1C1917] dark:text-slate-100">
            Phase 0 Defined Tables & RLS Policies
          </h2>
          <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-[#251B20] self-start">
            {['all', 'identity', 'organization', 'subscriptions', 'audit'].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSelectedSchema(s)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap ${
                  selectedSchema === s
                    ? 'bg-white dark:bg-[#1B1417] text-[#1C1917] dark:text-slate-100 shadow-xs'
                    : 'text-[#718096] dark:text-slate-400 hover:text-[#1C1917] dark:hover:text-slate-100'
                }`}
              >
                {s === 'all' ? 'All Schemas' : s}
              </button>
            ))}
          </div>
        </div>

        <DataTable
          data={filteredTables}
          columns={columns}
          getRowKey={(r) => `${r.schema}.${r.tableName}`}
          searchPlaceholder="Filter tables or columns..."
          searchPredicate={(row, q) =>
            `${row.schema}.${row.tableName} ${row.keyColumns} ${row.purpose}`
              .toLowerCase()
              .includes(q)
          }
        />
      </section>

      {/* Transaction-Scoped RLS Snippet */}
      <Surface>
        <h2 className="text-sm font-semibold text-[#1C1917] dark:text-slate-100 mb-2">
          Transaction-Scoped RLS Pattern (Hyperdrive & PgBouncer Safe)
        </h2>
        <p className="text-xs text-[#718096] dark:text-slate-400 mb-3">
          Defined in <code className="font-mono">src/db/rls-context.ts</code> and{' '}
          <code className="font-mono">src/db/migrations/0000_core_foundation_rls.sql</code>.
          Every database request runs inside a transaction that sets local session parameters
          automatically cleared on commit or rollback.
        </p>
        <pre className="p-4 rounded-lg bg-[#1B1417] text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed">
{`await withTenantContext(db, { tenantId, companyId, userId }, async (tx) => {
  // Executes inside PostgreSQL transaction:
  //   SELECT set_config('app.current_tenant_id', $1, true);
  //   SELECT set_config('app.current_company_id', $2, true);
  return tx.select().from(branches);
});`}
        </pre>
      </Surface>
    </div>
  );
}
