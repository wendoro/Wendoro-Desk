import React from 'react';
import {
  ArrowRight,
  Boxes,
  Building2,
  FileText,
  FolderKanban,
  LifeBuoy,
  Megaphone,
  Plus,
  Receipt,
  Settings,
  ShoppingBag,
  Truck,
  Users,
  Wallet,
} from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { EmptyState } from '@/src/components/ui/StateViews';
import { Surface } from '@/src/components/ui/Surface';
import { useErpData } from '@/src/components/shell/ErpDataProvider';
import { useTenant } from '@/src/components/shell/TenantProvider';
import { WENDORO_MODULES } from '@/src/core/registry/modules';
import { formatNumericCurrency } from '@/src/lib/utils';

const MODULE_META_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  catalogue: Boxes,
  crm: Users,
  sales: Receipt,
  purchase: ShoppingBag,
  inventory: Truck,
  accounting: Wallet,
  hrms: Users,
  projects: FolderKanban,
  marketing: Megaphone,
  support: LifeBuoy,
  documents: FileText,
};

export function DashboardOverview({
  onNavigate,
}: {
  onNavigate: (routeId: string) => void;
}) {
  const { activeCompany, activeBranchId } = useTenant();
  const { data, metrics } = useErpData();

  const currency = activeCompany.baseCurrency;
  const activeBranch = activeCompany.branches.find((b) => b.id === activeBranchId);

  const activeModules = WENDORO_MODULES.filter(
    (m) => m.layer !== 'core' && activeCompany.enabledModules.includes(m.slug),
  );

  const getModuleCountLabel = (slug: string): string => {
    switch (slug) {
      case 'catalogue':
        return `${data.catalogue.length} items`;
      case 'crm':
        return `${data.contacts.length} contacts`;
      case 'sales':
        return `${data.salesOrders.length} orders`;
      case 'purchase':
        return `${data.purchaseOrders.length} POs`;
      case 'inventory':
        return `${data.stockMovements.length} movements`;
      case 'accounting':
        return `${data.ledgerEntries.length} entries`;
      case 'hrms':
        return `${data.employees.length} staff`;
      case 'projects':
        return `${data.projectTasks.length} tasks`;
      case 'support':
        return `${data.supportTickets.length} tickets`;
      case 'documents':
        return `${data.documents.length} files`;
      case 'marketing':
        return `${data.campaigns.length} campaigns`;
      default: {
        const count = data.industryRecords.filter((r) => r.moduleSlug === slug).length;
        return `${count} records`;
      }
    }
  };

  return (
    <div className="space-y-8">
      {/* Header & Quick Actions */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#718096] dark:text-slate-400 mb-1">
            <Building2 className="h-3.5 w-3.5 text-[#4169F5]" />
            <span>{activeCompany.companyCode}</span>
            <span aria-hidden="true">·</span>
            <span>{activeBranch ? activeBranch.name : 'All Branches'}</span>
            <span aria-hidden="true">·</span>
            <span>{currency}</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-[#182238] dark:text-slate-100">
            {activeCompany.companyName}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button variant="primary" size="sm" onClick={() => onNavigate('module:sales')}>
            <Plus className="h-3.5 w-3.5" />
            New Invoice
          </Button>
          <Button variant="outline" size="sm" onClick={() => onNavigate('module:catalogue')}>
            <Plus className="h-3.5 w-3.5" />
            Add Product
          </Button>
          <Button variant="outline" size="sm" onClick={() => onNavigate('module:crm')}>
            <Plus className="h-3.5 w-3.5" />
            Add Contact
          </Button>
          <Button variant="outline" size="sm" onClick={() => onNavigate('admin')}>
            <Settings className="h-3.5 w-3.5 text-[#718096]" />
            Manage Modules
          </Button>
        </div>
      </div>

      {/* Live Financial & Operational KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Surface>
          <div className="text-xs text-[#718096] dark:text-slate-400">Recorded Revenue</div>
          <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-[#182238] dark:text-slate-100">
            {formatNumericCurrency(metrics.totalRevenue, currency, 2)}
          </div>
          <div className="mt-1 text-[11px] text-[#718096] dark:text-slate-400">
            Open receivables: {formatNumericCurrency(metrics.openReceivables, currency, 2)}
          </div>
        </Surface>

        <Surface>
          <div className="text-xs text-[#718096] dark:text-slate-400">Recorded Expenses</div>
          <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-[#182238] dark:text-slate-100">
            {formatNumericCurrency(metrics.totalExpenses, currency, 2)}
          </div>
          <div className="mt-1 text-[11px] text-[#718096] dark:text-slate-400">
            Open payables: {formatNumericCurrency(metrics.openPayables, currency, 2)}
          </div>
        </Surface>

        <Surface>
          <div className="text-xs text-[#718096] dark:text-slate-400">Net Position</div>
          <div
            className={`mt-1.5 text-2xl font-bold font-mono tabular-nums ${
              metrics.netIncome >= 0
                ? 'text-[#16B8A6]'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {formatNumericCurrency(metrics.netIncome, currency, 2)}
          </div>
          <div className="mt-1 text-[11px] text-[#718096] dark:text-slate-400">
            {data.ledgerEntries.length} posted ledger entries
          </div>
        </Surface>

        <Surface>
          <div className="text-xs text-[#718096] dark:text-slate-400">Operations Queue</div>
          <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-[#182238] dark:text-slate-100">
            {metrics.lowStockCount + metrics.openTasksCount + metrics.openTicketsCount}
          </div>
          <div className="mt-1 text-[11px] text-[#718096] dark:text-slate-400">
            {metrics.lowStockCount} low stock · {metrics.openTasksCount} tasks ·{' '}
            {metrics.openTicketsCount} tickets
          </div>
        </Surface>
      </div>

      {/* Active Operational Applications */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-[#182238] dark:text-slate-100">
            Active Applications ({activeModules.length})
          </h2>
          <button
            type="button"
            onClick={() => onNavigate('admin')}
            className="text-xs font-medium text-[#4169F5] hover:underline cursor-pointer whitespace-nowrap"
          >
            Enable or disable modules
          </button>
        </div>

        {activeModules.length === 0 ? (
          <EmptyState
            title="No operational apps enabled"
            description="Activate Catalogue, Sales, Inventory, Accounting, or HRMS in Module Settings to start managing operations."
            actionLabel="Configure Modules"
            onAction={() => onNavigate('admin')}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {activeModules.map((mod) => {
              const Icon = MODULE_META_ICONS[mod.slug] ?? Building2;
              return (
                <button
                  key={mod.slug}
                  type="button"
                  onClick={() => onNavigate(`module:${mod.slug}`)}
                  className="text-left p-4 rounded-xl bg-white dark:bg-[#101B35] border border-slate-200 dark:border-[#223257] hover:border-[#4169F5] transition-colors cursor-pointer flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-lg bg-[#F6F8FC] dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257] flex items-center justify-center shrink-0">
                        <Icon className="h-4 w-4 text-[#4169F5]" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-[#182238] dark:text-slate-100">
                          {mod.name}
                        </div>
                        <div className="text-[11px] text-[#718096] dark:text-slate-400 font-mono tabular-nums">
                          {getModuleCountLabel(mod.slug)}
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-[#718096] shrink-0" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Recent Sales & Recent Ledger Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Surface padding="none" className="overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-[#223257] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#182238] dark:text-slate-100">
              Recent Sales Invoices & Quotes
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('module:sales')}
              className="text-xs font-medium text-[#4169F5] hover:underline cursor-pointer"
            >
              Open Sales
            </button>
          </div>
          {data.salesOrders.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <p className="text-sm font-medium text-[#182238] dark:text-slate-100">
                No sales orders recorded yet
              </p>
              <p className="text-xs text-[#718096] dark:text-slate-400">
                Create your first quote or invoice to track revenue and stock dispatch.
              </p>
              <div className="pt-2">
                <Button size="sm" onClick={() => onNavigate('module:sales')}>
                  Create Invoice
                </Button>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-200/80 dark:divide-[#223257]">
              {data.salesOrders.slice(0, 5).map((order) => (
                <div
                  key={order.id}
                  className="px-5 py-3 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-[#182238] dark:text-slate-100 truncate">
                      {order.documentNumber} · {order.customerName}
                    </div>
                    <div className="text-[11px] text-[#718096] dark:text-slate-400 capitalize">
                      {order.issueDate} · {order.status}
                    </div>
                  </div>
                  <div className="font-mono font-semibold tabular-nums text-[#182238] dark:text-slate-100 shrink-0">
                    {formatNumericCurrency(order.grandTotal, currency, 2)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Surface>

        <Surface padding="none" className="overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-[#223257] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#182238] dark:text-slate-100">
              Recent Accounting Ledger
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('module:accounting')}
              className="text-xs font-medium text-[#4169F5] hover:underline cursor-pointer"
            >
              Open Ledger
            </button>
          </div>
          {data.ledgerEntries.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <p className="text-sm font-medium text-[#182238] dark:text-slate-100">
                No ledger entries posted yet
              </p>
              <p className="text-xs text-[#718096] dark:text-slate-400">
                Paid invoices, received POs, payroll runs, and manual vouchers appear here.
              </p>
              <div className="pt-2">
                <Button size="sm" variant="outline" onClick={() => onNavigate('module:accounting')}>
                  Record Entry
                </Button>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-200/80 dark:divide-[#223257]">
              {data.ledgerEntries.slice(0, 5).map((entry) => (
                <div
                  key={entry.id}
                  className="px-5 py-3 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-[#182238] dark:text-slate-100 truncate">
                      {entry.accountName} · {entry.reference}
                    </div>
                    <div className="text-[11px] text-[#718096] dark:text-slate-400 truncate">
                      {entry.date} · {entry.description}
                    </div>
                  </div>
                  <div
                    className={`font-mono font-semibold tabular-nums shrink-0 ${
                      entry.entryType === 'income'
                        ? 'text-[#16B8A6]'
                        : 'text-[#182238] dark:text-slate-100'
                    }`}
                  >
                    {entry.entryType === 'income' ? '+' : '-'}
                    {formatNumericCurrency(entry.amount, currency, 2)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Surface>
      </div>
    </div>
  );
}
