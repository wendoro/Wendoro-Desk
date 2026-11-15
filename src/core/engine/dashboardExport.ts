import type { AreaSeriesPoint, BarDatum, DonutSlice } from '@/src/components/charts/ErpCharts';
import type {
  InventoryTurnoverPoint,
  MonthlySalesTrendPoint,
} from '@/src/core/engine/chartDataHelpers';
import { formatNumericCurrency } from '@/src/lib/utils';

export interface DashboardExportSnapshot {
  companyName: string;
  companyCode: string;
  branchName: string;
  currency: string;
  granularity: 'month' | 'day';
  generatedAt: string;
  metrics: {
    totalRevenue: number;
    openReceivables: number;
    totalExpenses: number;
    openPayables: number;
    netIncome: number;
    inventoryAssetValue: number;
    lowStockCount: number;
    openTasksCount: number;
    openTicketsCount: number;
    balancedJournalsCount: number;
    collectionRatePct: number;
    avgInventoryTurnover: number;
    totalDispatchedUnits: number;
  };
  monthlySalesTrends: MonthlySalesTrendPoint[];
  inventoryTurnover: InventoryTurnoverPoint[];
  cashFlowSeries: AreaSeriesPoint[];
  channelBars: BarDatum[];
  balanceSlices: DonutSlice[];
  topInventoryBars: BarDatum[];
}

export type DashboardExportFormat = 'csv' | 'pdf';

export interface ExportResult {
  format: DashboardExportFormat;
  filename: string;
  byteSize: number;
}

export function buildExportFilename(
  companyCode: string,
  format: DashboardExportFormat,
  generatedAtIso: string,
): string {
  const safeCode =
    companyCode
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'company';
  const datePart = generatedAtIso.slice(0, 10) || new Date().toISOString().slice(0, 10);
  return `wendoro-${safeCode}-business-metrics-${datePart}.${format}`;
}

/* -------------------------------------------------------------------------- */
/* 1. CSV Report Generator (RFC 4180 compliant, UTF-8 BOM for desktop Excel)  */
/* -------------------------------------------------------------------------- */

