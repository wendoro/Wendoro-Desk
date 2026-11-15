import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardCheck,
  Factory,
  Plus,
  ScanBarcode,
  ShoppingCart,
  Trash2,
  Wrench,
} from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { DataColumn, DataTable } from '@/src/components/ui/DataTable';
import { Surface } from '@/src/components/ui/Surface';
import { useErpData } from '@/src/components/shell/ErpDataProvider';
import { useTenant } from '@/src/components/shell/TenantProvider';
import { WENDORO_MODULES } from '@/src/core/registry/modules';
import {
  BomComponent,
  IndustryOperationRecord,
  PaymentAllocation,
  QualityInspection,
} from '@/src/core/store/erpTypes';
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
    heading: 'Retail POS & E-Commerce',
    subtitle:
      'Manage cash register shifts, barcode POS checkouts, storefront orders, customer loyalty points, and promotions.',
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
      'Use the POS Register & Checkout above for instant sales or log promotions and store returns below.',
  },
  industry_manufacturing: {
    heading: 'Manufacturing, MRP, QMS & Maintenance',
    subtitle:
      'Manage Bills of Materials (BOM), shop-floor Work Orders with atomic inventory conversion, MRP shortages, quality inspections, and equipment maintenance.',
    createLabel: 'Log Shop-Floor Note',
    refPrefix: 'MFG',
    titlePlaceholder: 'Shop-floor log title *',
    counterpartyLabel: 'Work Center / Line',
    counterpartyPlaceholder: 'Assembly Line A / Floor 2',
    qtyLabel: 'Batch Qty',
    amountLabel: 'Est. Cost',
    metaPlaceholder: 'Routing notes or shift supervisor',
    emptyTitle: 'No custom shop-floor logs yet',
    emptyDescription: 'Use the BOM, Work Orders & MRP, QMS, or Maintenance tabs above for full production workflows.',
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
  const { activeCompany, principal } = useTenant();
  const {
    data,
    addIndustryRecord,
    updateIndustryRecordStatus,
    deleteIndustryRecord,
    createSalesOrder,
    openPosShift,
    closePosShift,
    addBom,
    createWorkOrder,
    completeWorkOrder,
    addQualityInspection,
    addMaintenanceSchedule,
    completeMaintenanceSchedule,
  } = useErpData();

  const currency = activeCompany.baseCurrency;
  const today = new Date().toISOString().slice(0, 10);
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

  // Generic Industry Form
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [quantityOrUnits, setQuantityOrUnits] = useState('1');
  const [amount, setAmount] = useState('0');
  const [metadata, setMetadata] = useState('');

  // Retail POS & Shift State
  const [shiftRegName, setShiftRegName] = useState('Counter 1');
  const [shiftOpeningCash, setShiftOpeningCash] = useState('500');
  const [closeCountedCash, setCloseCountedCash] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [posCustomerId, setPosCustomerId] = useState('');
  const [posCustomer, setPosCustomer] = useState('Walk-in Customer');
  const [posChannel, setPosChannel] = useState<'pos' | 'ecommerce'>('pos');
  const [posPaymentMethod, setPosPaymentMethod] = useState<PaymentAllocation['method']>('cash');
  const [posItemId, setPosItemId] = useState('');
  const [posQty, setPosQty] = useState('1');
  const [posCart, setPosCart] = useState<
    Array<{ itemId: string; name: string; sku: string; qty: number; unitPrice: number; taxRate: number }>
  >([]);
  const [posReceiptMsg, setPosReceiptMsg] = useState<string | null>(null);
  const [posError, setPosError] = useState<string | null>(null);

  // Manufacturing State
  const [mfgTab, setMfgTab] = useState<'work_orders' | 'boms' | 'qms' | 'maintenance'>('work_orders');
  const [bomFinishedId, setBomFinishedId] = useState('');
  const [bomCompId, setBomCompId] = useState('');
  const [bomCompQty, setBomCompQty] = useState('1');
  const [bomComponents, setBomComponents] = useState<BomComponent[]>([]);
  const [bomLabor, setBomLabor] = useState('25');
  const [bomOverhead, setBomOverhead] = useState('15');
  const [bomNotes, setBomNotes] = useState('');

  const [woBomId, setWoBomId] = useState('');
  const [woQty, setWoQty] = useState('5');
  const [woDueDate, setWoDueDate] = useState(today);
  const [mfgNotice, setMfgNotice] = useState<string | null>(null);
  const [mfgError, setMfgError] = useState<string | null>(null);

  // QMS State
  const [qcRef, setQcRef] = useState('');
  const [qcItemSku, setQcItemSku] = useState('');
  const [qcInspector, setQcInspector] = useState(principal.fullName);
  const [qcSample, setQcSample] = useState('10');
  const [qcDefects, setQcDefects] = useState('0');
  const [qcResult, setQcResult] = useState<QualityInspection['result']>('pass');
  const [qcNotes, setQcNotes] = useState('');

  // Maintenance State
  const [mntAsset, setMntAsset] = useState('');
  const [mntTask, setMntTask] = useState('');
  const [mntFreq, setMntFreq] = useState<'weekly' | 'monthly' | 'quarterly'>('monthly');
  const [mntDue, setMntDue] = useState(today);
  const [mntTech, setMntTech] = useState('');
  const [mntCost, setMntCost] = useState('0');

  const openShift = data.posShifts.find((s) => s.status === 'open') ?? null;

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

  const addItemToCart = (itemId: string, qtyVal: number) => {
    const item = data.catalogue.find((c) => c.id === itemId);
    if (!item) return;
    setPosCart((prev) => {
      const existing = prev.find((x) => x.itemId === item.id);
      if (existing) {
        return prev.map((x) =>
          x.itemId === item.id ? { ...x, qty: x.qty + qtyVal } : x,
        );
      }
      return [
        ...prev,
        {
          itemId: item.id,
          name: item.name,
          sku: item.sku,
          qty: qtyVal,
          unitPrice: item.sellingPrice,
          taxRate: item.taxRate,
        },
      ];
    });
    setPosReceiptMsg(null);
    setPosError(null);
  };

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = barcodeInput.trim().toLowerCase();
    if (!q) return;
    const match = data.catalogue.find(
      (c) => c.sku.toLowerCase() === q || c.name.toLowerCase().includes(q),
    );
    if (!match) {
      setPosError(`No SKU or product matching "${barcodeInput.trim()}".`);
      return;
    }
    addItemToCart(match.id, 1);
    setBarcodeInput('');
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
    setPosError(null);
    setPosReceiptMsg(null);
    try {
      const created = createSalesOrder({
        documentType: 'invoice',
        customerId: posCustomerId || undefined,
        customerName: posCustomer.trim() || 'Walk-in Customer',
        issueDate: today,
        dueDate: today,
        status: 'paid',
        isImmediatePosSale: true,
        paymentMethod: posPaymentMethod,
        channel: posChannel,
        lines: posCart.map((c) => ({
          itemId: c.itemId,
          description: `${c.sku} · ${c.name}`,
          quantity: c.qty,
          unitPrice: c.unitPrice,
          taxRate: c.taxRate,
        })),
        notes: `${posChannel === 'ecommerce' ? 'Web Storefront Order' : 'POS Counter Sale'} (${posPaymentMethod.toUpperCase()})`,
      });
      setPosCart([]);
      setPosReceiptMsg(
        `${posChannel === 'ecommerce' ? 'Storefront Order' : 'POS Sale'} ${created.documentNumber} completed (${formatNumericCurrency(created.grandTotal, currency, 2)} via ${posPaymentMethod.toUpperCase()}).`,
      );
    } catch (err) {
      setPosError(err instanceof Error ? err.message : 'POS checkout failed.');
    }
  };

  const handleAddBomComponent = () => {
    const item = data.catalogue.find((c) => c.id === bomCompId);
    if (!item) return;
    const qty = Math.max(0.01, Number(bomCompQty) || 1);
    setBomComponents((prev) => [
      ...prev.filter((x) => x.itemId !== item.id),
      {
        itemId: item.id,
        sku: item.sku,
        name: item.name,
        quantityPerUnit: qty,
        unitCost: item.costPrice,
      },
    ]);
    setBomCompId('');
    setBomCompQty('1');
  };

  const handleCreateBom = (e: React.FormEvent) => {
    e.preventDefault();
    setMfgError(null);
    setMfgNotice(null);
    const finished = data.catalogue.find((c) => c.id === bomFinishedId);
    if (!finished) {
      setMfgError('Select a finished good SKU.');
      return;
    }
    if (bomComponents.length === 0) {
      setMfgError('Add at least one raw material component to the BOM.');
      return;
    }
    const created = addBom({
      finishedItemId: finished.id,
      finishedSku: finished.sku,
      finishedName: finished.name,
      components: bomComponents,
      laborCostPerUnit: Math.max(0, Number(bomLabor) || 0),
      overheadCostPerUnit: Math.max(0, Number(bomOverhead) || 0),
      notes: bomNotes.trim(),
    });
    setBomComponents([]);
    setBomFinishedId('');
    setBomNotes('');
    setMfgNotice(`Created Bill of Materials ${created.bomCode} for ${created.finishedName}.`);
  };

  const handleCreateWorkOrder = (e: React.FormEvent) => {
    e.preventDefault();
    setMfgError(null);
    setMfgNotice(null);
    const targetBom = data.boms.find((b) => b.id === (woBomId || data.boms[0]?.id));
    if (!targetBom) {
      setMfgError('Create a Bill of Materials first.');
      return;
    }
    const wo = createWorkOrder({
      bomId: targetBom.id,
      finishedItemId: targetBom.finishedItemId,
      finishedSku: targetBom.finishedSku,
      finishedName: targetBom.finishedName,
      targetQty: Math.max(1, Number(woQty) || 1),
      startDate: today,
      dueDate: woDueDate,
    });
    setMfgNotice(`Scheduled Work Order ${wo.woNumber}.`);
  };

  const handleCompleteWorkOrder = (woId: string) => {
    setMfgError(null);
    setMfgNotice(null);
    try {
      const done = completeWorkOrder(woId, today);
      setMfgNotice(
        `Completed ${done.woNumber}: produced ${done.completedQty} × ${done.finishedSku} & capitalized material + conversion costs.`,
      );
    } catch (err) {
      setMfgError(err instanceof Error ? err.message : 'Unable to complete Work Order.');
    }
  };

  const handleAddQc = (e: React.FormEvent) => {
    e.preventDefault();
    if (!qcItemSku.trim()) return;
    addQualityInspection({
      referenceNumber: qcRef.trim() || 'LOT-INSP',
      itemSku: qcItemSku.trim(),
      itemName: data.catalogue.find((c) => c.sku === qcItemSku.trim())?.name ?? qcItemSku.trim(),
      inspectorName: qcInspector.trim() || principal.fullName,
      sampleSize: Math.max(1, Number(qcSample) || 1),
      defectCount: Math.max(0, Number(qcDefects) || 0),
      result: qcResult,
      notes: qcNotes.trim(),
    });
    setQcRef('');
    setQcNotes('');
    setMfgNotice('Logged Quality Inspection.');
  };

  const handleAddMaintenance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mntAsset.trim() || !mntTask.trim()) return;
    addMaintenanceSchedule({
      assetOrMachine: mntAsset.trim(),
      taskTitle: mntTask.trim(),
      frequency: mntFreq,
      nextDueDate: mntDue,
      technician: mntTech.trim() || 'Maintenance Crew',
      estimatedCost: Math.max(0, Number(mntCost) || 0),
      status: 'scheduled',
    });
    setMntAsset('');
    setMntTask('');
    setMfgNotice('Scheduled preventive equipment maintenance.');
  };

  const columns: DataColumn<IndustryOperationRecord>[] = [
    {
      key: 'ref',
      header: 'Reference',
      sortable: true,
      sortValue: (r) => r.reference,
      render: (r) => (
        <span className="font-mono text-xs font-semibold text-[#1C1917] dark:text-slate-100">
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
          <div className="font-semibold text-[#1C1917] dark:text-slate-100">{r.title}</div>
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
          className="h-7 px-2 rounded-md text-xs bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A] cursor-pointer"
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
          <h1 className="text-2xl font-bold tracking-tight text-[#1C1917] dark:text-slate-100">
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

      {/* RETAIL POS REGISTER & SHIFTS */}
      {moduleSlug === 'industry_retail' && (
        <div className="space-y-4">
          {/* Register Shift Strip */}
          <Surface padding="md">
            {openShift ? (
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-0.5 text-xs">
                  <div className="font-semibold text-[#16B8A6]">
                    Active Register Shift: {openShift.shiftNumber} · {openShift.registerName}
                  </div>
                  <div className="font-mono tabular-nums text-[#718096] dark:text-slate-300">
                    Cashier: {openShift.cashierName} · Opening:{' '}
                    {formatNumericCurrency(openShift.openingCash, currency, 2)} · Cash Sales:{' '}
                    {formatNumericCurrency(openShift.cashSalesTotal, currency, 2)} · Card/UPI:{' '}
                    {formatNumericCurrency(openShift.cardUpiSalesTotal, currency, 2)} · Expected Cash:{' '}
                    <strong className="text-[#1C1917] dark:text-slate-100">
                      {formatNumericCurrency(openShift.expectedCash, currency, 2)}
                    </strong>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <input
                    type="number"
                    step="0.01"
                    value={closeCountedCash}
                    onChange={(e) => setCloseCountedCash(e.target.value)}
                    placeholder={`Counted Cash (${openShift.expectedCash})`}
                    className="w-44 h-8 px-2.5 rounded-md text-xs font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const closed = closePosShift(
                        openShift.id,
                        closeCountedCash === '' ? openShift.expectedCash : Number(closeCountedCash),
                      );
                      setCloseCountedCash('');
                      setPosReceiptMsg(
                        `Closed ${closed.shiftNumber}. Cash Variance: ${formatNumericCurrency(closed.variance ?? 0, currency, 2)}.`,
                      );
                    }}
                  >
                    Close Shift
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs text-[#718096] dark:text-slate-400">
                  No active cash register shift open. Open a shift to track drawer float and cash/card reconciliation.
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={shiftRegName}
                    onChange={(e) => setShiftRegName(e.target.value)}
                    placeholder="Register Name"
                    className="w-32 h-8 px-2.5 rounded-md text-xs bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={shiftOpeningCash}
                    onChange={(e) => setShiftOpeningCash(e.target.value)}
                    placeholder="Float"
                    className="w-24 h-8 px-2.5 rounded-md text-xs font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                  />
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() =>
                      openPosShift({
                        registerName: shiftRegName,
                        cashierName: principal.fullName,
                        openingCash: Number(shiftOpeningCash) || 0,
                      })
                    }
                  >
                    Open POS Shift
                  </Button>
                </div>
              </div>
            )}
          </Surface>

          {/* POS Terminal */}
          <Surface padding="lg" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-[#DC2626]" />
                <h2 className="text-sm font-semibold text-[#1C1917] dark:text-slate-100">
                  Quick POS & Storefront Checkout
                </h2>
              </div>
              <div className="inline-flex items-center gap-1 p-0.5 rounded-lg bg-slate-200/70 dark:bg-[#251B20] text-xs">
                <button
                  type="button"
                  onClick={() => setPosChannel('pos')}
                  className={`px-2.5 py-1 rounded-md cursor-pointer ${
                    posChannel === 'pos' ? 'bg-white dark:bg-[#1B1417] font-semibold' : 'text-[#718096]'
                  }`}
                >
                  In-Store POS
                </button>
                <button
                  type="button"
                  onClick={() => setPosChannel('ecommerce')}
                  className={`px-2.5 py-1 rounded-md cursor-pointer ${
                    posChannel === 'ecommerce' ? 'bg-white dark:bg-[#1B1417] font-semibold' : 'text-[#718096]'
                  }`}
                >
                  E-Commerce Order
                </button>
              </div>
            </div>

            {posError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs font-medium text-red-600 dark:text-red-400">
                {posError}
              </div>
            )}
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
                {/* Barcode / SKU Scanner Bar */}
                <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
                  <div className="relative flex-1">
                    <ScanBarcode className="h-4 w-4 text-[#718096] absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={barcodeInput}
                      onChange={(e) => setBarcodeInput(e.target.value)}
                      placeholder="Scan Barcode or type SKU & press Enter to add to cart..."
                      className="w-full h-9 pl-9 pr-3 rounded-lg text-sm font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                    />
                  </div>
                  <Button type="submit" variant="outline" size="sm">
                    Scan Add
                  </Button>
                </form>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <select
                    value={posCustomerId}
                    onChange={(e) => {
                      const cid = e.target.value;
                      setPosCustomerId(cid);
                      const found = data.contacts.find((c) => c.id === cid);
                      setPosCustomer(found ? found.name : 'Walk-in Customer');
                    }}
                    className="sm:col-span-3 h-9 px-3 rounded-lg text-xs bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                  >
                    <option value="">Walk-in Customer</option>
                    {data.contacts
                      .filter((c) => c.type === 'customer' || c.type === 'both')
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.loyaltyPoints ?? 0} pts)
                        </option>
                      ))}
                  </select>
                  <select
                    value={posItemId}
                    onChange={(e) => setPosItemId(e.target.value)}
                    className="sm:col-span-5 h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
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
                    className="sm:col-span-1 h-9 px-2.5 rounded-lg text-sm font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                  />
                  <select
                    value={posPaymentMethod}
                    onChange={(e) => setPosPaymentMethod(e.target.value as PaymentAllocation['method'])}
                    className="sm:col-span-1 h-9 px-2 rounded-lg text-xs bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                  >
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="upi">UPI</option>
                    <option value="bank">Bank</option>
                  </select>
                  <div className="sm:col-span-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!posItemId}
                      onClick={() => {
                        addItemToCart(posItemId, Math.max(1, Number(posQty) || 1));
                        setPosQty('1');
                      }}
                      className="w-full h-9"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add to Bill
                    </Button>
                  </div>
                </div>

                {posCart.length > 0 && (
                  <div className="rounded-lg border border-slate-200 dark:border-[#32242A] overflow-hidden">
                    <div className="divide-y divide-slate-200/70 dark:divide-[#32242A]">
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
                    <div className="px-3.5 py-2.5 bg-[#FAF9F7] dark:bg-[#141013] border-t border-slate-200 dark:border-[#32242A] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="text-xs font-mono tabular-nums space-x-4">
                        <span>Subtotal: {formatNumericCurrency(posTotals.subtotal, currency, 2)}</span>
                        <span>Tax: {formatNumericCurrency(posTotals.tax, currency, 2)}</span>
                        <span className="font-bold text-[#DC2626]">
                          Grand Total: {formatNumericCurrency(posTotals.total, currency, 2)}
                        </span>
                      </div>
                      <Button type="button" variant="primary" size="sm" onClick={handleCheckoutPos}>
                        Complete {posChannel === 'ecommerce' ? 'Web Order' : 'POS Sale'} ({posPaymentMethod.toUpperCase()})
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Surface>
        </div>
      )}

      {/* MANUFACTURING SUITE (BOM, Work Orders & MRP, QMS, Maintenance) */}
      {moduleSlug === 'industry_manufacturing' && (
        <div className="space-y-4">
          <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-[#251B20]">
            {(
              [
                { id: 'work_orders', label: `Work Orders & MRP (${data.workOrders.length})` },
                { id: 'boms', label: `Bills of Materials (${data.boms.length})` },
                { id: 'qms', label: `Quality QMS (${data.qualityInspections.length})` },
                { id: 'maintenance', label: `Maintenance (${data.maintenanceSchedules.length})` },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setMfgTab(t.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                  mfgTab === t.id
                    ? 'bg-white dark:bg-[#1B1417] text-[#1C1917] dark:text-slate-100 shadow-xs'
                    : 'text-[#718096] dark:text-slate-400'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {mfgError && (
            <Surface padding="sm" className="text-xs font-medium text-red-600 dark:text-red-400">
              {mfgError}
            </Surface>
          )}
          {mfgNotice && (
            <Surface padding="sm" className="text-xs font-medium text-[#16B8A6]">
              {mfgNotice}
            </Surface>
          )}

          {mfgTab === 'boms' && (
            <div className="space-y-4">
              <Surface padding="lg">
                <form onSubmit={handleCreateBom} className="space-y-4">
                  <h2 className="text-sm font-semibold flex items-center gap-2">
                    <Factory className="h-4 w-4 text-[#DC2626]" />
                    Define Bill of Materials (BOM)
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <select
                      value={bomFinishedId}
                      onChange={(e) => setBomFinishedId(e.target.value)}
                      className="sm:col-span-2 h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                    >
                      <option value="">Select Finished Product SKU...</option>
                      {data.catalogue.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.sku} · {c.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      value={bomLabor}
                      onChange={(e) => setBomLabor(e.target.value)}
                      placeholder="Labor / Unit"
                      title="Labor Cost per Unit"
                      className="h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={bomOverhead}
                      onChange={(e) => setBomOverhead(e.target.value)}
                      placeholder="Overhead / Unit"
                      title="Overhead Cost per Unit"
                      className="h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={bomCompId}
                      onChange={(e) => setBomCompId(e.target.value)}
                      className="flex-1 min-w-[200px] h-9 px-3 rounded-lg text-xs bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                    >
                      <option value="">Pick Raw Material / Component...</option>
                      {data.catalogue
                        .filter((c) => c.id !== bomFinishedId)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.sku} · {c.name} (Stock: {c.stockOnHand} · Cost: {c.costPrice})
                          </option>
                        ))}
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      value={bomCompQty}
                      onChange={(e) => setBomCompQty(e.target.value)}
                      placeholder="Qty/Unit"
                      className="w-24 h-9 px-2.5 rounded-lg text-xs font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                    />
                    <Button type="button" variant="outline" size="sm" onClick={handleAddBomComponent}>
                      Add Component
                    </Button>
                  </div>
                  {bomComponents.length > 0 && (
                    <div className="text-xs divide-y divide-slate-200/70 dark:divide-[#32242A] border border-slate-200 dark:border-[#32242A] rounded-lg px-3">
                      {bomComponents.map((c) => (
                        <div key={c.itemId} className="py-2 flex justify-between font-mono">
                          <span>{c.sku} · {c.name}</span>
                          <span>{c.quantityPerUnit} × {formatNumericCurrency(c.unitCost, currency, 2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex justify-end">
                    <Button type="submit" variant="primary" size="sm">
                      Save BOM Recipe
                    </Button>
                  </div>
                </form>
              </Surface>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.boms.map((b) => (
                  <Surface key={b.id} className="space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-mono text-xs text-[#DC2626] font-semibold">{b.bomCode}</div>
                        <div className="text-sm font-bold">{b.finishedSku} · {b.finishedName}</div>
                      </div>
                      <div className="text-right font-mono text-xs text-[#718096]">
                        Conv: {formatNumericCurrency(b.laborCostPerUnit + b.overheadCostPerUnit, currency, 2)}/u
                      </div>
                    </div>
                    <div className="text-xs space-y-1 pt-1 border-t border-slate-200/70 dark:divide-[#32242A]">
                      {b.components.map((c) => (
                        <div key={c.itemId} className="flex justify-between font-mono text-[11px]">
                          <span>{c.sku} · {c.name}</span>
                          <span>{c.quantityPerUnit} / unit</span>
                        </div>
                      ))}
                    </div>
                  </Surface>
                ))}
              </div>
            </div>
          )}

          {mfgTab === 'work_orders' && (
            <div className="space-y-4">
              <Surface padding="lg">
                <form onSubmit={handleCreateWorkOrder} className="space-y-4">
                  <h2 className="text-sm font-semibold">Schedule Production Work Order</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-center">
                    <select
                      value={woBomId || data.boms[0]?.id || ''}
                      onChange={(e) => setWoBomId(e.target.value)}
                      className="sm:col-span-2 h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                    >
                      {data.boms.length === 0 ? (
                        <option value="">Create a BOM in the Bills of Materials tab first...</option>
                      ) : (
                        data.boms.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.bomCode} · {b.finishedName}
                          </option>
                        ))
                      )}
                    </select>
                    <input
                      type="number"
                      min="1"
                      value={woQty}
                      onChange={(e) => setWoQty(e.target.value)}
                      placeholder="Target Qty"
                      className="h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                    />
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={woDueDate}
                        onChange={(e) => setWoDueDate(e.target.value)}
                        className="w-full h-9 px-2 rounded-lg text-xs font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                      />
                      <Button type="submit" variant="primary" size="sm" disabled={data.boms.length === 0}>
                        Create WO
                      </Button>
                    </div>
                  </div>
                </form>
              </Surface>

              <Surface padding="none" className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#EFF3FA]/70 dark:bg-[#251B20] text-[#718096] border-b border-slate-200 dark:border-[#32242A]">
                    <tr>
                      <th className="px-4 py-3">Work Order</th>
                      <th className="px-4 py-3">Finished Product</th>
                      <th className="px-4 py-3">MRP Material Readiness</th>
                      <th className="px-4 py-3 text-right">Qty / Cost</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70 dark:divide-[#32242A]">
                    {data.workOrders.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-[#718096]">
                          No work orders scheduled yet.
                        </td>
                      </tr>
                    ) : (
                      data.workOrders.map((wo) => {
                        const bom = data.boms.find((b) => b.id === wo.bomId);
                        const shortages = (bom?.components ?? []).filter((comp) => {
                          const cat = data.catalogue.find((i) => i.id === comp.itemId);
                          const avail = (cat?.stockOnHand ?? 0) - (cat?.reservedQty ?? 0);
                          return avail < comp.quantityPerUnit * wo.targetQty;
                        });
                        return (
                          <tr key={wo.id}>
                            <td className="px-4 py-3 font-mono font-semibold">
                              <div>{wo.woNumber}</div>
                              <div className="text-[11px] text-[#718096]">Due: {wo.dueDate}</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-semibold">{wo.finishedName}</div>
                              <div className="font-mono text-[11px] text-[#718096]">{wo.finishedSku}</div>
                            </td>
                            <td className="px-4 py-3">
                              {wo.status === 'completed' ? (
                                <span className="text-[#16B8A6] font-semibold">Materials Consumed & Built</span>
                              ) : shortages.length === 0 ? (
                                <span className="text-[#16B8A6] font-semibold">MRP Ready (All Stock Avail)</span>
                              ) : (
                                <span className="text-amber-600 dark:text-amber-400 font-semibold">
                                  Shortage: {shortages.map((s) => s.sku).join(', ')}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-mono tabular-nums">
                              <div>{wo.targetQty} units</div>
                              {wo.status === 'completed' && (
                                <div className="text-[11px] text-[#718096]">
                                  Cost: {formatNumericCurrency(wo.totalMaterialCost + wo.totalConversionCost, currency, 2)}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {wo.status !== 'completed' ? (
                                <Button
                                  type="button"
                                  variant="primary"
                                  size="sm"
                                  onClick={() => handleCompleteWorkOrder(wo.id)}
                                >
                                  Complete Production
                                </Button>
                              ) : (
                                <span className="text-xs font-semibold text-[#16B8A6]">Completed</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </Surface>
            </div>
          )}

          {mfgTab === 'qms' && (
            <div className="space-y-4">
              <Surface padding="lg">
                <form onSubmit={handleAddQc} className="space-y-3">
                  <h2 className="text-sm font-semibold flex items-center gap-2">
                    <ClipboardCheck className="h-4 w-4 text-[#16B8A6]" />
                    Record Quality Inspection (QMS)
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                    <input
                      type="text"
                      value={qcRef}
                      onChange={(e) => setQcRef(e.target.value)}
                      placeholder="WO / GRN Ref"
                      className="h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                    />
                    <input
                      type="text"
                      required
                      value={qcItemSku}
                      onChange={(e) => setQcItemSku(e.target.value)}
                      placeholder="Item SKU *"
                      className="h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                    />
                    <input
                      type="text"
                      value={qcInspector}
                      onChange={(e) => setQcInspector(e.target.value)}
                      placeholder="Inspector"
                      className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                    />
                    <input
                      type="number"
                      min="1"
                      value={qcSample}
                      onChange={(e) => setQcSample(e.target.value)}
                      placeholder="Sample"
                      className="h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                    />
                    <input
                      type="number"
                      min="0"
                      value={qcDefects}
                      onChange={(e) => setQcDefects(e.target.value)}
                      placeholder="Defects"
                      className="h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                    />
                    <select
                      value={qcResult}
                      onChange={(e) => setQcResult(e.target.value as QualityInspection['result'])}
                      className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                    >
                      <option value="pass">Pass</option>
                      <option value="hold">Hold</option>
                      <option value="fail">Fail</option>
                    </select>
                  </div>
                  <div className="flex justify-between gap-3">
                    <input
                      type="text"
                      value={qcNotes}
                      onChange={(e) => setQcNotes(e.target.value)}
                      placeholder="Inspection notes / tolerance check"
                      className="flex-1 h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                    />
                    <Button type="submit" variant="primary" size="sm">
                      Save QC Check
                    </Button>
                  </div>
                </form>
              </Surface>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data.qualityInspections.map((q) => (
                  <Surface key={q.id} className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-mono text-xs font-semibold">
                        {q.inspectionNumber} · {q.itemSku} ({q.referenceNumber})
                      </div>
                      <div className="text-xs text-[#718096]">
                        Inspector: {q.inspectorName} · Sample: {q.sampleSize} · Defects: {q.defectCount}
                      </div>
                    </div>
                    <span
                      className={`text-xs font-bold uppercase ${
                        q.result === 'pass'
                          ? 'text-[#16B8A6]'
                          : q.result === 'fail'
                            ? 'text-red-600'
                            : 'text-amber-600'
                      }`}
                    >
                      {q.result}
                    </span>
                  </Surface>
                ))}
              </div>
            </div>
          )}

          {mfgTab === 'maintenance' && (
            <div className="space-y-4">
              <Surface padding="lg">
                <form onSubmit={handleAddMaintenance} className="space-y-3">
                  <h2 className="text-sm font-semibold flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-[#DC2626]" />
                    Preventive Equipment Maintenance Schedule
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                    <input
                      type="text"
                      required
                      value={mntAsset}
                      onChange={(e) => setMntAsset(e.target.value)}
                      placeholder="Machine / Asset *"
                      className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                    />
                    <input
                      type="text"
                      required
                      value={mntTask}
                      onChange={(e) => setMntTask(e.target.value)}
                      placeholder="Service Task *"
                      className="lg:col-span-2 h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                    />
                    <select
                      value={mntFreq}
                      onChange={(e) => setMntFreq(e.target.value as typeof mntFreq)}
                      className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                    >
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                    </select>
                    <input
                      type="date"
                      value={mntDue}
                      onChange={(e) => setMntDue(e.target.value)}
                      className="h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                    />
                    <Button type="submit" variant="primary" size="sm">
                      Schedule
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={mntTech}
                      onChange={(e) => setMntTech(e.target.value)}
                      placeholder="Assigned Technician"
                      className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={mntCost}
                      onChange={(e) => setMntCost(e.target.value)}
                      placeholder={`Estimated Service Cost (${currency})`}
                      className="h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                    />
                  </div>
                </form>
              </Surface>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data.maintenanceSchedules.map((m) => (
                  <Surface key={m.id} className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">
                        {m.assetOrMachine} — {m.taskTitle}
                      </div>
                      <div className="text-xs text-[#718096]">
                        Due {m.nextDueDate} · {m.frequency} · Tech: {m.technician}
                      </div>
                    </div>
                    {m.status === 'scheduled' ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => completeMaintenanceSchedule(m.id)}
                      >
                        Mark Done
                      </Button>
                    ) : (
                      <span className="text-xs font-semibold text-[#16B8A6]">Completed</span>
                    )}
                  </Surface>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <Surface padding="lg">
          <form onSubmit={handleAddRecord} className="space-y-4">
            <h2 className="text-sm font-semibold text-[#1C1917] dark:text-slate-100">
              {labels.createLabel}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={labels.titlePlaceholder}
                className="lg:col-span-2 h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
              />
              <input
                type="text"
                value={counterparty}
                onChange={(e) => setCounterparty(e.target.value)}
                placeholder={labels.counterpartyPlaceholder}
                className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
              />
              <input
                type="number"
                step="0.01"
                value={quantityOrUnits}
                onChange={(e) => setQuantityOrUnits(e.target.value)}
                placeholder={labels.qtyLabel}
                className="h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
              />
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`${labels.amountLabel} (${currency})`}
                className="h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
              />
              <input
                type="text"
                value={metadata}
                onChange={(e) => setMetadata(e.target.value)}
                placeholder={labels.metaPlaceholder}
                className="lg:col-span-3 h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
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
