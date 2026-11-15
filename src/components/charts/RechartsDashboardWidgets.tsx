import React from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  InventoryTurnoverPoint,
  MonthlySalesTrendPoint,
} from '@/src/core/engine/chartDataHelpers';
import { BarDatum, AreaSeriesPoint } from '@/src/components/charts/ErpCharts';

function compactNumber(val: number): string {
  const abs = Math.abs(val);
  if (abs >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(val / 1_000).toFixed(1)}k`;
  return String(Math.round(val));
}

function EmptyChartNotice({ message, height }: { message: string; height: number }) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl border border-dashed border-stone-200 dark:border-[#32242A] bg-[#FAF9F7]/70 dark:bg-[#141013]/60 px-4 text-center"
      style={{ height }}
    >
      <div className="flex items-end gap-2 h-11 mb-3 opacity-50" aria-hidden="true">
        <div className="w-3 h-4 rounded-t bg-[#DC2626]" />
        <div className="w-3 h-8 rounded-t bg-[#FACC15]" />
        <div className="w-3 h-5 rounded-t bg-[#DC2626]" />
        <div className="w-3 h-10 rounded-t bg-[#F59E0B]" />
        <div className="w-3 h-7 rounded-t bg-[#EF4444]" />
      </div>
      <p className="text-xs text-[#57534E] dark:text-stone-400 max-w-sm">{message}</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 1. Monthly Sales Trends — Sleek Red & Yellow Recharts Line Chart           */
/* -------------------------------------------------------------------------- */

export function MonthlySalesTrendLineChart({
  data,
  formatCurrency,
  height = 240,
}: {
  data: MonthlySalesTrendPoint[];
  formatCurrency: (v: number) => string;
  height?: number;
}) {
  const hasActivity = data.some((d) => d.invoiced > 0 || d.collected > 0);
  if (data.length === 0 || !hasActivity) {
    return (
      <EmptyChartNotice
        height={height}
        message="Create invoices or POS sales to visualize Monthly Sales Trends and cash collection velocity."
      />
    );
  }

  return (
    <div className="w-full min-w-0" style={{ height }}>
      <ResponsiveContainer width="100%" height={height} minWidth={0}>
        <LineChart data={data} margin={{ top: 10, right: 16, left: 4, bottom: 4 }}>
          <CartesianGrid
            strokeDasharray="4 4"
            vertical={false}
            stroke="rgba(120, 113, 108, 0.22)"
          />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#78716C' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={compactNumber}
            tick={{ fontSize: 11, fill: '#78716C' }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload || payload.length === 0) return null;
              const point = payload[0]?.payload as MonthlySalesTrendPoint | undefined;
              return (
                <div className="rounded-xl border border-stone-200 dark:border-[#3A2B31] bg-white/95 dark:bg-[#1B1417]/95 backdrop-blur-sm shadow-lg px-3.5 py-2.5 text-xs space-y-1.5">
                  <div className="font-semibold text-[#1C1917] dark:text-stone-100 flex items-center justify-between gap-4">
                    <span>{label}</span>
                    {point && (
                      <span className="font-mono text-[10px] text-[#57534E] dark:text-stone-400">
                        {point.orderCount} {point.orderCount === 1 ? 'invoice' : 'invoices'}
                      </span>
                    )}
                  </div>
                  {payload.map((entry) => (
                    <div
                      key={String(entry.dataKey)}
                      className="flex items-center justify-between gap-4 font-mono tabular-nums"
                    >
                      <span className="flex items-center gap-1.5 font-sans text-[#57534E] dark:text-stone-300">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: entry.color }}
                        />
                        {entry.name}
                      </span>
                      <span className="font-bold text-[#1C1917] dark:text-stone-100">
                        {formatCurrency(Number(entry.value ?? 0))}
                      </span>
                    </div>
                  ))}
                </div>
              );
            }}
          />
          <Legend
            verticalAlign="top"
            align="left"
            height={28}
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: '12px' }}
          />
          <Line
            type="monotone"
            dataKey="invoiced"
            name="Invoiced Sales"
            stroke="#DC2626"
            strokeWidth={3}
            dot={{ r: 3.5, fill: '#DC2626', strokeWidth: 0 }}
            activeDot={{ r: 6, fill: '#DC2626', stroke: '#FEF2F2', strokeWidth: 2 }}
          />
          <Line
            type="monotone"
            dataKey="collected"
            name="Collected Revenue"
            stroke="#F59E0B"
            strokeWidth={2.75}
            dot={{ r: 3.5, fill: '#FACC15', stroke: '#D97706', strokeWidth: 1.5 }}
            activeDot={{ r: 6, fill: '#FACC15', stroke: '#1C1917', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 2. Inventory Turnover — Sleek Red & Yellow Recharts Bar Chart              */
/* -------------------------------------------------------------------------- */

export function InventoryTurnoverBarChart({
  data,
  formatCurrency,
  height = 240,
}: {
  data: InventoryTurnoverPoint[];
  formatCurrency: (v: number) => string;
  height?: number;
}) {
  if (data.length === 0) {
    return (
      <EmptyChartNotice
        height={height}
        message="Add tracked stock products and dispatch orders to monitor Inventory Turnover by SKU."
      />
    );
  }

  return (
    <div className="w-full min-w-0" style={{ height }}>
      <ResponsiveContainer width="100%" height={height} minWidth={0}>
        <BarChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 4 }} barGap={4}>
          <CartesianGrid
            strokeDasharray="4 4"
            vertical={false}
            stroke="rgba(120, 113, 108, 0.22)"
          />
          <XAxis
            dataKey="sku"
            tick={{ fontSize: 11, fill: '#78716C' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={compactNumber}
            tick={{ fontSize: 11, fill: '#78716C' }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            cursor={{ fill: 'rgba(220, 38, 38, 0.06)' }}
            content={({ active, payload }) => {
              if (!active || !payload || payload.length === 0) return null;
              const point = payload[0]?.payload as InventoryTurnoverPoint | undefined;
              if (!point) return null;
              return (
                <div className="rounded-xl border border-stone-200 dark:border-[#3A2B31] bg-white/95 dark:bg-[#1B1417]/95 backdrop-blur-sm shadow-lg px-3.5 py-2.5 text-xs space-y-1.5">
                  <div>
                    <div className="font-bold text-[#1C1917] dark:text-stone-100">
                      {point.sku} · {point.name}
                    </div>
                    <div className="text-[11px] font-mono text-[#DC2626] dark:text-[#FACC15]">
                      Turnover Ratio: {point.turnoverRatio.toFixed(2)}x
                    </div>
                  </div>
                  <div className="flex justify-between gap-4 font-mono tabular-nums">
                    <span className="text-[#57534E] dark:text-stone-300">Dispatched Units</span>
                    <span className="font-semibold text-[#DC2626]">{point.unitsDispatched}</span>
                  </div>
                  <div className="flex justify-between gap-4 font-mono tabular-nums">
                    <span className="text-[#57534E] dark:text-stone-300">Stock On Hand</span>
                    <span className="font-semibold text-[#D97706] dark:text-[#FACC15]">
                      {point.stockOnHand}
                    </span>
                  </div>
                  <div className="pt-1 border-t border-stone-200 dark:border-[#32242A] flex justify-between gap-4 font-mono tabular-nums text-[11px]">
                    <span className="text-[#57534E] dark:text-stone-400">Stock Value</span>
                    <span className="font-semibold text-[#1C1917] dark:text-stone-100">
                      {formatCurrency(point.assetValue)}
                    </span>
                  </div>
                </div>
              );
            }}
          />
          <Legend
            verticalAlign="top"
            align="left"
            height={28}
            iconType="square"
            iconSize={10}
            wrapperStyle={{ fontSize: '12px' }}
          />
          <Bar
            dataKey="unitsDispatched"
            name="Units Dispatched"
            fill="#DC2626"
            radius={[6, 6, 0, 0]}
            maxBarSize={32}
          />
          <Bar
            dataKey="stockOnHand"
            name="Stock On Hand"
            fill="#FACC15"
            radius={[6, 6, 0, 0]}
            maxBarSize={32}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 3. Revenue vs Expense Performance — Recharts Area Chart (Red & Yellow)     */
/* -------------------------------------------------------------------------- */

export function RechartsRevenueExpenseArea({
  data,
  formatCurrency,
  height = 230,
}: {
  data: AreaSeriesPoint[];
  formatCurrency: (v: number) => string;
  height?: number;
}) {
  const hasValues = data.some((d) => d.primary > 0 || (d.secondary ?? 0) > 0);
  if (data.length === 0 || !hasValues) {
    return (
      <EmptyChartNotice
        height={height}
        message="Post sales invoices, expenses, or balanced journals to plot live revenue vs expense trends."
      />
    );
  }

  return (
    <div className="w-full min-w-0" style={{ height }}>
      <ResponsiveContainer width="100%" height={height} minWidth={0}>
        <AreaChart data={data} margin={{ top: 10, right: 16, left: 4, bottom: 4 }}>
          <defs>
            <linearGradient id="wendoroGoldGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="wendoroRedGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#DC2626" stopOpacity={0.28} />
              <stop offset="95%" stopColor="#DC2626" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="4 4"
            vertical={false}
            stroke="rgba(120, 113, 108, 0.22)"
          />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#78716C' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={compactNumber}
            tick={{ fontSize: 11, fill: '#78716C' }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload || payload.length === 0) return null;
              return (
                <div className="rounded-xl border border-stone-200 dark:border-[#3A2B31] bg-white/95 dark:bg-[#1B1417]/95 shadow-lg px-3.5 py-2.5 text-xs space-y-1">
                  <div className="font-semibold text-[#1C1917] dark:text-stone-100">{label}</div>
                  {payload.map((entry) => (
                    <div
                      key={String(entry.dataKey)}
                      className="flex items-center justify-between gap-4 font-mono tabular-nums"
                    >
                      <span className="font-sans text-[#57534E] dark:text-stone-300">
                        {entry.name}
                      </span>
                      <span className="font-bold" style={{ color: entry.color }}>
                        {formatCurrency(Number(entry.value ?? 0))}
                      </span>
                    </div>
                  ))}
                </div>
              );
            }}
          />
          <Legend
            verticalAlign="top"
            align="left"
            height={28}
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: '12px' }}
          />
          <Area
            type="monotone"
            dataKey="primary"
            name="Revenue"
            stroke="#F59E0B"
            strokeWidth={2.75}
            fill="url(#wendoroGoldGrad)"
          />
          <Area
            type="monotone"
            dataKey="secondary"
            name="Expenses"
            stroke="#DC2626"
            strokeWidth={2.5}
            fill="url(#wendoroRedGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 4. Sales & Collection by Channel — Recharts Bar Chart (Red & Yellow)       */
/* -------------------------------------------------------------------------- */

export function RechartsChannelBarChart({
  data,
  formatCurrency,
  height = 210,
}: {
  data: BarDatum[];
  formatCurrency: (v: number) => string;
  height?: number;
}) {
  if (data.length === 0 || data.every((d) => d.primary === 0 && (d.secondary ?? 0) === 0)) {
    return (
      <EmptyChartNotice
        height={height}
        message="Issue invoices or POS receipts to compare channel billing vs collections."
      />
    );
  }

  return (
    <div className="w-full min-w-0" style={{ height }}>
      <ResponsiveContainer width="100%" height={height} minWidth={0}>
        <BarChart data={data} margin={{ top: 10, right: 12, left: 4, bottom: 4 }} barGap={6}>
          <CartesianGrid
            strokeDasharray="4 4"
            vertical={false}
            stroke="rgba(120, 113, 108, 0.22)"
          />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#78716C' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={compactNumber}
            tick={{ fontSize: 11, fill: '#78716C' }}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <Tooltip
            cursor={{ fill: 'rgba(250, 204, 21, 0.08)' }}
            content={({ active, payload, label }) => {
              if (!active || !payload || payload.length === 0) return null;
              return (
                <div className="rounded-xl border border-stone-200 dark:border-[#3A2B31] bg-white/95 dark:bg-[#1B1417]/95 shadow-lg px-3.5 py-2.5 text-xs space-y-1">
                  <div className="font-semibold text-[#1C1917] dark:text-stone-100">{label}</div>
                  {payload.map((entry) => (
                    <div
                      key={String(entry.dataKey)}
                      className="flex items-center justify-between gap-4 font-mono tabular-nums"
                    >
                      <span className="font-sans text-[#57534E] dark:text-stone-300">
                        {entry.name}
                      </span>
                      <span className="font-bold text-[#1C1917] dark:text-stone-100">
                        {formatCurrency(Number(entry.value ?? 0))}
                      </span>
                    </div>
                  ))}
                </div>
              );
            }}
          />
          <Legend
            verticalAlign="top"
            align="left"
            height={28}
            iconType="square"
            iconSize={10}
            wrapperStyle={{ fontSize: '12px' }}
          />
          <Bar
            dataKey="primary"
            name="Invoiced"
            fill="#DC2626"
            radius={[6, 6, 0, 0]}
            maxBarSize={36}
          />
          <Bar
            dataKey="secondary"
            name="Collected"
            fill="#FACC15"
            radius={[6, 6, 0, 0]}
            maxBarSize={36}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
