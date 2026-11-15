import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
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
  TrendingUp,
  Truck,
  Users,
  Wallet,
} from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { EmptyState } from '@/src/components/ui/StateViews';
import { Surface } from '@/src/components/ui/Surface';
import {
  DonutChart,
  GroupedBarChart,
  RevenueAreaChart,
  SparklineChart,
} from '@/src/components/charts/ErpCharts';
import { useErpData } from '@/src/components/shell/ErpDataProvider';
import { useTenant } from '@/src/components/shell/TenantProvider';
import {
  buildBalanceCompositionSlices,
  buildRevenueExpenseSeries,
  buildSalesChannelBars,
} from '@/src/core/engine/chartDataHelpers';
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
  const { data, metrics, trialBalance } = useErpData();
  const [granularity, setGranularity] = useState<'month' | 'day'>('month');

  const currency = activeCompany.baseCurrency;
  const activeBranch = activeCompany.branches.find((b) => b.id === activeBranchId);

  const activeModules = WENDORO_MODULES.filter(
    (m) => m.layer !== 'core' && activeCompany.enabledModules.includes(m.slug),
  );

  const cashFlowSeries = useMemo(
    () => buildRevenueExpenseSeries(data, granularity),
    [data, granularity],
  );
  const balanceSlices = useMemo(
    () => buildBalanceCompositionSlices(trialBalance.rows),
    [trialBalance.rows],
  );
  const channelBars = useMemo(() => buildSalesChannelBars(data), [data]);

  const topInventoryBars = useMemo(() => {
    return data.catalogue
      .filter((c) => c.trackStock && c.stockOnHand > 0)
      .map((c) => ({
        label: c.sku,
        primary: c.inventoryAssetValue,
        secondary: c.stockOnHand * c.sellingPrice,
      }))
      .sort((a, b) => b.primary - a.primary)
      .slice(0, 6);
  }, [data.catalogue]);

  const revSpark = useMemo(
    () => cashFlowSeries.map((d) => d.primary),
    [cashFlowSeries],
  );
  const expSpark = useMemo(
    () => cashFlowSeries.map((d) => d.secondary ?? 0),
    [cashFlowSeries],
  );
  const netSpark = useMemo(
    () => cashFlowSeries.map((d) => d.primary - (d.secondary ?? 0)),
    [cashFlowSeries],
  );

  const totalAssetsValue = useMemo(
    () => balanceSlices.slice(0, 4).reduce((s, x) => s + x.value, 0),
    [balanceSlices],
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
        return `${data.journals.length} journals`;
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
          <div className="flex items-center gap-2 text-xs text-[#64748B] dark:text-slate-400 mb-1.5">
            <Building2 className="h-3.5 w-3.5 text-[#DC2626]" />
            <span>{activeCompany.companyCode}</span>
            <span aria-hidden="true">·</span>
            <span>{activeBranch ? activeBranch.name : 'All Branches'}</span>
            <span aria-hidden="true">·</span>
            <span>{currency}</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-[#1C1917] dark:text-slate-100">
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
          <Button variant="outline" size="sm" onClick={() => onNavigate('bi_analytics')}>
            <BarChart3 className="h-3.5 w-3.5 text-[#DC2626]" />
            BI Analytics
          </Button>
          <Button variant="outline" size="sm" onClick={() => onNavigate('admin')}>
            <Settings className="h-3.5 w-3.5 text-[#64748B]" />
            Modules
          </Button>
        </div>
      </div>

      {/* Live Financial & Operational KPIs with Real Trend Sparklines */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Surface interactive>
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs font-medium text-[#64748B] dark:text-slate-400">
                Recorded Revenue
              </div>
              <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-[#1C1917] dark:text-slate-100">
                {formatNumericCurrency(metrics.totalRevenue, currency, 2)}
              </div>
            </div>
            <div className="h-8 w-8 rounded-lg bg-[#16B8A6]/10 text-[#16B8A6] flex items-center justify-center shrink-0">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <SparklineChart values={revSpark} color="#16B8A6" height={34} />
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-[#32242A] flex items-center justify-between text-[11px] text-[#64748B] dark:text-slate-400 font-mono tabular-nums">
            <span>Open Receivables</span>
            <span className="font-semibold text-[#1C1917] dark:text-slate-200">
              {formatNumericCurrency(metrics.openReceivables, currency, 2)}
            </span>
          </div>
        </Surface>

        <Surface interactive>
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs font-medium text-[#64748B] dark:text-slate-400">
                Recorded Expenses
              </div>
              <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-[#1C1917] dark:text-slate-100">
                {formatNumericCurrency(metrics.totalExpenses, currency, 2)}
              </div>
            </div>
            <div className="h-8 w-8 rounded-lg bg-[#DC2626]/10 text-[#DC2626] flex items-center justify-center shrink-0">
              <ShoppingBag className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <SparklineChart values={expSpark} color="#DC2626" height={34} />
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-[#32242A] flex items-center justify-between text-[11px] text-[#64748B] dark:text-slate-400 font-mono tabular-nums">
            <span>Open Payables</span>
            <span className="font-semibold text-[#1C1917] dark:text-slate-200">
              {formatNumericCurrency(metrics.openPayables, currency, 2)}
            </span>
          </div>
        </Surface>

        <Surface interactive>
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs font-medium text-[#64748B] dark:text-slate-400">
                Net Operating Position
              </div>
              <div
                className={`mt-1.5 text-2xl font-bold font-mono tabular-nums ${
                  metrics.netIncome >= 0
                    ? 'text-[#16B8A6]'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {formatNumericCurrency(metrics.netIncome, currency, 2)}
              </div>
            </div>
            <div className="h-8 w-8 rounded-lg bg-[#F59E0B]/10 text-[#F59E0B] flex items-center justify-center shrink-0">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <SparklineChart
              values={netSpark}
              color={metrics.netIncome >= 0 ? '#F59E0B' : '#DC2626'}
              height={34}
            />
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-[#32242A] flex items-center justify-between text-[11px] text-[#64748B] dark:text-slate-400 font-mono tabular-nums">
            <span>Stock Asset Value</span>
            <span className="font-semibold text-[#1C1917] dark:text-slate-200">
              {formatNumericCurrency(metrics.inventoryAssetValue, currency, 2)}
            </span>
          </div>
        </Surface>

        <Surface interactive>
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs font-medium text-[#64748B] dark:text-slate-400">
                Operations Queue
              </div>
              <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-[#1C1917] dark:text-slate-100">
                {metrics.lowStockCount + metrics.openTasksCount + metrics.openTicketsCount}
              </div>
            </div>
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Boxes className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 pt-1 text-center font-mono tabular-nums">
            <div className="rounded-lg bg-[#F4F7FB] dark:bg-[#251B20] py-1.5 px-1">
              <div className="text-xs font-bold text-[#1C1917] dark:text-slate-100">
                {metrics.lowStockCount}
              </div>
              <div className="text-[10px] font-sans text-[#64748B] dark:text-slate-400">
                Low Stock
              </div>
            </div>
            <div className="rounded-lg bg-[#F4F7FB] dark:bg-[#251B20] py-1.5 px-1">
              <div className="text-xs font-bold text-[#1C1917] dark:text-slate-100">
                {metrics.openTasksCount}
              </div>
              <div className="text-[10px] font-sans text-[#64748B] dark:text-slate-400">
                Tasks
              </div>
            </div>
            <div className="rounded-lg bg-[#F4F7FB] dark:bg-[#251B20] py-1.5 px-1">
              <div className="text-xs font-bold text-[#1C1917] dark:text-slate-100">
                {metrics.openTicketsCount}
              </div>
              <div className="text-[10px] font-sans text-[#64748B] dark:text-slate-400">
                Tickets
              </div>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-[#32242A] flex items-center justify-between text-[11px] text-[#64748B] dark:text-slate-400 font-mono tabular-nums">
            <span>Balanced Journals</span>
            <span className="font-semibold text-[#16B8A6]">{data.journals.length}</span>
          </div>
        </Surface>
      </div>

      {/* Primary Interactive Financial Graphs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Surface padding="lg" className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-[#1C1917] dark:text-slate-100">
                Revenue vs. Expense Performance
              </h2>
              <p className="text-[11px] text-[#64748B] dark:text-slate-400">
                Aggregated directly from posted double-entry general ledger accounts
              </p>
            </div>
            <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#251B20] self-start sm:self-auto">
              {(['month', 'day'] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGranularity(g)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md capitalize cursor-pointer transition-colors ${
                    granularity === g
                      ? 'bg-white dark:bg-[#1B1417] text-[#1C1917] dark:text-slate-100 shadow-xs'
                      : 'text-[#64748B] dark:text-slate-400'
                  }`}
                >
                  {g === 'month' ? 'Monthly' : 'Daily'}
                </button>
              ))}
            </div>
          </div>

          <RevenueAreaChart
            data={cashFlowSeries}
            primaryLabel="Revenue"
            secondaryLabel="Expenses"
            primaryColor="#16B8A6"
            secondaryColor="#DC2626"
            formatValue={(v) => formatNumericCurrency(v, currency, 0)}
            height={230}
            emptyMessage="Post sales invoices, expenses, or balanced journals to plot live revenue vs expense trends."
          />
        </Surface>

        <Surface padding="lg" className="space-y-4 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#1C1917] dark:text-slate-100">
              Working Capital & GL Mix
            </h2>
            <p className="text-[11px] text-[#64748B] dark:text-slate-400">
              Active balances across Cash, AR, Inventory & AP
            </p>
          </div>
          <DonutChart
            slices={balanceSlices}
            centerLabel="Gross Assets"
            centerValue={formatNumericCurrency(totalAssetsValue, currency, 0)}
            formatValue={(v) => formatNumericCurrency(v, currency, 0)}
            emptyMessage="Record opening stock, invoices, or cash journals to inspect balance allocation."
          />
        </Surface>
      </div>

      {/* Sales Channel & Inventory Valuation Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Surface padding="lg" className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-[#1C1917] dark:text-slate-100">
                Sales & Collection by Channel
              </h2>
              <p className="text-[11px] text-[#64748B] dark:text-slate-400">
                Invoiced total vs settled cash across Direct B2B, POS, and E-Commerce
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('module:sales')}
              className="text-xs font-medium text-[#DC2626] hover:underline cursor-pointer whitespace-nowrap"
            >
              Sales Desk
            </button>
          </div>
          <GroupedBarChart
            data={channelBars}
            primaryLabel="Invoiced"
            secondaryLabel="Collected"
            primaryColor="#DC2626"
            secondaryColor="#16B8A6"
            formatValue={(v) => formatNumericCurrency(v, currency, 0)}
            height={200}
            emptyMessage="Issue invoices or POS receipts to compare channel billing vs collections."
          />
        </Surface>

        <Surface padding="lg" className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-[#1C1917] dark:text-slate-100">
                Inventory Cost vs Retail Valuation
              </h2>
              <p className="text-[11px] text-[#64748B] dark:text-slate-400">
                Weighted-average stock cost compared with potential retail value
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('module:inventory')}
              className="text-xs font-medium text-[#DC2626] hover:underline cursor-pointer whitespace-nowrap"
            >
              Warehouse
            </button>
          </div>
          <GroupedBarChart
            data={topInventoryBars}
            primaryLabel="Asset Cost"
            secondaryLabel="Retail Value"
            primaryColor="#F59E0B"
            secondaryColor="#16B8A6"
            formatValue={(v) => formatNumericCurrency(v, currency, 0)}
            height={200}
            emptyMessage="Add stocked products in Catalogue or receive a Purchase Order to plot inventory valuation."
          />
        </Surface>
      </div>

      {/* Active Operational Applications */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-[#1C1917] dark:text-slate-100">
            Active Applications ({activeModules.length})
          </h2>
          <button
            type="button"
            onClick={() => onNavigate('admin')}
            className="text-xs font-medium text-[#DC2626] hover:underline cursor-pointer whitespace-nowrap"
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
                  className="text-left p-4 rounded-xl bg-white dark:bg-[#1B1417] border border-slate-200/90 dark:border-[#32242A] hover:border-[#DC2626] hover:shadow-[0_6px_18px_rgba(220, 38, 38,0.08)] hover:-translate-y-0.5 transition-all duration-150 cursor-pointer flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-lg bg-[#DC2626]/8 dark:bg-[#251B20] border border-[#DC2626]/15 dark:border-[#32242A] flex items-center justify-center shrink-0">
                        <Icon className="h-4 w-4 text-[#DC2626]" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-[#1C1917] dark:text-slate-100">
                          {mod.name}
                        </div>
                        <div className="text-[11px] text-[#64748B] dark:text-slate-400 font-mono tabular-nums">
                          {getModuleCountLabel(mod.slug)}
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-[#64748B] shrink-0" />
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
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-[#32242A] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#1C1917] dark:text-slate-100">
              Recent Sales Invoices & Quotes
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('module:sales')}
              className="text-xs font-medium text-[#DC2626] hover:underline cursor-pointer"
            >
              Open Sales
            </button>
          </div>
          {data.salesOrders.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <p className="text-sm font-medium text-[#1C1917] dark:text-slate-100">
                No sales orders recorded yet
              </p>
              <p className="text-xs text-[#64748B] dark:text-slate-400">
                Create your first quote or invoice to track revenue and stock dispatch.
              </p>
              <div className="pt-2">
                <Button size="sm" onClick={() => onNavigate('module:sales')}>
                  Create Invoice
                </Button>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-200/80 dark:divide-[#32242A]">
              {data.salesOrders.slice(0, 5).map((order) => (
                <div
                  key={order.id}
                  className="px-5 py-3 flex items-center justify-between gap-3 text-xs hover:bg-slate-50/70 dark:hover:bg-[#251B20]/40 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-[#1C1917] dark:text-slate-100 truncate">
                      {order.documentNumber} · {order.customerName}
                    </div>
                    <div className="text-[11px] text-[#64748B] dark:text-slate-400 capitalize">
                      {order.issueDate} · {order.status}
                    </div>
                  </div>
                  <div className="font-mono font-semibold tabular-nums text-[#1C1917] dark:text-slate-100 shrink-0">
                    {formatNumericCurrency(order.grandTotal, currency, 2)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Surface>

        <Surface padding="none" className="overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-[#32242A] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#1C1917] dark:text-slate-100">
              Recent Accounting Ledger
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('module:accounting')}
              className="text-xs font-medium text-[#DC2626] hover:underline cursor-pointer"
            >
              Open Ledger
            </button>
          </div>
          {data.journals.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <p className="text-sm font-medium text-[#1C1917] dark:text-slate-100">
                No journals posted yet
              </p>
              <p className="text-xs text-[#64748B] dark:text-slate-400">
                Sales invoices, goods receipts, payroll runs, and balanced manual journals appear here.
              </p>
              <div className="pt-2">
                <Button size="sm" variant="outline" onClick={() => onNavigate('module:accounting')}>
                  Record Journal
                </Button>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-200/80 dark:divide-[#32242A]">
              {data.journals.slice(0, 5).map((journal) => (
                <div
                  key={journal.id}
                  className="px-5 py-3 flex items-center justify-between gap-3 text-xs hover:bg-slate-50/70 dark:hover:bg-[#251B20]/40 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-[#1C1917] dark:text-slate-100 truncate">
                      {journal.journalNumber} · {journal.reference}
                    </div>
                    <div className="text-[11px] text-[#64748B] dark:text-slate-400 truncate">
                      {journal.date} · {journal.description}
                    </div>
                  </div>
                  <div className="font-mono font-semibold tabular-nums shrink-0 text-[#16B8A6]">
                    {formatNumericCurrency(journal.totalDebit, currency, 2)}
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
