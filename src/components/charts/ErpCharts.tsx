import React, { useId, useState } from 'react';
import { cn } from '@/src/lib/utils';

export const CHART_PALETTE = [
  '#DC2626', // Wendoro Crimson Red
  '#F59E0B', // Wendoro Golden Amber
  '#16B8A6', // Emerald Teal
  '#EA580C', // Warm Orange
  '#EAB308', // Bright Gold
  '#991B1B', // Deep Burgundy
];

function compactAxisNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  if (abs >= 10 || value === 0) return value.toFixed(0);
  return value.toFixed(1);
}

function buildSmoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

/* -------------------------------------------------------------------------- */
/* 1. KPI Sparkline Chart                                                     */
/* -------------------------------------------------------------------------- */

export interface SparklineChartProps {
  values: number[];
  color?: string;
  height?: number;
  className?: string;
}

export function SparklineChart({
  values,
  color = '#DC2626',
  height = 36,
  className,
}: SparklineChartProps) {
  const gradId = useId().replace(/:/g, '');
  const safeValues = values.length >= 2 ? values : values.length === 1 ? [0, values[0]] : [0, 0];
  const min = Math.min(...safeValues);
  const max = Math.max(...safeValues);
  const range = Math.max(1, max - min);

  const w = 140;
  const h = height;
  const padY = 4;

  const points = safeValues.map((v, i) => ({
    x: (i / Math.max(1, safeValues.length - 1)) * w,
    y: h - padY - ((v - min) / range) * (h - padY * 2),
  }));

  const linePath = buildSmoothPath(points);
  const areaPath = `${linePath} L ${w} ${h} L 0 ${h} Z`;
  const last = points[points.length - 1];

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={cn('w-full overflow-visible', className)}
      style={{ height }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`spark-${gradId}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.26" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#spark-${gradId})`} />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last.x} cy={last.y} r="3" fill={color} />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* 2. Dual-Series Smooth Area & Line Chart                                    */
/* -------------------------------------------------------------------------- */

export interface AreaSeriesPoint {
  label: string;
  primary: number;
  secondary?: number;
}

export interface RevenueAreaChartProps {
  data: AreaSeriesPoint[];
  primaryLabel: string;
  secondaryLabel?: string;
  primaryColor?: string;
  secondaryColor?: string;
  formatValue: (v: number) => string;
  height?: number;
  emptyMessage?: string;
}