function escapeCsvCell(value: string | number): string {
  const str = String(value ?? '');
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function csvRow(cells: Array<string | number>): string {
  return cells.map(escapeCsvCell).join(',');
}

export function generateDashboardCsvReport(snapshot: DashboardExportSnapshot): string {
  const { metrics, currency } = snapshot;
  const lines: string[] = [];

  lines.push(csvRow(['WENDORO ERP — EXECUTIVE BUSINESS METRICS REPORT']));
  lines.push(csvRow(['Company', snapshot.companyName, 'Company Code', snapshot.companyCode]));
  lines.push(csvRow(['Branch', snapshot.branchName, 'Base Currency', currency]));
  lines.push(
    csvRow([
      'Trend Granularity',
      snapshot.granularity === 'month' ? 'Monthly' : 'Daily',
      'Generated At',
      snapshot.generatedAt,
    ]),
  );
  lines.push('');

  // Section 1: Executive KPIs
  lines.push(csvRow(['SECTION 1: EXECUTIVE KPI SUMMARY']));
  lines.push(csvRow(['Metric', 'Raw Value', 'Formatted Value', 'Context']));
  lines.push(
    csvRow([
      'Recorded Revenue',
      metrics.totalRevenue.toFixed(2),
      formatNumericCurrency(metrics.totalRevenue, currency, 2),
      'Posted general ledger revenue',
    ]),
  );
  lines.push(
    csvRow([
      'Open Receivables',
      metrics.openReceivables.toFixed(2),
      formatNumericCurrency(metrics.openReceivables, currency, 2),
      'Unpaid customer invoice balances',
    ]),
  );
  lines.push(
    csvRow([
      'Recorded Expenses',
      metrics.totalExpenses.toFixed(2),
      formatNumericCurrency(metrics.totalExpenses, currency, 2),
      'Posted general ledger expenses',
    ]),
  );
  lines.push(
    csvRow([
      'Open Payables',
      metrics.openPayables.toFixed(2),
      formatNumericCurrency(metrics.openPayables, currency, 2),
      'Outstanding vendor purchase bills',
    ]),
  );
  lines.push(
    csvRow([
      'Net Operating Position',
      metrics.netIncome.toFixed(2),
      formatNumericCurrency(metrics.netIncome, currency, 2),
      'Revenue minus Expenses',
    ]),
  );
  lines.push(
    csvRow([
      'Stock Asset Value',
      metrics.inventoryAssetValue.toFixed(2),
      formatNumericCurrency(metrics.inventoryAssetValue, currency, 2),
      'Weighted-average inventory valuation',
    ]),
  );
  lines.push(
    csvRow([
      'Sales Collection Rate',
      metrics.collectionRatePct.toFixed(1),
      `${metrics.collectionRatePct}%`,
      'Collected cash / invoiced sales in active periods',
    ]),
  );
  lines.push(
    csvRow([
      'Average Inventory Turnover',
      metrics.avgInventoryTurnover.toFixed(2),
      `${metrics.avgInventoryTurnover.toFixed(2)}x`,
      `${metrics.totalDispatchedUnits} total units dispatched`,
    ]),
  );
  lines.push(
    csvRow([
      'Operations Queue',
      metrics.lowStockCount + metrics.openTasksCount + metrics.openTicketsCount,
      `${metrics.lowStockCount} Low Stock | ${metrics.openTasksCount} Tasks | ${metrics.openTicketsCount} Tickets`,
      `${metrics.balancedJournalsCount} balanced GL journals`,
    ]),
  );
  lines.push('');

  // Section 2: Monthly / Daily Sales Trends
  lines.push(
    csvRow([
      snapshot.granularity === 'month'
        ? 'SECTION 2: MONTHLY SALES TRENDS'
        : 'SECTION 2: DAILY SALES TRENDS',
    ]),
  );
  lines.push(
    csvRow([
      'Period',
      'Period Key',
      'Orders',
      `Invoiced Sales (${currency})`,
      `Collected Revenue (${currency})`,
      `GL Expenses (${currency})`,
      'Collection %',
    ]),
  );
  if (snapshot.monthlySalesTrends.length === 0) {
    lines.push(csvRow(['No sales trend activity recorded yet']));
  } else {
    for (const pt of snapshot.monthlySalesTrends) {
      const rate = pt.invoiced > 0 ? Math.round((pt.collected / pt.invoiced) * 100) : 0;
      lines.push(
        csvRow([
          pt.label,
          pt.periodKey,
          pt.orderCount,
          pt.invoiced.toFixed(2),
          pt.collected.toFixed(2),
          pt.expenses.toFixed(2),
          `${rate}%`,
        ]),
      );
    }
  }
  lines.push('');

  // Section 3: Inventory Turnover
  lines.push(csvRow(['SECTION 3: INVENTORY TURNOVER BY SKU']));
  lines.push(
    csvRow([
      'SKU',
      'Product Name',
      'Units Dispatched',
      'Stock On Hand',
      'Turnover Ratio',
      `COGS Out Value (${currency})`,
      `Stock Asset Value (${currency})`,
    ]),
  );
  if (snapshot.inventoryTurnover.length === 0) {
    lines.push(csvRow(['No tracked inventory turnover activity recorded yet']));
  } else {
    for (const item of snapshot.inventoryTurnover) {
      lines.push(
        csvRow([
          item.sku,
          item.name,
          item.unitsDispatched,
          item.stockOnHand,
          `${item.turnoverRatio.toFixed(2)}x`,
          item.cogsOutValue.toFixed(2),
          item.assetValue.toFixed(2),
        ]),
      );
    }
  }
  lines.push('');

  // Section 4: Revenue vs Expense Performance
  lines.push(csvRow(['SECTION 4: REVENUE VS EXPENSE PERFORMANCE']));
  lines.push(csvRow(['Period', `Revenue (${currency})`, `Expenses (${currency})`, `Net (${currency})`]));
  if (snapshot.cashFlowSeries.length === 0) {
    lines.push(csvRow(['No general ledger cash flow activity recorded yet']));
  } else {
    for (const pt of snapshot.cashFlowSeries) {
      const exp = pt.secondary ?? 0;
      lines.push(csvRow([pt.label, pt.primary.toFixed(2), exp.toFixed(2), (pt.primary - exp).toFixed(2)]));
    }
  }
  lines.push('');

  // Section 5: Sales & Collection by Channel
  lines.push(csvRow(['SECTION 5: SALES & COLLECTION BY CHANNEL']));
  lines.push(
    csvRow(['Channel', `Invoiced (${currency})`, `Collected (${currency})`, `Outstanding (${currency})`]),
  );
  for (const ch of snapshot.channelBars) {
    const collected = ch.secondary ?? 0;
    lines.push(
      csvRow([
        ch.label,
        ch.primary.toFixed(2),
        collected.toFixed(2),
        Math.max(0, ch.primary - collected).toFixed(2),
      ]),
    );
  }
  lines.push('');

  // Section 6: Working Capital & GL Mix
  lines.push(csvRow(['SECTION 6: WORKING CAPITAL & GL MIX']));
  lines.push(csvRow(['Account Bucket', `Balance (${currency})`]));
  if (snapshot.balanceSlices.length === 0) {
    lines.push(csvRow(['No active balance sheet buckets']));
  } else {
    for (const slice of snapshot.balanceSlices) {
      lines.push(csvRow([slice.label, slice.value.toFixed(2)]));
    }
  }
  lines.push('');

  // Section 7: Inventory Cost vs Retail Valuation
  lines.push(csvRow(['SECTION 7: INVENTORY COST VS RETAIL VALUATION']));
  lines.push(
    csvRow([
      'SKU',
      `Asset Cost (${currency})`,
      `Retail Value (${currency})`,
      `Potential Margin (${currency})`,
    ]),
  );
  if (snapshot.topInventoryBars.length === 0) {
    lines.push(csvRow(['No stocked items available for valuation']));
  } else {
    for (const inv of snapshot.topInventoryBars) {
      const retail = inv.secondary ?? 0;
      lines.push(
        csvRow([inv.label, inv.primary.toFixed(2), retail.toFixed(2), (retail - inv.primary).toFixed(2)]),
      );
    }
  }

  return '\uFEFF' + lines.join('\r\n');
}

/* -------------------------------------------------------------------------- */
/* 2. Zero-Dependency Binary PDF 1.4 Generator (100% Offline Native)          */
/* -------------------------------------------------------------------------- */

function toPdfAscii(text: string): string {
  return String(text ?? '')
    .replace(/\u20B9/g, 'INR ')
    .replace(/\u20AC/g, 'EUR ')
    .replace(/\u00A3/g, 'GBP ')
    .replace(/\u00A5/g, 'JPY ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014\u00B7]/g, '-')
    .replace(/[^\x20-\x7E]/g, ' ');
}

function pdfEscape(text: string): string {
  return toPdfAscii(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function fitText(text: string, maxChars: number): string {
  const clean = toPdfAscii(text).trim();
  if (clean.length <= maxChars) return clean;
  if (maxChars <= 3) return clean.slice(0, maxChars);
  return `${clean.slice(0, maxChars - 3)}...`;
}

interface PdfColumn {
  header: string;
  width: number;
  align?: 'left' | 'right';
}

class PdfDocBuilder {
  private readonly pageWidth = 595;
  private readonly pageHeight = 842;
  private readonly marginLeft = 40;
  private readonly contentWidth = 515;
  private readonly bottomMargin = 52;
  private pages: string[][] = [[]];
  private y = 802;

  private currentStream(): string[] {
    return this.pages[this.pages.length - 1]!;
  }

  addPage() {
    this.pages.push([]);
    this.y = 802;
  }

  ensureSpace(neededHeight: number) {
    if (this.y - neededHeight < this.bottomMargin) {
      this.addPage();
    }
  }

  drawRect(x: number, y: number, w: number, h: number, rgb: [number, number, number]) {
    this.currentStream().push(
      `${rgb[0].toFixed(3)} ${rgb[1].toFixed(3)} ${rgb[2].toFixed(3)} rg`,
      `${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re f`,
    );
  }

  strokeRect(
    x: number,
    y: number,
    w: number,
    h: number,
    rgb: [number, number, number],
    lineWidth = 0.6,
  ) {
    this.currentStream().push(
      `${lineWidth.toFixed(2)} w`,
      `${rgb[0].toFixed(3)} ${rgb[1].toFixed(3)} ${rgb[2].toFixed(3)} RG`,
      `${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re S`,
    );
  }

  drawText(
    text: string,
    x: number,
    y: number,
    options?: {
      font?: 'F1' | 'F2';
      size?: number;
      rgb?: [number, number, number];
    },
  ) {
    const font = options?.font ?? 'F1';
    const size = options?.size ?? 9;
    const rgb = options?.rgb ?? [0.11, 0.1, 0.09];
    this.currentStream().push(
      'BT',
      `/${font} ${size} Tf`,
      `${rgb[0].toFixed(3)} ${rgb[1].toFixed(3)} ${rgb[2].toFixed(3)} rg`,
      `1 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)} Tm`,
      `(${pdfEscape(text)}) Tj`,
      'ET',
    );
  }

  drawRightText(
    text: string,
    rightX: number,
    y: number,
    options?: {
      font?: 'F1' | 'F2';
      size?: number;
      rgb?: [number, number, number];
    },
  ) {
    const clean = toPdfAscii(text);
    const size = options?.size ?? 9;
    const approxCharWidth = size * 0.51;
    const estWidth = clean.length * approxCharWidth;
    this.drawText(clean, Math.max(this.marginLeft, rightX - estWidth), y, options);
  }

  drawHeaderBanner(snapshot: DashboardExportSnapshot) {
    // Crimson Red banner (#DC2626) + Golden Yellow stripe (#FACC15)
    const bannerHeight = 68;
    const bannerBottom = this.y - bannerHeight;
    this.drawRect(this.marginLeft, bannerBottom, this.contentWidth, bannerHeight, [0.863, 0.149, 0.149]);
    this.drawRect(this.marginLeft, bannerBottom - 4, this.contentWidth, 4, [0.98, 0.8, 0.082]);

    this.drawText('WENDORO ERP - EXECUTIVE BUSINESS METRICS', this.marginLeft + 14, this.y - 23, {
      font: 'F2',
      size: 13,
      rgb: [1, 1, 1],
    });
    this.drawText(
      fitText(
        `${snapshot.companyName} (${snapshot.companyCode}) | Branch: ${snapshot.branchName} | Currency: ${snapshot.currency}`,
        86,
      ),
      this.marginLeft + 14,
      this.y - 40,
      { font: 'F1', size: 9, rgb: [1, 0.96, 0.9] },
    );
    this.drawText(
      `Generated: ${snapshot.generatedAt} | Mode: Offline Native Report | Granularity: ${
        snapshot.granularity === 'month' ? 'Monthly' : 'Daily'
      }`,
      this.marginLeft + 14,
      this.y - 54,
      { font: 'F1', size: 8, rgb: [0.996, 0.94, 0.54] },
    );

    this.y = bannerBottom - 20;
  }

  drawKpiCards(snapshot: DashboardExportSnapshot) {
    const { metrics, currency } = snapshot;
    const cards: Array<{ label: string; value: string; sub: string; accent: [number, number, number] }> = [
      {
        label: 'RECORDED REVENUE',
        value: formatNumericCurrency(metrics.totalRevenue, currency, 2),
        sub: `Open AR: ${formatNumericCurrency(metrics.openReceivables, currency, 2)}`,
        accent: [0.961, 0.62, 0.043],
      },
      {
        label: 'RECORDED EXPENSES',
        value: formatNumericCurrency(metrics.totalExpenses, currency, 2),
        sub: `Open AP: ${formatNumericCurrency(metrics.openPayables, currency, 2)}`,
        accent: [0.863, 0.149, 0.149],
      },
      {
        label: 'NET OPERATING POSITION',
        value: formatNumericCurrency(metrics.netIncome, currency, 2),
        sub: `Stock Value: ${formatNumericCurrency(metrics.inventoryAssetValue, currency, 2)}`,
        accent: [0.851, 0.467, 0.024],
      },
      {
        label: 'COLLECTION & TURNOVER',
        value: `${metrics.collectionRatePct}% Collected`,
        sub: `Avg Turnover: ${metrics.avgInventoryTurnover.toFixed(2)}x (${metrics.totalDispatchedUnits} out)`,
        accent: [0.863, 0.149, 0.149],
      },
    ];

    this.ensureSpace(125);
    const colGap = 11;
    const cardW = (this.contentWidth - colGap) / 2;
    const cardH = 48;

    cards.forEach((card, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const x = this.marginLeft + col * (cardW + colGap);
      const topY = this.y - row * (cardH + 8);
      const bottomY = topY - cardH;

      this.drawRect(x, bottomY, cardW, cardH, [0.98, 0.976, 0.969]);
      this.strokeRect(x, bottomY, cardW, cardH, [0.906, 0.886, 0.863], 0.6);
      this.drawRect(x, bottomY, 4, cardH, card.accent);

      this.drawText(card.label, x + 11, topY - 13, {
        font: 'F2',
        size: 7.5,
        rgb: [0.341, 0.325, 0.306],
      });
      this.drawText(fitText(card.value, 32), x + 11, topY - 28, {
        font: 'F2',
        size: 11.5,
        rgb: [0.11, 0.098, 0.09],
      });
      this.drawText(fitText(card.sub, 44), x + 11, topY - 40, {
        font: 'F1',
        size: 7.5,
        rgb: [0.42, 0.4, 0.38],
      });
    });

    this.y -= 2 * (cardH + 8) + 8;
  }

  drawSectionHeading(title: string) {
    this.ensureSpace(44);
    this.drawText(title, this.marginLeft, this.y, {
      font: 'F2',
      size: 10.5,
      rgb: [0.863, 0.149, 0.149],
    });
    this.drawRect(this.marginLeft, this.y - 4, this.contentWidth, 1.2, [0.98, 0.8, 0.082]);
    this.y -= 18;
  }

  drawTable(title: string, columns: PdfColumn[], rows: string[][], emptyMessage: string) {
    this.drawSectionHeading(title);

    const headerH = 20;
    const rowH = 17;

    const drawHeaderRow = () => {
      this.ensureSpace(headerH + rowH);
      this.drawRect(this.marginLeft, this.y - headerH, this.contentWidth, headerH, [0.094, 0.071, 0.078]);
      let cx = this.marginLeft;
      for (const col of columns) {
        const textY = this.y - 13.5;
        if (col.align === 'right') {
          this.drawRightText(fitText(col.header, Math.floor(col.width / 4.8)), cx + col.width - 6, textY, {
            font: 'F2',
            size: 8,
            rgb: [1, 1, 1],
          });
        } else {
          this.drawText(fitText(col.header, Math.floor(col.width / 4.8)), cx + 6, textY, {
            font: 'F2',
            size: 8,
            rgb: [1, 1, 1],
          });
        }
        cx += col.width;
      }
      this.y -= headerH;
    };

    if (rows.length === 0) {
      this.ensureSpace(24);
      this.drawRect(this.marginLeft, this.y - 20, this.contentWidth, 20, [0.98, 0.976, 0.969]);
      this.strokeRect(this.marginLeft, this.y - 20, this.contentWidth, 20, [0.906, 0.886, 0.863], 0.5);
      this.drawText(fitText(emptyMessage, 88), this.marginLeft + 8, this.y - 13, {
        font: 'F1',
        size: 8,
        rgb: [0.42, 0.4, 0.38],
      });
      this.y -= 30;
      return;
    }

    drawHeaderRow();

    rows.forEach((row, rIdx) => {
      if (this.y - rowH < this.bottomMargin) {
        this.addPage();
        this.drawText(`${title} (continued)`, this.marginLeft, this.y, {
          font: 'F2',
          size: 9.5,
          rgb: [0.863, 0.149, 0.149],
        });
        this.y -= 14;
        drawHeaderRow();
      }

      const bg: [number, number, number] = rIdx % 2 === 0 ? [1, 1, 1] : [0.98, 0.976, 0.969];
      this.drawRect(this.marginLeft, this.y - rowH, this.contentWidth, rowH, bg);
      this.strokeRect(this.marginLeft, this.y - rowH, this.contentWidth, rowH, [0.92, 0.9, 0.88], 0.4);

      let cx = this.marginLeft;
      columns.forEach((col, cIdx) => {
        const val = row[cIdx] ?? '';
        const maxChars = Math.max(4, Math.floor((col.width - 10) / 4.6));
        const cellText = fitText(val, maxChars);
        const textY = this.y - 11.8;
        if (col.align === 'right') {
          this.drawRightText(cellText, cx + col.width - 6, textY, {
            font: 'F1',
            size: 8,
            rgb: [0.15, 0.14, 0.13],
          });
        } else {
          this.drawText(cellText, cx + 6, textY, {
            font: 'F1',
            size: 8,
            rgb: [0.15, 0.14, 0.13],
          });
        }
        cx += col.width;
      });

      this.y -= rowH;
    });

    this.y -= 14;
  }

  build(companyName: string): Uint8Array {
    // Stamp consistent footers across all generated pages
    const totalPages = this.pages.length;
    this.pages.forEach((stream, idx) => {
      stream.push(
        '0.50 w',
        '0.880 0.860 0.840 RG',
        `${this.marginLeft} 34 m ${this.marginLeft + this.contentWidth} 34 l S`,
        'BT',
        '/F1 7.5 Tf',
        '0.450 0.430 0.410 rg',
        `1 0 0 1 ${this.marginLeft} 22 Tm`,
        `(${pdfEscape(`WENDORO ERP Desktop · ${fitText(companyName, 45)} · Offline Report`)}) Tj`,
        'ET',
        'BT',
        '/F1 7.5 Tf',
        '0.450 0.430 0.410 rg',
        `1 0 0 1 ${this.marginLeft + this.contentWidth - 52} 22 Tm`,
        `(${pdfEscape(`Page ${idx + 1} of ${totalPages}`)}) Tj`,
        'ET',
      );
    });

    // Object numbering:
    // 1: Catalog
    // 2: Pages
    // 3: Font F1 (Helvetica)
    // 4: Font F2 (Helvetica-Bold)
    // 5..4+2*N: alternating Page dict and Content stream for each page
    const encoder = new TextEncoder();
    const parts: Uint8Array[] = [];
    const offsets: number[] = [0]; // 1-indexed object byte offsets
    let cursor = 0;

    const pushAscii = (str: string) => {
      const bytes = encoder.encode(str);
      parts.push(bytes);
      cursor += bytes.byteLength;
    };

    const startObj = (objNum: number) => {
      offsets[objNum] = cursor;
      pushAscii(`${objNum} 0 obj\n`);
    };

    const endObj = () => {
      pushAscii('\nendobj\n');
    };

    pushAscii('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

    const pageObjIds: number[] = [];
    for (let i = 0; i < this.pages.length; i++) {
      pageObjIds.push(5 + i * 2);
    }

    startObj(1);
    pushAscii('<< /Type /Catalog /Pages 2 0 R >>');
    endObj();

    startObj(2);
    pushAscii(`<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageObjIds.length} >>`);
    endObj();

    startObj(3);
    pushAscii('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    endObj();

    startObj(4);
    pushAscii('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    endObj();

    this.pages.forEach((streamCommands, i) => {
      const pageId = 5 + i * 2;
      const contentId = pageId + 1;
      const streamBody = streamCommands.join('\n');
      const streamBytes = encoder.encode(streamBody);

      startObj(pageId);
      pushAscii(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.pageWidth} ${this.pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`,
      );
      endObj();

      startObj(contentId);
      pushAscii(`<< /Length ${streamBytes.byteLength} >>\nstream\n`);
      parts.push(streamBytes);
      cursor += streamBytes.byteLength;
      pushAscii('\nendstream');
      endObj();
    });

    const xrefOffset = cursor;
    const totalObjects = offsets.length;
    pushAscii(`xref\n0 ${totalObjects}\n`);
    pushAscii('0000000000 65535 f \n');
    for (let objNum = 1; objNum < totalObjects; objNum++) {
      const off = String(offsets[objNum] ?? 0).padStart(10, '0');
      pushAscii(`${off} 00000 n \n`);
    }
    pushAscii(`trailer\n<< /Size ${totalObjects} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

    const output = new Uint8Array(cursor);
    let writePos = 0;
    for (const chunk of parts) {
      output.set(chunk, writePos);
      writePos += chunk.byteLength;
    }
    return output;
  }
}

export function generateDashboardPdfReport(snapshot: DashboardExportSnapshot): Uint8Array {
  const { currency } = snapshot;
  const pdf = new PdfDocBuilder();

  pdf.drawHeaderBanner(snapshot);
  pdf.drawKpiCards(snapshot);

  pdf.drawTable(
    snapshot.granularity === 'month' ? 'Monthly Sales Trends' : 'Daily Sales Trends',
    [
      { header: 'Period', width: 110, align: 'left' },
      { header: 'Orders', width: 65, align: 'right' },
      { header: 'Invoiced Sales', width: 120, align: 'right' },
      { header: 'Collected Cash', width: 120, align: 'right' },
      { header: 'GL Expenses', width: 100, align: 'right' },
    ],
    snapshot.monthlySalesTrends.map((pt) => [
      pt.label,
      String(pt.orderCount),
      formatNumericCurrency(pt.invoiced, currency, 2),
      formatNumericCurrency(pt.collected, currency, 2),
      formatNumericCurrency(pt.expenses, currency, 2),
    ]),
    'No sales orders or invoices posted yet.',
  );

  pdf.drawTable(
    'Inventory Turnover by SKU',
    [
      { header: 'SKU', width: 80, align: 'left' },
      { header: 'Product Name', width: 155, align: 'left' },
      { header: 'Dispatched', width: 65, align: 'right' },
      { header: 'On Hand', width: 65, align: 'right' },
      { header: 'Turnover', width: 60, align: 'right' },
      { header: 'Stock Value', width: 90, align: 'right' },
    ],
    snapshot.inventoryTurnover.map((item) => [
      item.sku,
      item.name,
      String(item.unitsDispatched),
      String(item.stockOnHand),
      `${item.turnoverRatio.toFixed(2)}x`,
      formatNumericCurrency(item.assetValue, currency, 2),
    ]),
    'No tracked inventory turnover movements recorded yet.',
  );

  pdf.drawTable(
    'Sales & Collection by Channel',
    [
      { header: 'Channel', width: 165, align: 'left' },
      { header: 'Invoiced Total', width: 120, align: 'right' },
      { header: 'Collected Cash', width: 120, align: 'right' },
      { header: 'Open Balance', width: 110, align: 'right' },
    ],
    snapshot.channelBars.map((ch) => {
      const collected = ch.secondary ?? 0;
      return [
        ch.label,
        formatNumericCurrency(ch.primary, currency, 2),
        formatNumericCurrency(collected, currency, 2),
        formatNumericCurrency(Math.max(0, ch.primary - collected), currency, 2),
      ];
    }),
    'No channel sales recorded yet.',
  );

  pdf.drawTable(
    'Working Capital & General Ledger Mix',
    [
      { header: 'Account Bucket', width: 325, align: 'left' },
      { header: 'Net Balance', width: 190, align: 'right' },
    ],
    snapshot.balanceSlices.map((s) => [s.label, formatNumericCurrency(s.value, currency, 2)]),
    'No active general ledger balances recorded yet.',
  );

  pdf.drawTable(
    'Inventory Cost vs. Retail Valuation',
    [
      { header: 'SKU', width: 145, align: 'left' },
      { header: 'Asset Cost', width: 125, align: 'right' },
      { header: 'Retail Value', width: 125, align: 'right' },
      { header: 'Potential Margin', width: 120, align: 'right' },
    ],
    snapshot.topInventoryBars.map((b) => {
      const retail = b.secondary ?? 0;
      return [
        b.label,
        formatNumericCurrency(b.primary, currency, 2),
        formatNumericCurrency(retail, currency, 2),
        formatNumericCurrency(retail - b.primary, currency, 2),
      ];
    }),
    'No stocked items available for valuation.',
  );

  return pdf.build(snapshot.companyName);
}

/* -------------------------------------------------------------------------- */
/* 3. Browser / Electron Offline Download Trigger                             */
/* -------------------------------------------------------------------------- */

function triggerLocalBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportDashboardReport(
  snapshot: DashboardExportSnapshot,
  format: DashboardExportFormat,
): ExportResult {
  const filename = buildExportFilename(snapshot.companyCode, format, snapshot.generatedAt);

  if (format === 'csv') {
    const csvContent = generateDashboardCsvReport(snapshot);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    triggerLocalBlobDownload(blob, filename);
    return { format, filename, byteSize: blob.size };
  }

  const pdfBytes = generateDashboardPdfReport(snapshot);
  const pdfCopy = new Uint8Array(pdfBytes.byteLength);
  pdfCopy.set(pdfBytes);
  const blob = new Blob([pdfCopy.buffer], { type: 'application/pdf' });
  triggerLocalBlobDownload(blob, filename);
  return { format, filename, byteSize: blob.size };
}
