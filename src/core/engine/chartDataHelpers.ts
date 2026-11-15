import { ErpDatabaseState } from '@/src/core/store/erpTypes';
import { TrialBalanceRow } from '@/src/core/engine/accountingEngine';
import type { AreaSeriesPoint, BarDatum, DonutSlice } from '@/src/components/charts/ErpCharts';

export function buildRevenueExpenseSeries(
  state: Pick<ErpDatabaseState, 'journals'>,
  granularity: 'month' | 'day' = 'month',
): AreaSeriesPoint[] {
  const buckets = new Map<string, { revenue: number; expense: number }>();

  const toKey = (dateStr: string) =>
    granularity === 'month' ? dateStr.slice(0, 7) : dateStr.slice(0, 10);

  for (const j of state.journals) {
    if (j.status === 'reversed') continue;
    const key = toKey(j.date || new Date().toISOString());
    const entry = buckets.get(key) ?? { revenue: 0, expense: 0 };
    for (const line of j.lines) {
      if (line.accountCategory === 'revenue') {
        entry.revenue += line.credit - line.debit;
      } else if (line.accountCategory === 'expense') {
        entry.expense += line.debit - line.credit;
      }
    }
    buckets.set(key, entry);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([label, vals]) => ({
      label,
      primary: Math.max(0, Number(vals.revenue.toFixed(2))),
      secondary: Math.max(0, Number(vals.expense.toFixed(2))),
    }));
}

export function buildBalanceCompositionSlices(rows: TrialBalanceRow[]): DonutSlice[] {
  const byCode = new Map(rows.map((r) => [r.code, Math.max(0, r.netBalance)]));
  return [
    { label: 'Cash & Bank (1000)', value: byCode.get('1000') ?? 0, color: '#F59E0B' },
    { label: 'Receivables AR (1200)', value: byCode.get('1200') ?? 0, color: '#DC2626' },
    { label: 'Inventory Asset (1300)', value: byCode.get('1300') ?? 0, color: '#EA580C' },
    { label: 'Fixed Assets Net', value: Math.max(0, (byCode.get('1500') ?? 0) - (byCode.get('1510') ?? 0)), color: '#16B8A6' },
    { label: 'Payables AP (2100)', value: byCode.get('2100') ?? 0, color: '#EAB308' },
    { label: 'Output Tax (2200)', value: byCode.get('2200') ?? 0, color: '#991B1B' },
  ].filter((s) => s.value > 0);
}

export function buildSalesChannelBars(state: Pick<ErpDatabaseState, 'salesOrders'>): BarDatum[] {
  const map = new Map<string, { invoiced: number; collected: number }>();
  for (const ch of ['direct', 'pos', 'ecommerce'] as const) {
    map.set(ch, { invoiced: 0, collected: 0 });
  }
  for (const so of state.salesOrders) {
    if (so.documentType !== 'invoice' || so.status === 'cancelled') continue;
    const ch = so.channel ?? 'direct';
    const curr = map.get(ch) ?? { invoiced: 0, collected: 0 };
    curr.invoiced += so.grandTotal;
    curr.collected += so.amountPaid;
    map.set(ch, curr);
  }
  return [
    { label: 'Direct B2B', primary: map.get('direct')!.invoiced, secondary: map.get('direct')!.collected },
    { label: 'Retail POS', primary: map.get('pos')!.invoiced, secondary: map.get('pos')!.collected },
    { label: 'E-Commerce', primary: map.get('ecommerce')!.invoiced, secondary: map.get('ecommerce')!.collected },
  ];
}