export function RevenueAreaChart({
  data,
  primaryLabel,
  secondaryLabel,
  primaryColor = '#DC2626',
  secondaryColor = '#F59E0B',
  formatValue,
  height = 240,
  emptyMessage = 'Record transactions to plot live trends over time.',
}: RevenueAreaChartProps) {
  const uid = useId().replace(/:/g, '');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const hasValues = data.some((d) => d.primary > 0 || (d.secondary ?? 0) > 0);
  if (data.length === 0 || !hasValues) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-lg border border-dashed border-stone-200 dark:border-[#32242A] bg-[#FAF9F7]/70 dark:bg-[#141013]/60 px-4 text-center"
        style={{ height }}
      >
        <div className="flex items-end gap-2 h-12 mb-3 opacity-45" aria-hidden="true">
          <div className="w-3 h-4 rounded-t bg-[#DC2626]" />
          <div className="w-3 h-7 rounded-t bg-[#FACC15]" />
          <div className="w-3 h-5 rounded-t bg-[#DC2626]" />
          <div className="w-3 h-10 rounded-t bg-[#F59E0B]" />
          <div className="w-3 h-8 rounded-t bg-[#EA580C]" />
        </div>
        <p className="text-xs text-[#57534E] dark:text-stone-400 max-w-sm">{emptyMessage}</p>
      </div>
    );
  }

  const normalized =
    data.length === 1
      ? [{ label: 'Start', primary: 0, secondary: 0 }, data[0]]
      : data;

  const svgW = 720;
  const svgH = height;
  const padLeft = 56;
  const padRight = 20;
  const padTop = 18;
  const padBottom = 32;
  const plotW = svgW - padLeft - padRight;
  const plotH = svgH - padTop - padBottom;

  const maxVal = Math.max(
    1,
    ...normalized.map((d) => Math.max(d.primary, d.secondary ?? 0)),
  );
  const niceMax = maxVal * 1.15;

  const primaryPts = normalized.map((d, i) => ({
    x: padLeft + (i / Math.max(1, normalized.length - 1)) * plotW,
    y: padTop + plotH - (d.primary / niceMax) * plotH,
  }));

  const hasSecondary = Boolean(secondaryLabel);
  const secondaryPts = hasSecondary
    ? normalized.map((d, i) => ({
        x: padLeft + (i / Math.max(1, normalized.length - 1)) * plotW,
        y: padTop + plotH - ((d.secondary ?? 0) / niceMax) * plotH,
      }))
    : [];

  const primaryLine = buildSmoothPath(primaryPts);
  const primaryArea = `${primaryLine} L ${primaryPts[primaryPts.length - 1].x.toFixed(2)} ${padTop + plotH} L ${primaryPts[0].x.toFixed(2)} ${padTop + plotH} Z`;
  const secondaryLine = hasSecondary ? buildSmoothPath(secondaryPts) : '';

  const gridSteps = [0, 0.25, 0.5, 0.75, 1];
  const activeIdx = hoveredIdx !== null && hoveredIdx < normalized.length ? hoveredIdx : null;
  const activePoint = activeIdx !== null ? normalized[activeIdx] : null;
  const activePrimaryCoord = activeIdx !== null ? primaryPts[activeIdx] : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-xs">
          <span className="inline-flex items-center gap-1.5 font-medium text-[#1C1917] dark:text-slate-200">
            <span className="h-2.5 w-2.5 rounded-xs" style={{ backgroundColor: primaryColor }} />
            {primaryLabel}
          </span>
          {secondaryLabel && (
            <span className="inline-flex items-center gap-1.5 font-medium text-[#1C1917] dark:text-slate-200">
              <span className="h-2.5 w-2.5 rounded-xs" style={{ backgroundColor: secondaryColor }} />
              {secondaryLabel}
            </span>
          )}
        </div>
        {activePoint ? (
          <div className="text-xs font-mono tabular-nums text-[#1C1917] dark:text-slate-100">
            <span className="text-[#718096] dark:text-slate-400 mr-2">{activePoint.label}:</span>
            <span className="font-semibold" style={{ color: primaryColor }}>
              {primaryLabel} {formatValue(activePoint.primary)}
            </span>
            {secondaryLabel && (
              <span className="ml-3 font-semibold" style={{ color: secondaryColor }}>
                {secondaryLabel} {formatValue(activePoint.secondary ?? 0)}
              </span>
            )}
          </div>
        ) : (
          <span className="text-[11px] text-[#718096] dark:text-slate-400">
            Hover points to inspect values
          </span>
        )}
      </div>

      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="w-full h-auto select-none"
          role="img"
          aria-label={`${primaryLabel}${secondaryLabel ? ` and ${secondaryLabel}` : ''} trend chart`}
        >
          <defs>
            <linearGradient id={`area-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={primaryColor} stopOpacity="0.28" />
              <stop offset="100%" stopColor={primaryColor} stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Horizontal Gridlines & Y Labels */}
          {gridSteps.map((ratio) => {
            const y = padTop + plotH * (1 - ratio);
            const val = niceMax * ratio;
            return (
              <g key={ratio}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={svgW - padRight}
                  y2={y}
                  stroke="currentColor"
                  className="text-slate-200 dark:text-[#32242A]"
                  strokeDasharray={ratio === 0 ? undefined : '4 4'}
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  className="fill-[#64748B] dark:fill-slate-400 text-[10px] font-mono tabular-nums"
                >
                  {compactAxisNumber(val)}
                </text>
              </g>
            );
          })}

          {/* Primary Gradient Fill & Smooth Curve */}
          <path d={primaryArea} fill={`url(#area-${uid})`} />
          <path
            d={primaryLine}
            fill="none"
            stroke={primaryColor}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Secondary Line */}
          {hasSecondary && (
            <path
              d={secondaryLine}
              fill="none"
              stroke={secondaryColor}
              strokeWidth="2.25"
              strokeDasharray="5 4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Active Crosshair */}
          {activePrimaryCoord && (
            <line
              x1={activePrimaryCoord.x}
              y1={padTop}
              x2={activePrimaryCoord.x}
              y2={padTop + plotH}
              stroke="#DC2626"
              strokeOpacity="0.45"
              strokeWidth="1.25"
            />
          )}

          {/* Data Points & Hover Targets */}
          {normalized.map((d, i) => {
            const p1 = primaryPts[i];
            const p2 = secondaryPts[i];
            const isActive = activeIdx === i;
            const showXLabel =
              normalized.length <= 7 ||
              i === 0 ||
              i === normalized.length - 1 ||
              i % Math.ceil(normalized.length / 6) === 0;
            const colWidth = plotW / Math.max(1, normalized.length);

            return (
              <g key={`${d.label}-${i}`}>
                <circle
                  cx={p1.x}
                  cy={p1.y}
                  r={isActive ? 5 : 3.2}
                  fill={isActive ? '#FFFFFF' : primaryColor}
                  stroke={primaryColor}
                  strokeWidth={isActive ? 2.5 : 0}
                />
                {p2 && (
                  <circle
                    cx={p2.x}
                    cy={p2.y}
                    r={isActive ? 4.5 : 2.8}
                    fill={isActive ? '#FFFFFF' : secondaryColor}
                    stroke={secondaryColor}
                    strokeWidth={isActive ? 2.2 : 0}
                  />
                )}
                {showXLabel && (
                  <text
                    x={p1.x}
                    y={svgH - 8}
                    textAnchor="middle"
                    className="fill-[#64748B] dark:fill-slate-400 text-[10px] font-mono"
                  >
                    {d.label.length > 10 ? d.label.slice(0, 10) : d.label}
                  </text>
                )}
                <rect
                  x={p1.x - colWidth / 2}
                  y={padTop}
                  width={colWidth}
                  height={plotH + padBottom}
                  fill="transparent"
                  className="cursor-crosshair"
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 3. Grouped / Single Vertical Column Chart                                  */
/* -------------------------------------------------------------------------- */

export interface BarDatum {
  label: string;
  primary: number;
  secondary?: number;
  meta?: string;
}

export interface GroupedBarChartProps {
  data: BarDatum[];
  primaryLabel: string;
  secondaryLabel?: string;
  primaryColor?: string;
  secondaryColor?: string;
  formatValue: (v: number) => string;
  height?: number;
  emptyMessage?: string;
}

export function GroupedBarChart({
  data,
  primaryLabel,
  secondaryLabel,
  primaryColor = '#DC2626',
  secondaryColor = '#F59E0B',
  formatValue,
  height = 220,
  emptyMessage = 'No data recorded for this chart yet.',
}: GroupedBarChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (data.length === 0 || data.every((d) => d.primary === 0 && (d.secondary ?? 0) === 0)) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-lg border border-dashed border-stone-200 dark:border-[#32242A] bg-[#FAF9F7]/70 dark:bg-[#141013]/60 px-4 text-center"
        style={{ height }}
      >
        <p className="text-xs text-[#57534E] dark:text-stone-400 max-w-xs">{emptyMessage}</p>
      </div>
    );
  }

  const visible = data.slice(0, 8);
  const svgW = 640;
  const svgH = height;
  const padLeft = 52;
  const padRight = 16;
  const padTop = 16;
  const padBottom = 34;
  const plotW = svgW - padLeft - padRight;
  const plotH = svgH - padTop - padBottom;

  const maxVal = Math.max(1, ...visible.map((d) => Math.max(d.primary, d.secondary ?? 0)));
  const niceMax = maxVal * 1.15;
  const hasSecondary = Boolean(secondaryLabel);
  const groupW = plotW / visible.length;
  const barW = hasSecondary ? Math.min(26, groupW * 0.34) : Math.min(38, groupW * 0.56);

  const active = hoveredIdx !== null ? visible[hoveredIdx] : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-4 text-xs">
          <span className="inline-flex items-center gap-1.5 font-medium text-[#1C1917] dark:text-slate-200">
            <span className="h-2.5 w-2.5 rounded-xs" style={{ backgroundColor: primaryColor }} />
            {primaryLabel}
          </span>
          {secondaryLabel && (
            <span className="inline-flex items-center gap-1.5 font-medium text-[#1C1917] dark:text-slate-200">
              <span className="h-2.5 w-2.5 rounded-xs" style={{ backgroundColor: secondaryColor }} />
              {secondaryLabel}
            </span>
          )}
        </div>
        {active && (
          <div className="text-xs font-mono tabular-nums text-[#1C1917] dark:text-slate-100">
            <span className="font-semibold mr-2">{active.label}:</span>
            <span style={{ color: primaryColor }}>{formatValue(active.primary)}</span>
            {secondaryLabel && (
              <span className="ml-2" style={{ color: secondaryColor }}>
                / {formatValue(active.secondary ?? 0)}
              </span>
            )}
          </div>
        )}
      </div>

      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="w-full h-auto select-none"
        role="img"
        aria-label={`${primaryLabel} bar chart`}
      >
        {[0, 0.5, 1].map((ratio) => {
          const y = padTop + plotH * (1 - ratio);
          return (
            <g key={ratio}>
              <line
                x1={padLeft}
                y1={y}
                x2={svgW - padRight}
                y2={y}
                stroke="currentColor"
                className="text-slate-200 dark:text-[#32242A]"
                strokeDasharray={ratio === 0 ? undefined : '4 4'}
              />
              <text
                x={padLeft - 8}
                y={y + 3.5}
                textAnchor="end"
                className="fill-[#64748B] dark:fill-slate-400 text-[10px] font-mono tabular-nums"
              >
                {compactAxisNumber(niceMax * ratio)}
              </text>
            </g>
          );
        })}

        {visible.map((d, idx) => {
          const cx = padLeft + groupW * idx + groupW / 2;
          const h1 = Math.max(d.primary > 0 ? 4 : 0, (d.primary / niceMax) * plotH);
          const y1 = padTop + plotH - h1;
          const h2 =
            hasSecondary && (d.secondary ?? 0) > 0
              ? Math.max(4, ((d.secondary ?? 0) / niceMax) * plotH)
              : 0;
          const y2 = padTop + plotH - h2;
          const isHovered = hoveredIdx === idx;

          return (
            <g
              key={`${d.label}-${idx}`}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="cursor-pointer"
            >
              {isHovered && (
                <rect
                  x={padLeft + groupW * idx + 4}
                  y={padTop}
                  width={Math.max(8, groupW - 8)}
                  height={plotH}
                  rx="6"
                  className="fill-[#DC2626]/6 dark:fill-[#FACC15]/12"
                />
              )}
              <rect
                x={hasSecondary ? cx - barW - 2 : cx - barW / 2}
                y={y1}
                width={barW}
                height={h1}
                rx="4"
                fill={primaryColor}
                fillOpacity={hoveredIdx !== null && !isHovered ? 0.5 : 0.95}
              />
              {hasSecondary && (
                <rect
                  x={cx + 2}
                  y={y2}
                  width={barW}
                  height={h2}
                  rx="4"
                  fill={secondaryColor}
                  fillOpacity={hoveredIdx !== null && !isHovered ? 0.5 : 0.95}
                />
              )}
              <text
                x={cx}
                y={svgH - 10}
                textAnchor="middle"
                className="fill-[#64748B] dark:fill-slate-400 text-[10px] font-medium"
              >
                {d.label.length > 11 ? `${d.label.slice(0, 10)}…` : d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 4. Interactive SVG Donut Chart                                             */
/* -------------------------------------------------------------------------- */

export interface DonutSlice {
  label: string;
  value: number;
  color?: string;
}

export interface DonutChartProps {
  slices: DonutSlice[];
  centerLabel: string;
  centerValue: string;
  formatValue: (v: number) => string;
  emptyMessage?: string;
}

export function DonutChart({
  slices,
  centerLabel,
  centerValue,
  formatValue,
  emptyMessage = 'No balances to chart yet.',
}: DonutChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const nonZero = slices.filter((s) => s.value > 0);
  const total = nonZero.reduce((s, x) => s + x.value, 0);

  if (total <= 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 dark:border-[#32242A] bg-[#FAF9F7]/60 dark:bg-[#141013]/60 py-10 px-4 text-center">
        <div className="h-14 w-14 rounded-full border-4 border-slate-200 dark:border-[#32242A] mb-3" />
        <p className="text-xs text-[#718096] dark:text-slate-400">{emptyMessage}</p>
      </div>
    );
  }

  const size = 160;
  const strokeW = 20;
  const radius = (size - strokeW) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulativePct = 0;
  const computed = nonZero.map((s, idx) => {
    const pct = s.value / total;
    const dashLen = pct * circumference;
    const dashOffset = -cumulativePct * circumference;
    cumulativePct += pct;
    return {
      ...s,
      pct,
      color: s.color || CHART_PALETTE[idx % CHART_PALETTE.length],
      dashLen,
      dashOffset,
    };
  });

  const active = hoveredIdx !== null ? computed[hoveredIdx] : null;

  return (
    <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            className="text-slate-100 dark:text-[#251B20]"
            strokeWidth={strokeW}
          />
          {computed.map((s, idx) => {
            const isHovered = hoveredIdx === idx;
            return (
              <circle
                key={`${s.label}-${idx}`}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={s.color}
                strokeWidth={isHovered ? strokeW + 3 : strokeW}
                strokeDasharray={`${Math.max(1, s.dashLen - 1.5)} ${circumference}`}
                strokeDashoffset={s.dashOffset}
                strokeOpacity={hoveredIdx !== null && !isHovered ? 0.45 : 1}
                className="transition-all duration-150 cursor-pointer"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-3 pointer-events-none">
          <span className="text-[10px] text-[#718096] dark:text-slate-400 truncate max-w-[96px]">
            {active ? active.label : centerLabel}
          </span>
          <span className="text-xs font-bold font-mono tabular-nums text-[#1C1917] dark:text-slate-100 truncate max-w-[104px]">
            {active ? formatValue(active.value) : centerValue}
          </span>
          {active && (
            <span className="text-[10px] font-mono text-[#DC2626] dark:text-[#FACC15]">
              {(active.pct * 100).toFixed(1)}%
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 w-full space-y-2 min-w-0">
        {computed.slice(0, 6).map((s, idx) => (
          <div
            key={`${s.label}-${idx}`}
            onMouseEnter={() => setHoveredIdx(idx)}
            onMouseLeave={() => setHoveredIdx(null)}
            className={cn(
              'flex items-center justify-between gap-2 text-xs px-2 py-1 rounded-md transition-colors cursor-pointer',
              hoveredIdx === idx
                ? 'bg-slate-100 dark:bg-[#251B20]'
                : 'hover:bg-slate-50 dark:hover:bg-[#251B20]/60',
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="h-2.5 w-2.5 rounded-xs shrink-0"
                style={{ backgroundColor: s.color }}
              />
              <span className="truncate text-[#1C1917] dark:text-slate-200">{s.label}</span>
            </div>
            <div className="font-mono tabular-nums shrink-0 text-right">
              <span className="font-semibold text-[#1C1917] dark:text-slate-100">
                {formatValue(s.value)}
              </span>
              <span className="ml-1.5 text-[10px] text-[#718096] dark:text-slate-400">
                {(s.pct * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 5. Ranked Horizontal Progress / Funnel Chart                               */
/* -------------------------------------------------------------------------- */

export interface HorizontalBarItem {
  label: string;
  value: number;
  meta?: string;
  color?: string;
}

export function HorizontalBarChart({
  items,
  formatValue,
  emptyMessage = 'No records available yet.',
}: {
  items: HorizontalBarItem[];
  formatValue: (v: number) => string;
  emptyMessage?: string;
}) {
  if (items.length === 0) {
    return <p className="text-xs text-[#718096] dark:text-slate-400">{emptyMessage}</p>;
  }
  const max = Math.max(1, ...items.map((i) => i.value));

  return (
    <div className="space-y-3">
      {items.map((item, idx) => {
        const pct = item.value > 0 ? Math.max(4, Math.round((item.value / max) * 100)) : 0;
        const barColor = item.color || CHART_PALETTE[idx % CHART_PALETTE.length];
        return (
          <div key={`${item.label}-${idx}`} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-medium text-[#1C1917] dark:text-slate-200 truncate">
                {item.label}
                {item.meta ? (
                  <span className="text-[#718096] dark:text-slate-400 ml-1.5">· {item.meta}</span>
                ) : null}
              </span>
              <span className="font-mono tabular-nums font-semibold text-[#1C1917] dark:text-slate-100 shrink-0">
                {formatValue(item.value)}
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 dark:bg-[#251B20] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${pct}%`, backgroundColor: barColor }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
