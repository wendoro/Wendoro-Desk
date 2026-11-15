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

export interface MonthlySalesTrendPoint {
  periodKey: string;
  label: string;
  invoiced: number;
  collected: number;
  expenses: number;
  orderCount: number;
}

function formatTrendLabel(periodKey: string, granularity: 'month' | 'day'): string {
  if (granularity === 'month' && /^\d{4}-\d{2}$/.test(periodKey)) {
    const [year, month] = periodKey.split('-').map(Number);
    const d = new Date(Date.UTC(year, (month || 1) - 1, 1));
    return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(periodKey)) {
    const [year, month, day] = periodKey.split('-').map(Number);
    const d = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  }
  return periodKey;
}

export function buildMonthlySalesTrends(
  state: Pick<ErpDatabaseState, 'salesOrders' | 'journals'>,
  granularity: 'month' | 'day' = 'month',
): MonthlySalesTrendPoint[] {
  const buckets = new Map<
    string,
    { invoiced: number; collected: number; expenses: number; orderCount: number }
  >();

  const toKey = (dateStr: string) =>
    granularity === 'month' ? dateStr.slice(0, 7) : dateStr.slice(0, 10);

  for (const so of state.salesOrders) {
    if (so.documentType !== 'invoice' || so.status === 'cancelled') continue;
    const key = toKey(so.issueDate || so.createdAt || new Date().toISOString());
    const entry = buckets.get(key) ?? {
      invoiced: 0,
      collected: 0,
      expenses: 0,
      orderCount: 0,
    };
    entry.invoiced += so.grandTotal;
    entry.collected += so.amountPaid;
    entry.orderCount += 1;
    buckets.set(key, entry);
  }

  for (const j of state.journals) {
    if (j.status === 'reversed') continue;
    const key = toKey(j.date || new Date().toISOString());
    const entry = buckets.get(key) ?? {
      invoiced: 0,
      collected: 0,
      expenses: 0,
      orderCount: 0,
    };
    for (const line of j.lines) {
      if (line.accountCategory === 'expense') {
        entry.expenses += line.debit - line.credit;
      }
    }
    buckets.set(key, entry);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([periodKey, vals]) => ({
      periodKey,
      label: formatTrendLabel(periodKey, granularity),
      invoiced: Math.max(0, Number(vals.invoiced.toFixed(2))),
      collected: Math.max(0, Number(vals.collected.toFixed(2))),
      expenses: Math.max(0, Number(vals.expenses.toFixed(2))),
      orderCount: vals.orderCount,
    }));
}

export interface InventoryTurnoverPoint {
  sku: string;
  name: string;
  unitsDispatched: number;
  stockOnHand: number;
  cogsOutValue: number;
  assetValue: number;
  turnoverRatio: number;
}

export function buildInventoryTurnoverSeries(
  state: Pick<ErpDatabaseState, 'catalogue' | 'stockMovements'>,
): InventoryTurnoverPoint[] {
  const outStats = new Map<string, { qty: number; value: number }>();

  for (const mv of state.stockMovements) {
    if (
      mv.direction === 'out' ||
      mv.movementType === 'dispatch' ||
      mv.movementType === 'production_consume'
    ) {
      const curr = outStats.get(mv.itemId) ?? { qty: 0, value: 0 };
      curr.qty += Math.abs(mv.quantity);
      curr.value += Math.abs(mv.totalValue);
      outStats.set(mv.itemId, curr);
    }
  }

  return state.catalogue
    .filter((item) => item.trackStock)
    .map((item) => {
      const stats = outStats.get(item.id) ?? { qty: 0, value: 0 };
      const assetValue = Math.max(0, item.inventoryAssetValue || item.stockOnHand * item.costPrice);
      const denominatorQty = Math.max(1, item.stockOnHand + stats.qty * 0.5);
      const ratio =
        assetValue > 0 && stats.value > 0
          ? stats.value / assetValue
          : stats.qty / denominatorQty;

      return {
        sku: item.sku,
        name: item.name,
        unitsDispatched: Number(stats.qty.toFixed(2)),
        stockOnHand: Number(item.stockOnHand.toFixed(2)),
        cogsOutValue: Number(stats.value.toFixed(2)),
        assetValue: Number(assetValue.toFixed(2)),
        turnoverRatio: Number(ratio.toFixed(2)),
      };
    })
    .filter((p) => p.unitsDispatched > 0 || p.stockOnHand > 0)
    .sort((a, b) => b.turnoverRatio - a.turnoverRatio || b.assetValue - a.assetValue)
    .slice(0, 7);
}

