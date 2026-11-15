import React, { useMemo, useState } from 'react';
import { BarChart3, Download, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { Surface } from '@/src/components/ui/Surface';
import {
  CHART_PALETTE,
  DonutChart,
  GroupedBarChart,
  HorizontalBarChart,
  RevenueAreaChart,
} from '@/src/components/charts/ErpCharts';
import { useErpData } from '@/src/components/shell/ErpDataProvider';
import { useTenant } from '@/src/components/shell/TenantProvider';
import {
  buildRevenueExpenseSeries,
  buildSalesChannelBars,
} from '@/src/core/engine/chartDataHelpers';
import { BiSavedReport, CrmStage } from '@/src/core/store/erpTypes';
import { formatNumericCurrency } from '@/src/lib/utils';

const STAGE_ORDER: CrmStage[] = ['lead', 'qualified', 'proposal', 'customer', 'lost'];

export function BiAnalyticsView() {
  const { activeCompany } = useTenant();
  const { data, metrics, financialStatements, addBiReport, deleteBiReport } = useErpData();
  const currency = activeCompany.baseCurrency;

  const [showBuilder, setShowBuilder] = useState(false);
  const [reportName, setReportName] = useState('');
  const [dataset, setDataset] = useState<BiSavedReport['dataset']>('revenue_by_customer');
  const [chartType, setChartType] = useState<BiSavedReport['chartType']>('bar');

  const cashFlowSeries = useMemo(() => buildRevenueExpenseSeries(data, 'month'), [data]);
  const channelBars = useMemo(() => buildSalesChannelBars(data), [data]);

  const customerRevenue = useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number }>();
    for (const so of data.salesOrders) {
      if (so.documentType !== 'invoice' || so.status === 'cancelled') continue;
      const key = so.customerName || 'Walk-in Customer';
      const curr = map.get(key) ?? { name: key, total: 0, count: 0 };
      curr.total += so.grandTotal;
      curr.count += 1;
      map.set(key, curr);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [data.salesOrders]);

  const topSkus = useMemo(() => {
    const map = new Map<string, { label: string; revenue: number; qty: number }>();
    for (const so of data.salesOrders) {
      if (so.documentType !== 'invoice' || so.status === 'cancelled') continue;
      for (const l of so.lines) {
        const key = l.description;
        const curr = map.get(key) ?? { label: key, revenue: 0, qty: 0 };
        curr.revenue += l.lineTotal;
        curr.qty += l.quantity;
        map.set(key, curr);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [data.salesOrders]);

  const pipelineFunnel = useMemo(() => {
    return STAGE_ORDER.map((stage) => {
      const items = data.contacts.filter((c) => c.stage === stage);
      const value = items.reduce((s, c) => s + (c.estimatedValue || 0), 0);
      return { stage, count: items.length, value };
    });
  }, [data.contacts]);

  const expenseBreakdown = useMemo(() => {
    return financialStatements.operatingExpenseRows
      .filter((r) => r.netBalance > 0)
      .map((row) => ({
        label: `${row.code} · ${row.name}`,
        amount: Math.max(0, row.netBalance),
      }));
  }, [financialStatements.operatingExpenseRows]);

  const grossMarginPct =
    financialStatements.totalRevenue > 0
      ? ((financialStatements.grossProfit / financialStatements.totalRevenue) * 100).toFixed(1)
      : '0.0';

  const handleSaveReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportName.trim()) return;
    addBiReport({
      name: reportName.trim(),
      dataset,
      chartType,
    });
    setReportName('');
    setShowBuilder(false);
  };

  const getDatasetRows = (ds: BiSavedReport['dataset']): Array<{ label: string; value: number; meta?: string }> => {
    if (ds === 'revenue_by_customer') {
      return customerRevenue.map((c) => ({
        label: c.name,
        value: c.total,
        meta: `${c.count} invoice${c.count === 1 ? '' : 's'}`,
      }));
    }
    if (ds === 'margin_by_sku') {
      return topSkus.map((s) => ({
        label: s.label,
        value: s.revenue,
        meta: `${s.qty} units`,
      }));
    }
    if (ds === 'expense_by_category') {
      return expenseBreakdown.map((e) => ({
        label: e.label,
        value: e.amount,
      }));
    }
    return pipelineFunnel.map((p) => ({
      label: p.stage.toUpperCase(),
      value: p.value,
      meta: `${p.count} contacts`,
    }));
  };

  const exportReportCsv = (reportNameVal: string, ds: BiSavedReport['dataset']) => {
    const rows = getDatasetRows(ds);
    const csv = [
      'Label,Value,Notes',
      ...rows.map((r) => `"${r.label.replace(/"/g, '""')}",${r.value.toFixed(2)},"${r.meta ?? ''}"`),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportNameVal.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1C1917] dark:text-slate-100">
            BI & Executive Analytics
          </h1>
          <p className="mt-1 text-xs text-[#64748B] dark:text-slate-400">
            Interactive financial trend curves, customer concentration, SKU margin rankings, CRM funnel, and custom CSV reports for {activeCompany.companyName}.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowBuilder((v) => !v)}>
          <Plus className="h-4 w-4" />
          {showBuilder ? 'Close Builder' : 'New Custom Report'}
        </Button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Surface interactive>
          <div className="text-xs text-[#64748B] dark:text-slate-400">Recognized Revenue</div>
          <div className="mt-1 text-xl font-bold font-mono tabular-nums text-[#16B8A6]">
            {formatNumericCurrency(financialStatements.totalRevenue, currency, 2)}
          </div>
          <div className="mt-1 text-[11px] text-[#64748B] dark:text-slate-400 font-mono tabular-nums">
            Gross Profit: {formatNumericCurrency(financialStatements.grossProfit, currency, 2)} ({grossMarginPct}%)
          </div>
        </Surface>
        <Surface interactive>
          <div className="text-xs text-[#64748B] dark:text-slate-400">COGS + Operating Expenses</div>
          <div className="mt-1 text-xl font-bold font-mono tabular-nums text-[#1C1917] dark:text-slate-100">
            {formatNumericCurrency(metrics.totalExpenses, currency, 2)}
          </div>
          <div className="mt-1 text-[11px] text-[#64748B] dark:text-slate-400 font-mono tabular-nums">
            COGS (5000): {formatNumericCurrency(financialStatements.cogsTotal, currency, 2)}
          </div>
        </Surface>
        <Surface interactive>
          <div className="text-xs text-[#64748B] dark:text-slate-400">Net Operating Income</div>
          <div
            className={`mt-1 text-xl font-bold font-mono tabular-nums ${
              metrics.netIncome >= 0 ? 'text-[#DC2626]' : 'text-red-600 dark:text-red-400'
            }`}
          >
            {formatNumericCurrency(metrics.netIncome, currency, 2)}
          </div>
          <div className="mt-1 text-[11px] text-[#64748B] dark:text-slate-400">
            From posted GL accounts
          </div>
        </Surface>
        <Surface interactive>
          <div className="text-xs text-[#64748B] dark:text-slate-400">Active Pipeline Value</div>
          <div className="mt-1 text-xl font-bold font-mono tabular-nums text-[#1C1917] dark:text-slate-100">
            {formatNumericCurrency(
              pipelineFunnel.filter((p) => p.stage !== 'lost').reduce((s, p) => s + p.value, 0),
              currency,
              2,
            )}
          </div>
          <div className="mt-1 text-[11px] text-[#64748B] dark:text-slate-400 font-mono tabular-nums">
            {data.contacts.length} CRM contacts tracked
          </div>
        </Surface>
      </div>

      {/* Custom Report Builder */}
      {showBuilder && (
        <Surface padding="lg">
          <form onSubmit={handleSaveReport} className="space-y-4">
            <h2 className="text-sm font-semibold text-[#1C1917] dark:text-slate-100">
              Save Custom BI Report
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                required
                value={reportName}
                onChange={(e) => setReportName(e.target.value)}
                placeholder="Report Name (e.g. Q4 Top Accounts) *"
                className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
              />
              <select
                value={dataset}
                onChange={(e) => setDataset(e.target.value as BiSavedReport['dataset'])}
                className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
              >
                <option value="revenue_by_customer">Revenue by Customer</option>
                <option value="margin_by_sku">Sales Revenue by Line/SKU</option>
                <option value="expense_by_category">Operating Expenses by Account</option>
                <option value="pipeline_by_stage">CRM Pipeline by Stage</option>
              </select>
              <select
                value={chartType}
                onChange={(e) => setChartType(e.target.value as BiSavedReport['chartType'])}
                className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
              >
                <option value="bar">Vertical Column Graph</option>
                <option value="pie">Interactive Donut Graph</option>
                <option value="table">Structured Table View</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowBuilder(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm">
                Save Report
              </Button>
            </div>
          </form>
        </Surface>
      )}

      {/* Primary Interactive Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Surface padding="lg" className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[#1C1917] dark:text-slate-100">
                Monthly Revenue vs Expense Trajectory
              </h2>
              <p className="text-[11px] text-[#64748B] dark:text-slate-400">
                Real-time income vs outflow across posted fiscal periods
              </p>
            </div>
          </div>
          <RevenueAreaChart
            data={cashFlowSeries}
            primaryLabel="Revenue"
            secondaryLabel="Expense"
            primaryColor="#16B8A6"
            secondaryColor="#F59E0B"
            formatValue={(v) => formatNumericCurrency(v, currency, 0)}
            height={230}
          />
        </Surface>

        <Surface padding="lg" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#1C1917] dark:text-slate-100">
              Revenue by Customer
            </h2>
            <button
              type="button"
              onClick={() => exportReportCsv('revenue-by-customer', 'revenue_by_customer')}
              className="text-xs text-[#DC2626] hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <Download className="h-3 w-3" />
              CSV
            </button>
          </div>
          <DonutChart
            slices={customerRevenue.slice(0, 6).map((c, idx) => ({
              label: c.name,
              value: c.total,
              color: CHART_PALETTE[idx % CHART_PALETTE.length],
            }))}
            centerLabel="Invoiced"
            centerValue={formatNumericCurrency(
              customerRevenue.reduce((s, c) => s + c.total, 0),
              currency,
              0,
            )}
            formatValue={(v) => formatNumericCurrency(v, currency, 0)}
            emptyMessage="Post sales invoices to visualize customer revenue concentration."
          />
        </Surface>
      </div>

      {/* Product Performance, Sales Channels & Pipeline Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Surface padding="lg" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#1C1917] dark:text-slate-100">
              Top Selling Products & Services
            </h2>
            <button
              type="button"
              onClick={() => exportReportCsv('top-selling-skus', 'margin_by_sku')}
              className="text-xs text-[#DC2626] hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <Download className="h-3 w-3" />
              CSV
            </button>
          </div>
          <GroupedBarChart
            data={topSkus.slice(0, 6).map((s) => ({
              label: s.label,
              primary: s.revenue,
            }))}
            primaryLabel="Revenue"
            primaryColor="#16B8A6"
            formatValue={(v) => formatNumericCurrency(v, currency, 0)}
            height={210}
            emptyMessage="No invoiced line items yet."
          />
        </Surface>

        <Surface padding="lg" className="space-y-4">
          <h2 className="text-sm font-semibold text-[#1C1917] dark:text-slate-100">
            Channel Revenue vs Collections
          </h2>
          <GroupedBarChart
            data={channelBars}
            primaryLabel="Billed"
            secondaryLabel="Collected"
            primaryColor="#DC2626"
            secondaryColor="#16B8A6"
            formatValue={(v) => formatNumericCurrency(v, currency, 0)}
            height={210}
            emptyMessage="Create invoices or POS sales to compare channels."
          />
        </Surface>

        <Surface padding="lg" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#1C1917] dark:text-slate-100">
              CRM Pipeline Funnel
            </h2>
            <button
              type="button"
              onClick={() => exportReportCsv('crm-pipeline-funnel', 'pipeline_by_stage')}
              className="text-xs text-[#DC2626] hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <Download className="h-3 w-3" />
              CSV
            </button>
          </div>
          <HorizontalBarChart
            items={pipelineFunnel.map((p) => ({
              label: p.stage.charAt(0).toUpperCase() + p.stage.slice(1),
              value: p.value,
              meta: `${p.count} contacts`,
              color:
                p.stage === 'customer'
                  ? '#16B8A6'
                  : p.stage === 'lost'
                    ? '#94A3B8'
                    : p.stage === 'proposal'
                      ? '#DC2626'
                      : '#F59E0B',
            }))}
            formatValue={(v) => formatNumericCurrency(v, currency, 0)}
          />
        </Surface>
      </div>

      {/* Expense Breakdown Donut */}
      {expenseBreakdown.length > 0 && (
        <Surface padding="lg" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[#1C1917] dark:text-slate-100">
                Operating Expense Distribution
              </h2>
              <p className="text-[11px] text-[#64748B] dark:text-slate-400">
                Breakdown across Payroll, Depreciation, and Operating Expense GL accounts
              </p>
            </div>
            <button
              type="button"
              onClick={() => exportReportCsv('operating-expenses', 'expense_by_category')}
              className="text-xs text-[#DC2626] hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <Download className="h-3 w-3" />
              CSV
            </button>
          </div>
          <DonutChart
            slices={expenseBreakdown.map((e, i) => ({
              label: e.label,
              value: e.amount,
              color: CHART_PALETTE[i % CHART_PALETTE.length],
            }))}
            centerLabel="Total OpEx"
            centerValue={formatNumericCurrency(
              expenseBreakdown.reduce((s, e) => s + e.amount, 0),
              currency,
              0,
            )}
            formatValue={(v) => formatNumericCurrency(v, currency, 0)}
          />
        </Surface>
      )}

      {/* Saved Custom BI Reports */}
      {data.biReports.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-[#1C1917] dark:text-slate-100 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-[#DC2626]" />
            Saved Custom Reports ({data.biReports.length})
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {data.biReports.map((rep) => {
              const rows = getDatasetRows(rep.dataset);
              return (
                <Surface key={rep.id} padding="lg" className="space-y-4">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-[#32242A] pb-2">
                    <div>
                      <div className="text-sm font-semibold text-[#1C1917] dark:text-slate-100">
                        {rep.name}
                      </div>
                      <div className="text-[11px] text-[#64748B] dark:text-slate-400 capitalize">
                        {rep.dataset.replace(/_/g, ' ')} · {rep.chartType}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => exportReportCsv(rep.name, rep.dataset)}
                        className="p-1.5 text-[#DC2626] hover:bg-[#DC2626]/10 rounded cursor-pointer"
                        title="Export CSV"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteBiReport(rep.id)}
                        className="p-1.5 text-[#64748B] hover:text-red-600 rounded cursor-pointer"
                        aria-label={`Delete ${rep.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {rows.length === 0 ? (
                    <p className="text-xs text-[#64748B] dark:text-slate-400">
                      No data available for this dataset yet.
                    </p>
                  ) : rep.chartType === 'bar' ? (
                    <GroupedBarChart
                      data={rows.slice(0, 8).map((r) => ({ label: r.label, primary: r.value }))}
                      primaryLabel={rep.name}
                      primaryColor="#DC2626"
                      formatValue={(v) => formatNumericCurrency(v, currency, 0)}
                      height={190}
                    />
                  ) : rep.chartType === 'pie' ? (
                    <DonutChart
                      slices={rows.slice(0, 6).map((r, i) => ({
                        label: r.label,
                        value: r.value,
                        color: CHART_PALETTE[i % CHART_PALETTE.length],
                      }))}
                      centerLabel="Total"
                      centerValue={formatNumericCurrency(
                        rows.reduce((s, r) => s + r.value, 0),
                        currency,
                        0,
                      )}
                      formatValue={(v) => formatNumericCurrency(v, currency, 0)}
                    />
                  ) : (
                    <table className="w-full text-xs text-left">
                      <thead className="text-[#64748B] border-b border-slate-200 dark:border-[#32242A]">
                        <tr>
                          <th className="py-1.5">Item</th>
                          <th className="py-1.5">Detail</th>
                          <th className="py-1.5 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/70 dark:divide-[#32242A]">
                        {rows.slice(0, 8).map((r) => (
                          <tr key={r.label}>
                            <td className="py-1.5 font-medium">{r.label}</td>
                            <td className="py-1.5 text-[#64748B]">{r.meta ?? '—'}</td>
                            <td className="py-1.5 text-right font-mono tabular-nums font-semibold">
                              {formatNumericCurrency(r.value, currency, 2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Surface>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
