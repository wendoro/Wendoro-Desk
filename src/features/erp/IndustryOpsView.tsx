import React, { useMemo, useState } from 'react';
import { CheckCircle2, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { DataColumn, DataTable } from '@/src/components/ui/DataTable';
import { Surface } from '@/src/components/ui/Surface';
import { useErpData } from '@/src/components/shell/ErpDataProvider';
import { useTenant } from '@/src/components/shell/TenantProvider';
import { WENDORO_MODULES } from '@/src/core/registry/modules';
import { IndustryOperationRecord } from '@/src/core/store/erpTypes';
import { formatNumericCurrency } from '@/src/lib/utils';

interface IndustryLabels {
  heading: string;
  subtitle: string;
  createLabel: string;
  refPrefix: string;
  titlePlaceholder: string;
  counterpartyLabel: string;
  counterpartyPlaceholder: string;
  qtyLabel: string;
  amountLabel: string;
  metaPlaceholder: string;
  emptyTitle: string;
  emptyDescription: string;
}

const INDUSTRY_LABELS: Record<string, IndustryLabels> = {
  industry_retail: {
    heading: 'Retail & POS Operations',
    subtitle:
      'Run instant POS counter checkouts tied to Inventory & Accounting, and manage storefront orders, returns, or promotions.',
    createLabel: 'Log Store Operation',
    refPrefix: 'RET',
    titlePlaceholder: 'Order / Promotion / Return title *',
    counterpartyLabel: 'Channel / Customer',
    counterpartyPlaceholder: 'POS Register / Storefront / Customer',
    qtyLabel: 'Items',
    amountLabel: 'Value',
    metaPlaceholder: 'Promo code, register ID, or return reason',
    emptyTitle: 'No retail store operations logged',
    emptyDescription:
      'Use the Quick POS Checkout above for instant sales or log promotions, registers, and store returns below.',
  },
  industry_manufacturing: {
    heading: 'Manufacturing & Production',
    subtitle:
      'Manage Bills of Materials (BOM), shop-floor work orders, batch production runs, and quality inspections.',
    createLabel: 'New Work Order',
    refPrefix: 'WO',
    titlePlaceholder: 'Work Order / BOM Assembly Name *',
    counterpartyLabel: 'Work Center / Line',
    counterpartyPlaceholder: 'Assembly Line A / Floor 2',
    qtyLabel: 'Batch Qty',
    amountLabel: 'Est. Cost',
    metaPlaceholder: 'BOM components, routing notes, or QC status',
    emptyTitle: 'No manufacturing work orders yet',
    emptyDescription:
      'Create production work orders to track batch quantities, shop-floor lines, and unit production costs.',
  },
  industry_electronics: {
    heading: 'Electronics, IMEI & Service Desk',
    subtitle:
      'Track serialized IMEI/batch units, warranty claims, RMA repairs, and spare parts allocation.',
    createLabel: 'Log Repair / RMA',
    refPrefix: 'RMA',
    titlePlaceholder: 'Device Model / Repair Job *',
    counterpartyLabel: 'Customer / Technician',
    counterpartyPlaceholder: 'Customer name or repair center',
    qtyLabel: 'Units',
    amountLabel: 'Repair Fee',
    metaPlaceholder: 'IMEI / Serial number & warranty status',
    emptyTitle: 'No repair or warranty jobs logged',
    emptyDescription:
      'Register serialized repairs, warranty claims, and RMA service tickets for customer devices.',
  },
  industry_realestate: {
    heading: 'Real Estate & Lease Management',
    subtitle:
      'Manage property units, tenant lease agreements, monthly rent schedules, and broker commissions.',
    createLabel: 'Add Property / Lease',
    refPrefix: 'LSE',
    titlePlaceholder: 'Property / Unit / Lease Title *',
    counterpartyLabel: 'Tenant / Owner',
    counterpartyPlaceholder: 'Tenant or property owner name',
    qtyLabel: 'Sq.Ft / Units',
    amountLabel: 'Monthly Rent / Value',
    metaPlaceholder: 'Lease term, security deposit, or unit code',
    emptyTitle: 'No properties or leases registered',
    emptyDescription:
      'Add property units and active lease agreements to track occupancy and rent schedules.',
  },
  industry_services: {
    heading: 'Professional Services & Retainers',
    subtitle:
      'Track client retainers, milestone billing schedules, billable hours, and delivery utilization.',
    createLabel: 'New Retainer / Engagement',
    refPrefix: 'ENG',
    titlePlaceholder: 'Engagement / Retainer Scope *',
    counterpartyLabel: 'Client Organization',
    counterpartyPlaceholder: 'Client company name',
    qtyLabel: 'Billable Hours',
    amountLabel: 'Contract Value',
    metaPlaceholder: 'Billing cadence, SLA, or lead consultant',
    emptyTitle: 'No client retainers logged',
    emptyDescription:
      'Create client engagements and retainers to monitor billable hours and contract milestones.',
  },
};

export function IndustryOpsView({ moduleSlug }: { moduleSlug: string }) {
  const { activeCompany } = useTenant();
  const {
    data,
    addIndustryRecord,
    updateIndustryRecordStatus,
    deleteIndustryRecord,
    createSalesOrder,
  } = useErpData();

  const currency = activeCompany.baseCurrency;
  const modMeta = WENDORO_MODULES.find((m) => m.slug === moduleSlug);
  const labels: IndustryLabels = INDUSTRY_LABELS[moduleSlug] ?? {
    heading: modMeta?.name ?? 'Industry Operations',
    subtitle: modMeta?.description ?? 'Manage industry-specific operational records.',
    createLabel: 'New Record',
    refPrefix: 'OPS',
    titlePlaceholder: 'Operation Title *',
    counterpartyLabel: 'Counterparty / Location',
    counterpartyPlaceholder: 'Customer, site, or unit',
    qtyLabel: 'Quantity',
    amountLabel: 'Amount',
    metaPlaceholder: 'Operational notes or reference details',
    emptyTitle: 'No operational records yet',
    emptyDescription: 'Add your first operational record to track workflows and statuses.',
  };

  const scopedRecords = useMemo(
    () => data.industryRecords.filter((r) => r.moduleSlug === moduleSlug),
    [data.industryRecords, moduleSlug],
  );

  // Standard Industry Record Form State
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [quantityOrUnits, setQuantityOrUnits] = useState('1');
  const [amount, setAmount] = useState('0');
  const [metadata, setMetadata] = useState('');

  // Quick POS Checkout State (for industry_retail)
  const [posCustomer, setPosCustomer] = useState('Walk-in Customer');
  const [posItemId, setPosItemId] = useState('');
  const [posQty, setPosQty] = useState('1');
  const [posCart, setPosCart] = useState<
    Array<{ itemId: string; name: string; sku: string; qty: number; unitPrice: number; taxRate: number }>
  >([]);
  const [posReceiptMsg, setPosReceiptMsg] = useState<string | null>(null);

  const handleAddRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    addIndustryRecord({
      moduleSlug,
      reference: `${labels.refPrefix}-${String(scopedRecords.length + 1).padStart(4, '0')}`,
      title: title.trim(),
      counterparty: counterparty.trim() || 'Internal',
      status: 'open',
      quantityOrUnits: Math.max(0, Number(quantityOrUnits) || 0),
      amount: Math.max(0, Number(amount) || 0),
      metadata: metadata.trim(),
    });
    setTitle('');
    setCounterparty('');
    setQuantityOrUnits('1');
    setAmount('0');
    setMetadata('');
    setShowForm(false);
  };

  const handleAddToPosCart = () => {
    const item = data.catalogue.find((c) => c.id === posItemId);
    if (!item) return;
    const qty = Math.max(1, Number(posQty) || 1);
    setPosCart((prev) => {
      const existing = prev.find((x) => x.itemId === item.id);
      if (existing) {
        return prev.map((x) =>
          x.itemId === item.id ? { ...x, qty: x.qty + qty } : x,
        );
      }
      return [
        ...prev,
        {
          itemId: item.id,
          name: item.name,
          sku: item.sku,
          qty,
          unitPrice: item.sellingPrice,
          taxRate: item.taxRate,
        },
      ];
    });
    setPosQty('1');
    setPosReceiptMsg(null);
  };

  const posTotals = useMemo(() => {
    let subtotal = 0;
    let tax = 0;
    posCart.forEach((c) => {
      const base = c.qty * c.unitPrice;
      subtotal += base;
      tax += (base * c.taxRate) / 100;
    });
    return { subtotal, tax, total: subtotal + tax };
  }, [posCart]);

  const handleCheckoutPos = () => {
    if (posCart.length === 0) return;
    const today = new Date().toISOString().slice(0, 10);
    const created = createSalesOrder({
      documentType: 'invoice',
      customerName: posCustomer.trim() || 'Walk-in Customer',
      issueDate: today,
      dueDate: today,
      status: 'paid',
      lines: posCart.map((c) => ({
        itemId: c.itemId,
        description: `${c.sku} · ${c.name}`,
        quantity: c.qty,
        unitPrice: c.unitPrice,
        taxRate: c.taxRate,
      })),
      notes: 'POS Counter Sale',
    });
    setPosCart([]);
    setPosReceiptMsg(
      `POS Sale ${created.documentNumber} completed (${formatNumericCurrency(created.grandTotal, currency, 2)}). Stock deducted & revenue posted to Accounting.`,
    );
  };

  const columns: DataColumn<IndustryOperationRecord>[] = [
    {
      key: 'ref',
      header: 'Reference',
      sortable: true,
      sortValue: (r) => r.reference,
      render: (r) => (
        <span className="font-mono text-xs font-semibold text-[#182238] dark:text-slate-100">
          {r.reference}
        </span>
      ),
    },
    {
      key: 'title',
      header: 'Operation & Details',
      sortable: true,
      sortValue: (r) => r.title,
      render: (r) => (
        <div>
          <div className="font-semibold text-[#182238] dark:text-slate-100">{r.title}</div>
          <div className="text-[11px] text-[#718096] dark:text-slate-400">
            {r.counterparty}
            {r.metadata ? ` · ${r.metadata}` : ''}
          </div>
        </div>
      ),
    },
    {
      key: 'qty',
      header: labels.qtyLabel,
      align: 'right',
      numeric: true,
      render: (r) => <span>{r.quantityOrUnits}</span>,
    },
    {
      key: 'amount',
      header: `${labels.amountLabel} (${currency})`,
      align: 'right',
      numeric: true,
      render: (r) => <span>{formatNumericCurrency(r.amount, currency, 2)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <select
          value={r.status}
          onChange={(e) =>
            updateIndustryRecordStatus(
              r.id,
              e.target.value as IndustryOperationRecord['status'],
            )
          }
          aria-label={`Status for ${r.reference}`}
          className="h-7 px-2 rounded-md text-xs bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257] cursor-pointer"
        >
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => (
        <button
          type="button"
          onClick={() => deleteIndustryRecord(r.id)}
          aria-label={`Delete ${r.reference}`}
          className="p-1.5 text-[#718096] hover:text-red-600 cursor-pointer"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#182238] dark:text-slate-100">
            {labels.heading}
          </h1>
          <p className="mt-1 text-xs text-[#718096] dark:text-slate-400 max-w-2xl">
            {labels.subtitle}
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4" />
          {showForm ? 'Close Form' : labels.createLabel}
        </Button>
      </div>

      {/* Live Quick POS Register for Retail & Ecommerce */}
      {moduleSlug === 'industry_retail' && (
        <Surface padding="lg" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-[#4169F5]" />
              <h2 className="text-sm font-semibold text-[#182238] dark:text-slate-100">
                Quick POS Checkout
              </h2>
            </div>
            <span className="text-[11px] text-[#718096] dark:text-slate-400">
              Completed sales deduct inventory and post revenue automatically
            </span>
          </div>

          {posReceiptMsg && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-[#16B8A6]/10 border border-[#16B8A6]/30 text-xs font-medium text-[#16B8A6]">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{posReceiptMsg}</span>
            </div>
          )}

          {data.catalogue.length === 0 ? (
            <p className="text-xs text-[#718096] dark:text-slate-400">
              Add items in Universal Catalogue first to ring up products on the POS counter.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <input
                  type="text"
                  value={posCustomer}
                  onChange={(e) => setPosCustomer(e.target.value)}
                  placeholder="Customer name (or Walk-in Customer)"
                  className="sm:col-span-4 h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
                />
                <select
                  value={posItemId}
                  onChange={(e) => setPosItemId(e.target.value)}
                  className="sm:col-span-5 h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
                >
                  <option value="">Select product / SKU...</option>
                  {data.catalogue.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.sku} · {c.name} ({formatNumericCurrency(c.sellingPrice, currency, 2)} · Stock: {c.stockOnHand})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  value={posQty}
                  onChange={(e) => setPosQty(e.target.value)}
                  aria-label="POS quantity"
                  className="sm:col-span-1 h-9 px-2.5 rounded-lg text-sm font-mono bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
                />
                <div className="sm:col-span-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!posItemId}
                    onClick={handleAddToPosCart}
                    className="w-full h-9"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add to Bill
                  </Button>
                </div>
              </div>

              {posCart.length > 0 && (
                <div className="rounded-lg border border-slate-200 dark:border-[#223257] overflow-hidden">
                  <div className="divide-y divide-slate-200/70 dark:divide-[#223257]">
                    {posCart.map((line) => (
                      <div
                        key={line.itemId}
                        className="px-3.5 py-2 flex items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <span className="font-semibold">{line.name}</span>
                          <span className="ml-2 font-mono text-[#718096]">
                            {line.qty} × {formatNumericCurrency(line.unitPrice, currency, 2)} (+{line.taxRate}% tax)
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-semibold tabular-nums">
                            {formatNumericCurrency(
                              line.qty * line.unitPrice * (1 + line.taxRate / 100),
                              currency,
                              2,
                            )}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setPosCart((prev) => prev.filter((x) => x.itemId !== line.itemId))
                            }
                            className="text-[#718096] hover:text-red-600 cursor-pointer"
                            aria-label={`Remove ${line.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="px-3.5 py-2.5 bg-[#F6F8FC] dark:bg-[#0E172E] border-t border-slate-200 dark:border-[#223257] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="text-xs font-mono tabular-nums space-x-4">
                      <span>Subtotal: {formatNumericCurrency(posTotals.subtotal, currency, 2)}</span>
                      <span>Tax: {formatNumericCurrency(posTotals.tax, currency, 2)}</span>
                      <span className="font-bold text-[#4169F5]">
                        Grand Total: {formatNumericCurrency(posTotals.total, currency, 2)}
                      </span>
                    </div>
                    <Button type="button" variant="primary" size="sm" onClick={handleCheckoutPos}>
                      Complete POS Sale
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </Surface>
      )}

      {showForm && (
        <Surface padding="lg">
          <form onSubmit={handleAddRecord} className="space-y-4">
            <h2 className="text-sm font-semibold text-[#182238] dark:text-slate-100">
              {labels.createLabel}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={labels.titlePlaceholder}
                className="lg:col-span-2 h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
              />
              <input
                type="text"
                value={counterparty}
                onChange={(e) => setCounterparty(e.target.value)}
                placeholder={labels.counterpartyPlaceholder}
                className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
              />
              <input
                type="number"
                step="0.01"
                value={quantityOrUnits}
                onChange={(e) => setQuantityOrUnits(e.target.value)}
                placeholder={labels.qtyLabel}
                className="h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
              />
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`${labels.amountLabel} (${currency})`}
                className="h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
              />
              <input
                type="text"
                value={metadata}
                onChange={(e) => setMetadata(e.target.value)}
                placeholder={labels.metaPlaceholder}
                className="lg:col-span-3 h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm">
                Save Record
              </Button>
            </div>
          </form>
        </Surface>
      )}

      <DataTable
        data={scopedRecords}
        columns={columns}
        getRowKey={(r) => r.id}
        searchPlaceholder="Search reference, title, or details..."
        searchPredicate={(r, q) =>
          `${r.reference} ${r.title} ${r.counterparty} ${r.metadata}`
            .toLowerCase()
            .includes(q)
        }
        emptyTitle={labels.emptyTitle}
        emptyDescription={labels.emptyDescription}
        emptyActionLabel={labels.createLabel}
        onEmptyAction={() => setShowForm(true)}
      />
    </div>
  );
}
