import React, { useMemo, useState } from 'react';
import {
  Banknote,
  CheckCircle2,
  FileMinus2,
  PackageCheck,
  Plus,
  Printer,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { DataColumn, DataTable } from '@/src/components/ui/DataTable';
import { Surface } from '@/src/components/ui/Surface';
import { DonutChart, GroupedBarChart } from '@/src/components/charts/ErpCharts';
import { useErpData } from '@/src/components/shell/ErpDataProvider';
import { useTenant } from '@/src/components/shell/TenantProvider';
import {
  CreditNote,
  PurchaseOrder,
  PurchaseRequisition,
  PurchaseStatus,
  SalesOrder,
  SalesStatus,
} from '@/src/core/store/erpTypes';
import { formatNumericCurrency } from '@/src/lib/utils';

interface DraftLine {
  key: string;
  itemId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discountRate: string;
  taxRate: string;
}

function emptyDraftLine(): DraftLine {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    itemId: '',
    description: '',
    quantity: '1',
    unitPrice: '0',
    discountRate: '0',
    taxRate: '18',
  };
}

export function SalesPurchaseView({ mode }: { mode: 'sales' | 'purchase' }) {
  const { activeCompany, principal } = useTenant();
  const {
    data,
    createSalesOrder,
    updateSalesStatus,
    dispatchSalesOrder,
    recordSalesPayment,
    createCreditNote,
    deleteSalesOrder,
    createPurchaseOrder,
    approvePurchaseOrder,
    receivePurchaseOrder,
    recordPurchasePayment,
    deletePurchaseOrder,
    addPurchaseRequisition,
    updateRequisitionStatus,
    convertRequisitionToPo,
  } = useErpData();

  const isSales = mode === 'sales';
  const currency = activeCompany.baseCurrency;
  const today = new Date().toISOString().slice(0, 10);

  const [subTab, setSubTab] = useState<'primary' | 'secondary'>('primary');
  const [showForm, setShowForm] = useState(false);
  const [documentType, setDocumentType] = useState<'invoice' | 'quote'>('invoice');
  const [counterpartyName, setCounterpartyName] = useState('');
  const [selectedContactId, setSelectedContactId] = useState('');
  const [issueDate, setIssueDate] = useState(today);
  const [dueDate, setDueDate] = useState(today);
  const [initialStatus, setInitialStatus] = useState<'draft' | 'sent' | 'paid' | 'ordered' | 'received'>(
    isSales ? 'sent' : 'ordered',
  );
  const [salesperson, setSalesperson] = useState(principal.fullName);
  const [commissionRate, setCommissionRate] = useState('0');
  const [channel, setChannel] = useState<'direct' | 'pos' | 'ecommerce'>('direct');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringInterval, setRecurringInterval] = useState<'monthly' | 'quarterly' | 'annual'>('monthly');
  const [isDropShip, setIsDropShip] = useState(false);
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([emptyDraftLine()]);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [previewOrder, setPreviewOrder] = useState<SalesOrder | PurchaseOrder | null>(null);

  // Credit Note Modal State
  const [creditTarget, setCreditTarget] = useState<SalesOrder | null>(null);
  const [creditReason, setCreditReason] = useState('Customer return / billing adjustment');
  const [creditRestoreStock, setCreditRestoreStock] = useState(true);

  // Requisition Form State (Purchase secondary tab)
  const [reqBy, setReqBy] = useState(principal.fullName);
  const [reqDept, setReqDept] = useState('Operations');
  const [reqItemId, setReqItemId] = useState('');
  const [reqDesc, setReqDesc] = useState('');
  const [reqQty, setReqQty] = useState('5');
  const [reqCost, setReqCost] = useState('0');
  const [reqVendor, setReqVendor] = useState('');
  const [reqNotes, setReqNotes] = useState('');

  const contactsPool = useMemo(() => {
    return data.contacts.filter((c) =>
      isSales ? c.type === 'customer' || c.type === 'both' : c.type === 'vendor' || c.type === 'both',
    );
  }, [data.contacts, isSales]);

  const draftTotals = useMemo(() => {
    let subtotal = 0;
    let taxTotal = 0;
    lines.forEach((l) => {
      const qty = Math.max(0, Number(l.quantity) || 0);
      const price = Math.max(0, Number(l.unitPrice) || 0);
      const disc = Math.max(0, Math.min(100, Number(l.discountRate) || 0));
      const rate = Math.max(0, Number(l.taxRate) || 0);
      const base = qty * price * (1 - disc / 100);
      subtotal += base;
      taxTotal += (base * rate) / 100;
    });
    return { subtotal, taxTotal, grandTotal: subtotal + taxTotal };
  }, [lines]);

  const totalSalesCommissions = useMemo(() => {
    return data.salesOrders
      .filter((o) => o.documentType === 'invoice' && o.status !== 'cancelled' && (o.commissionRate ?? 0) > 0)
      .reduce((s, o) => s + (o.subtotal * (o.commissionRate ?? 0)) / 100, 0);
  }, [data.salesOrders]);

  const handleSelectCatalogueItem = (lineKey: string, itemId: string) => {
    const item = data.catalogue.find((c) => c.id === itemId);
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== lineKey) return l;
        if (!item) return { ...l, itemId: '' };
        return {
          ...l,
          itemId: item.id,
          description: item.name,
          unitPrice: String(isSales ? item.sellingPrice : item.costPrice),
          taxRate: String(item.taxRate),
        };
      }),
    );
  };

  const handleContactSelect = (contactId: string) => {
    setSelectedContactId(contactId);
    const contact = contactsPool.find((c) => c.id === contactId);
    if (contact) {
      setCounterpartyName(contact.organization || contact.name);
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setActionError(null);
    setActionNotice(null);

    if (!counterpartyName.trim()) {
      setFormError(`${isSales ? 'Customer' : 'Vendor'} name is required.`);
      return;
    }
    const parsedLines = lines
      .filter((l) => l.description.trim() && Number(l.quantity) > 0)
      .map((l) => ({
        itemId: l.itemId || undefined,
        description: l.description.trim(),
        quantity: Math.max(0.01, Number(l.quantity) || 1),
        unitPrice: Math.max(0, Number(l.unitPrice) || 0),
        discountRate: Math.max(0, Math.min(100, Number(l.discountRate) || 0)),
        taxRate: Math.max(0, Number(l.taxRate) || 0),
      }));

    if (parsedLines.length === 0) {
      setFormError('Add at least one valid line item with description and quantity.');
      return;
    }

    try {
      if (isSales) {
        const created = createSalesOrder({
          documentType,
          customerId: selectedContactId || undefined,
          customerName: counterpartyName.trim(),
          issueDate,
          dueDate,
          status: (['draft', 'sent', 'paid'].includes(initialStatus)
            ? initialStatus
            : 'sent') as SalesStatus,
          lines: parsedLines,
          notes,
          salesperson: salesperson.trim() || undefined,
          commissionRate: Math.max(0, Number(commissionRate) || 0),
          channel,
          isRecurring,
          recurringInterval: isRecurring ? recurringInterval : undefined,
          isDropShip,
        });
        setActionNotice(`Created ${created.documentNumber} (${created.status}).`);
      } else {
        const created = createPurchaseOrder({
          vendorId: selectedContactId || undefined,
          vendorName: counterpartyName.trim(),
          orderDate: issueDate,
          expectedDate: dueDate,
          status: (['draft', 'ordered', 'received'].includes(initialStatus)
            ? initialStatus
            : 'ordered') as PurchaseStatus,
          lines: parsedLines,
          notes,
        });
        setActionNotice(
          created.requiresApproval
            ? `Created ${created.documentNumber} held in DRAFT by an active Approval Rule.`
            : `Created ${created.documentNumber} (${created.status}).`,
        );
      }

      setCounterpartyName('');
      setSelectedContactId('');
      setNotes('');
      setLines([emptyDraftLine()]);
      setShowForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save order.');
    }
  };

  const runAction = (fn: () => void, successMsg?: string) => {
    setActionError(null);
    setActionNotice(null);
    try {
      fn();
      if (successMsg) setActionNotice(successMsg);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Operation failed.');
    }
  };

  const handleIssueCreditNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!creditTarget) return;
    runAction(() => {
      const cn = createCreditNote({
        salesOrderId: creditTarget.id,
        issueDate: today,
        reason: creditReason.trim() || 'Sales return',
        restoreStock: creditRestoreStock,
      });
      setCreditTarget(null);
      setActionNotice(`Issued Credit Note ${cn.creditNumber} reversing ${cn.invoiceNumber}.`);
    });
  };

  const handleCreateRequisition = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqDesc.trim()) return;
    addPurchaseRequisition({
      requestedBy: reqBy.trim() || principal.fullName,
      department: reqDept.trim() || 'Operations',
      itemId: reqItemId || undefined,
      itemDescription: reqDesc.trim(),
      quantity: Math.max(1, Number(reqQty) || 1),
      estimatedUnitCost: Math.max(0, Number(reqCost) || 0),
      vendorName: reqVendor.trim() || undefined,
      notes: reqNotes.trim(),
    });
    setReqDesc('');
    setReqItemId('');
    setReqVendor('');
    setReqNotes('');
    setActionNotice('Purchase requisition submitted.');
  };

  const salesColumns: DataColumn<SalesOrder>[] = [
    {
      key: 'doc',
      header: 'Document',
      sortable: true,
      sortValue: (r) => r.documentNumber,
      render: (r) => (
        <div>
          <div className="font-mono text-xs font-semibold text-[#1C1917] dark:text-slate-100">
            {r.documentNumber}
          </div>
          <div className="text-[11px] text-[#718096] dark:text-slate-400 capitalize">
            {r.documentType} · {r.channel ?? 'direct'} · {r.issueDate}
            {r.isRecurring ? ` · Recurring (${r.recurringInterval})` : ''}
            {r.isDropShip ? ' · Drop-Ship' : ''}
          </div>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer & Rep',
      sortable: true,
      sortValue: (r) => r.customerName,
      render: (r) => (
        <div>
          <div className="font-medium">{r.customerName}</div>
          {r.salesperson && (
            <div className="text-[11px] text-[#718096] dark:text-slate-400">
              Rep: {r.salesperson}
              {(r.commissionRate ?? 0) > 0 ? ` (${r.commissionRate}%)` : ''}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Billing & Fulfillment',
      render: (r) => (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={r.status}
            onChange={(e) =>
              runAction(() => updateSalesStatus(r.id, e.target.value as SalesStatus))
            }
            aria-label={`Status for ${r.documentNumber}`}
            className="h-7 px-2 rounded-md text-xs bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A] capitalize cursor-pointer"
          >
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="paid">Paid</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <span
            className={`text-[11px] font-medium capitalize ${
              r.fulfillmentStatus === 'dispatched'
                ? 'text-[#16B8A6]'
                : r.fulfillmentStatus === 'reserved'
                  ? 'text-[#DC2626]'
                  : 'text-[#718096] dark:text-slate-400'
            }`}
          >
            {r.fulfillmentStatus === 'dispatched'
              ? `Dispatched (${r.dispatchRef ?? 'DN'})`
              : r.fulfillmentStatus === 'reserved'
                ? 'Stock Reserved'
                : r.ledgerPosted
                  ? 'GL Posted'
                  : 'Pending'}
          </span>
        </div>
      ),
    },
    {
      key: 'total',
      header: 'Total & Paid',
      align: 'right',
      numeric: true,
      sortable: true,
      sortValue: (r) => r.grandTotal,
      render: (r) => (
        <div>
          <div className="font-semibold">
            {formatNumericCurrency(r.grandTotal, currency, 2)}
          </div>
          <div className="text-[11px] text-[#718096] dark:text-slate-400">
            Paid: {formatNumericCurrency(r.amountPaid, currency, 2)} · Tax:{' '}
            {formatNumericCurrency(r.taxTotal, currency, 2)}
          </div>
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => {
        const canDispatch =
          r.documentType === 'invoice' &&
          r.status !== 'cancelled' &&
          r.fulfillmentStatus !== 'dispatched' &&
          r.lines.some((l) => Boolean(l.itemId));
        const remaining = r.grandTotal - r.amountPaid;
        const canCollect =
          r.documentType === 'invoice' &&
          r.status !== 'cancelled' &&
          remaining > 0.005;
        const canCredit = r.ledgerPosted && r.status !== 'cancelled';

        return (
          <div className="inline-flex items-center gap-1">
            {canDispatch && (
              <button
                type="button"
                onClick={() =>
                  runAction(
                    () => dispatchSalesOrder(r.id, today),
                    `Dispatched goods and posted COGS for ${r.documentNumber}.`,
                  )
                }
                title="Dispatch goods & deduct physical stock"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-[#DC2626] hover:bg-[#DC2626]/10 cursor-pointer"
              >
                <Truck className="h-3.5 w-3.5" />
                Dispatch
              </button>
            )}
            {canCollect && (
              <button
                type="button"
                onClick={() =>
                  runAction(
                    () =>
                      recordSalesPayment({
                        orderId: r.id,
                        amount: remaining,
                        paymentDate: today,
                        method: 'bank',
                      }),
                    `Recorded payment allocation for ${r.documentNumber}.`,
                  )
                }
                title="Allocate remaining AR payment"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-[#16B8A6] hover:bg-[#16B8A6]/10 cursor-pointer"
              >
                <Banknote className="h-3.5 w-3.5" />
                Collect
              </button>
            )}
            {canCredit && (
              <button
                type="button"
                onClick={() => setCreditTarget(r)}
                title="Issue Credit Note / Sales Return"
                className="p-1.5 rounded-md text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 cursor-pointer"
                aria-label={`Issue credit note for ${r.documentNumber}`}
              >
                <FileMinus2 className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setPreviewOrder(r)}
              aria-label={`Print ${r.documentNumber}`}
              className="p-1.5 rounded-md text-[#DC2626] hover:bg-[#DC2626]/10 cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() =>
                runAction(() => deleteSalesOrder(r.id), `Deleted ${r.documentNumber}.`)
              }
              aria-label={`Delete ${r.documentNumber}`}
              className="p-1.5 rounded-md text-[#718096] hover:text-red-600 cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      },
    },
  ];

  const creditColumns: DataColumn<CreditNote>[] = [
    {
      key: 'num',
      header: 'Credit Note',
      render: (r) => (
        <div>
          <div className="font-mono text-xs font-semibold">{r.creditNumber}</div>
          <div className="text-[11px] text-[#718096] dark:text-slate-400">
            Against {r.invoiceNumber} · {r.issueDate}
          </div>
        </div>
      ),
    },
    {
      key: 'cust',
      header: 'Customer & Reason',
      render: (r) => (
        <div>
          <div className="font-medium">{r.customerName}</div>
          <div className="text-[11px] text-[#718096] dark:text-slate-400">
            {r.reason} {r.restoreStock ? '· Stock Restored' : ''}
          </div>
        </div>
      ),
    },
    {
      key: 'total',
      header: `Credit Total (${currency})`,
      align: 'right',
      numeric: true,
      render: (r) => (
        <span className="font-semibold text-amber-600 dark:text-amber-400">
          {formatNumericCurrency(r.grandTotal, currency, 2)}
        </span>
      ),
    },
  ];

  const purchaseColumns: DataColumn<PurchaseOrder>[] = [
    {
      key: 'doc',
      header: 'PO Number',
      sortable: true,
      sortValue: (r) => r.documentNumber,
      render: (r) => (
        <div>
          <div className="font-mono text-xs font-semibold text-[#1C1917] dark:text-slate-100">
            {r.documentNumber}
          </div>
          <div className="text-[11px] text-[#718096] dark:text-slate-400">
            {r.orderDate}
            {r.approvedBy ? ` · Approved by ${r.approvedBy}` : ''}
          </div>
        </div>
      ),
    },
    {
      key: 'vendor',
      header: 'Vendor / Supplier',
      sortable: true,
      sortValue: (r) => r.vendorName,
      render: (r) => <span className="font-medium">{r.vendorName}</span>,
    },
    {
      key: 'match',
      header: '3-Way Match & Status',
      render: (r) => {
        const paidFull = r.amountPaid >= r.grandTotal - 0.01;
        const matchLabel =
          r.requiresApproval
            ? 'Approval Hold'
            : r.stockPosted && paidFull
              ? '3-Way Matched (PO=GRN=Paid)'
              : r.stockPosted
                ? 'GRN Received · AP Open'
                : 'Awaiting GRN';
        return (
          <div>
            <span
              className={`text-xs font-semibold capitalize ${
                r.requiresApproval
                  ? 'text-amber-600 dark:text-amber-400'
                  : r.status === 'received'
                    ? 'text-[#16B8A6]'
                    : r.status === 'cancelled'
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-[#DC2626]'
              }`}
            >
              {r.status}
            </span>
            <div className="text-[11px] font-mono text-[#718096] dark:text-slate-400">
              {matchLabel}
            </div>
          </div>
        );
      },
    },
    {
      key: 'total',
      header: 'Payable & Paid',
      align: 'right',
      numeric: true,
      sortable: true,
      sortValue: (r) => r.grandTotal,
      render: (r) => (
        <div>
          <div className="font-semibold">
            {formatNumericCurrency(r.grandTotal, currency, 2)}
          </div>
          <div className="text-[11px] text-[#718096] dark:text-slate-400">
            Paid: {formatNumericCurrency(r.amountPaid, currency, 2)}
          </div>
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => {
        const canReceive =
          !r.requiresApproval && r.status !== 'received' && r.status !== 'cancelled';
        const remaining = r.grandTotal - r.amountPaid;
        const canPay = r.status === 'received' && remaining > 0.005;

        return (
          <div className="inline-flex items-center gap-1">
            {r.requiresApproval && (
              <button
                type="button"
                onClick={() =>
                  runAction(
                    () => approvePurchaseOrder(r.id, principal.fullName),
                    `Approved ${r.documentNumber} for procurement.`,
                  )
                }
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-amber-600 hover:bg-amber-500/10 cursor-pointer"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Approve
              </button>
            )}
            {canReceive && (
              <button
                type="button"
                onClick={() =>
                  runAction(
                    () => receivePurchaseOrder({ orderId: r.id, receiptDate: today }),
                    `Received goods (GRN) and posted AP for ${r.documentNumber}.`,
                  )
                }
                title="Post Goods Receipt Note (GRN)"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-[#16B8A6] hover:bg-[#16B8A6]/10 cursor-pointer"
              >
                <PackageCheck className="h-3.5 w-3.5" />
                Receive GRN
              </button>
            )}
            {canPay && (
              <button
                type="button"
                onClick={() =>
                  runAction(
                    () =>
                      recordPurchasePayment({
                        orderId: r.id,
                        amount: remaining,
                        paymentDate: today,
                        method: 'bank',
                      }),
                    `Paid supplier balance for ${r.documentNumber}.`,
                  )
                }
                title="Pay remaining supplier AP"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-[#DC2626] hover:bg-[#DC2626]/10 cursor-pointer"
              >
                <Banknote className="h-3.5 w-3.5" />
                Pay AP
              </button>
            )}
            <button
              type="button"
              onClick={() => setPreviewOrder(r)}
              aria-label={`Print ${r.documentNumber}`}
              className="p-1.5 rounded-md text-[#DC2626] hover:bg-[#DC2626]/10 cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() =>
                runAction(() => deletePurchaseOrder(r.id), `Deleted ${r.documentNumber}.`)
              }
              aria-label={`Delete ${r.documentNumber}`}
              className="p-1.5 rounded-md text-[#718096] hover:text-red-600 cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      },
    },
  ];

  const reqColumns: DataColumn<PurchaseRequisition>[] = [
    {
      key: 'num',
      header: 'Req #',
      render: (r) => (
        <div>
          <div className="font-mono text-xs font-semibold">{r.reqNumber}</div>
          <div className="text-[11px] text-[#718096] dark:text-slate-400">
            {r.requestedBy} · {r.department}
          </div>
        </div>
      ),
    },
    {
      key: 'item',
      header: 'Requested Item',
      render: (r) => (
        <div>
          <div className="font-medium">{r.itemDescription}</div>
          <div className="text-[11px] text-[#718096] dark:text-slate-400">
            Qty: {r.quantity} · Est: {formatNumericCurrency(r.estimatedUnitCost, currency, 2)}
            {r.vendorName ? ` · Preferred: ${r.vendorName}` : ''}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <span className="text-xs font-semibold capitalize text-[#DC2626]">{r.status}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => (
        <div className="inline-flex items-center gap-1.5">
          {r.status === 'pending' && (
            <>
              <button
                type="button"
                onClick={() => updateRequisitionStatus(r.id, 'approved')}
                className="text-xs font-medium text-[#16B8A6] hover:underline cursor-pointer"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => updateRequisitionStatus(r.id, 'rejected')}
                className="text-xs font-medium text-red-600 hover:underline cursor-pointer"
              >
                Reject
              </button>
            </>
          )}
          {(r.status === 'pending' || r.status === 'approved') && (
            <button
              type="button"
              onClick={() =>
                runAction(
                  () => {
                    const po = convertRequisitionToPo(
                      r.id,
                      r.vendorName || 'Preferred Vendor',
                      today,
                    );
                    setActionNotice(`Converted ${r.reqNumber} into ${po.documentNumber}.`);
                  },
                )
              }
              className="px-2 py-1 rounded text-xs font-medium text-[#DC2626] hover:bg-[#DC2626]/10 cursor-pointer"
            >
              Convert to PO
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1C1917] dark:text-slate-100">
            {isSales ? 'Sales, Subscriptions & Invoicing' : 'Purchase, RFQs & 3-Way Match'}
          </h1>
          <p className="mt-1 text-xs text-[#718096] dark:text-slate-400">
            {isSales
              ? 'Quotes, discounted invoices, recurring billing, drop-ship flags, sales commissions, dispatches, and credit notes.'
              : 'Purchase requisitions, approval rules, vendor POs, GRN receipts, 3-way matching, and supplier AP settlements.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isSales && totalSalesCommissions > 0 && (
            <div className="text-right text-xs font-mono tabular-nums">
              <div className="text-[11px] text-[#718096]">Commissions Accrued</div>
              <div className="font-semibold text-[#DC2626]">
                {formatNumericCurrency(totalSalesCommissions, currency, 2)}
              </div>
            </div>
          )}
          <Button variant="primary" size="sm" onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-4 w-4" />
            {showForm
              ? 'Close Builder'
              : isSales
                ? 'New Invoice / Quote'
                : 'New Purchase Order'}
          </Button>
        </div>
      </div>

      {/* Interactive Order Analytics Strip */}
      {(isSales ? data.salesOrders.length > 0 : data.purchaseOrders.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Surface padding="lg" className="lg:col-span-2 space-y-3">
            <h2 className="text-sm font-semibold text-[#1C1917] dark:text-slate-100">
              {isSales ? 'Recent Invoices: Billed vs Collected' : 'Recent Purchase Orders: Total vs Paid'}
            </h2>
            <GroupedBarChart
              data={(isSales ? data.salesOrders : data.purchaseOrders)
                .filter((o) => o.status !== 'cancelled')
                .slice(0, 7)
                .map((o) => ({
                  label: o.documentNumber,
                  primary: o.grandTotal,
                  secondary: o.amountPaid,
                }))}
              primaryLabel={isSales ? 'Invoiced' : 'PO Total'}
              secondaryLabel={isSales ? 'Collected' : 'Paid'}
              primaryColor="#DC2626"
              secondaryColor="#16B8A6"
              formatValue={(v) => formatNumericCurrency(v, currency, 0)}
              height={180}
            />
          </Surface>

          <Surface padding="lg" className="space-y-3">
            <h2 className="text-sm font-semibold text-[#1C1917] dark:text-slate-100">
              {isSales ? 'Invoice Settlement Status' : 'PO Fulfillment Mix'}
            </h2>
            {isSales ? (
              <DonutChart
                slices={[
                  {
                    label: 'Paid',
                    value: data.salesOrders
                      .filter((o) => o.status === 'paid')
                      .reduce((s, o) => s + o.grandTotal, 0),
                    color: '#16B8A6',
                  },
                  {
                    label: 'Open / Sent',
                    value: data.salesOrders
                      .filter((o) => o.status === 'sent' && o.dueDate >= today)
                      .reduce((s, o) => s + o.grandTotal, 0),
                    color: '#DC2626',
                  },
                  {
                    label: 'Overdue',
                    value: data.salesOrders
                      .filter((o) => o.status === 'sent' && o.dueDate < today)
                      .reduce((s, o) => s + o.grandTotal, 0),
                    color: '#F59E0B',
                  },
                  {
                    label: 'Draft / Quote',
                    value: data.salesOrders
                      .filter((o) => o.status === 'draft')
                      .reduce((s, o) => s + o.grandTotal, 0),
                    color: '#F59E0B',
                  },
                ]}
                centerLabel="Total Volume"
                centerValue={formatNumericCurrency(
                  data.salesOrders
                    .filter((o) => o.status !== 'cancelled')
                    .reduce((s, o) => s + o.grandTotal, 0),
                  currency,
                  0,
                )}
                formatValue={(v) => formatNumericCurrency(v, currency, 0)}
              />
            ) : (
              <DonutChart
                slices={[
                  {
                    label: 'Received (GRN)',
                    value: data.purchaseOrders
                      .filter((o) => o.status === 'received')
                      .reduce((s, o) => s + o.grandTotal, 0),
                    color: '#16B8A6',
                  },
                  {
                    label: 'Ordered',
                    value: data.purchaseOrders
                      .filter((o) => o.status === 'ordered')
                      .reduce((s, o) => s + o.grandTotal, 0),
                    color: '#DC2626',
                  },
                  {
                    label: 'Draft / Approval Hold',
                    value: data.purchaseOrders
                      .filter((o) => o.status === 'draft')
                      .reduce((s, o) => s + o.grandTotal, 0),
                    color: '#F59E0B',
                  },
                ]}
                centerLabel="Total Spend"
                centerValue={formatNumericCurrency(
                  data.purchaseOrders
                    .filter((o) => o.status !== 'cancelled')
                    .reduce((s, o) => s + o.grandTotal, 0),
                  currency,
                  0,
                )}
                formatValue={(v) => formatNumericCurrency(v, currency, 0)}
              />
            )}
          </Surface>
        </div>
      )}

      {/* Sub-navigation Tabs */}
      <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-[#251B20]">
        <button
          type="button"
          onClick={() => setSubTab('primary')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
            subTab === 'primary'
              ? 'bg-white dark:bg-[#1B1417] text-[#1C1917] dark:text-slate-100 shadow-xs'
              : 'text-[#718096] dark:text-slate-400'
          }`}
        >
          {isSales
            ? `Invoices & Quotes (${data.salesOrders.length})`
            : `Purchase Orders (${data.purchaseOrders.length})`}
        </button>
        <button
          type="button"
          onClick={() => setSubTab('secondary')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
            subTab === 'secondary'
              ? 'bg-white dark:bg-[#1B1417] text-[#1C1917] dark:text-slate-100 shadow-xs'
              : 'text-[#718096] dark:text-slate-400'
          }`}
        >
          {isSales
            ? `Credit Notes (${data.creditNotes.length})`
            : `Requisitions & RFQs (${data.purchaseRequisitions.length})`}
        </button>
      </div>

      {actionError && (
        <Surface padding="sm" className="text-xs font-medium text-red-600 dark:text-red-400">
          {actionError}
        </Surface>
      )}
      {actionNotice && (
        <Surface padding="sm" className="text-xs font-medium text-[#16B8A6]">
          {actionNotice}
        </Surface>
      )}

      {showForm && (
        <Surface padding="lg">
          <form onSubmit={handleCreate} className="space-y-5">
            <h2 className="text-sm font-semibold text-[#1C1917] dark:text-slate-100">
              {isSales ? 'Sales Document Builder' : 'Purchase Order Builder'}
            </h2>
            {formError && <p className="text-xs font-medium text-red-600">{formError}</p>}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {isSales && (
                <div>
                  <label className="block text-xs font-medium mb-1">Document Type</label>
                  <select
                    value={documentType}
                    onChange={(e) => setDocumentType(e.target.value as 'invoice' | 'quote')}
                    className="w-full h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                  >
                    <option value="invoice">Tax Invoice</option>
                    <option value="quote">Quotation</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium mb-1">
                  Pick Saved {isSales ? 'Customer' : 'Vendor'}
                </label>
                <select
                  value={selectedContactId}
                  onChange={(e) => handleContactSelect(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                >
                  <option value="">Enter manually...</option>
                  {contactsPool.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.organization} ({c.name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  {isSales ? 'Customer Name *' : 'Vendor Name *'}
                </label>
                <input
                  type="text"
                  value={counterpartyName}
                  onChange={(e) => setCounterpartyName(e.target.value)}
                  placeholder={isSales ? 'Customer business or name' : 'Supplier business name'}
                  className="w-full h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Initial Status</label>
                <select
                  value={initialStatus}
                  onChange={(e) =>
                    setInitialStatus(e.target.value as typeof initialStatus)
                  }
                  className="w-full h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                >
                  {isSales ? (
                    <>
                      <option value="draft">Draft</option>
                      <option value="sent">Sent (Reserves Stock & Posts AR)</option>
                      <option value="paid">Paid (Posts AR + Cash Settlement)</option>
                    </>
                  ) : (
                    <>
                      <option value="draft">Draft</option>
                      <option value="ordered">Ordered</option>
                      <option value="received">Received (Posts GRN, Stock & AP)</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  {isSales ? 'Issue Date' : 'Order Date'}
                </label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  {isSales ? 'Due Date' : 'Expected Delivery'}
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
              </div>

              {isSales && (
                <>
                  <div>
                    <label className="block text-xs font-medium mb-1">Channel</label>
                    <select
                      value={channel}
                      onChange={(e) => setChannel(e.target.value as typeof channel)}
                      className="w-full h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                    >
                      <option value="direct">Direct B2B / Counter</option>
                      <option value="ecommerce">E-Commerce Storefront</option>
                      <option value="pos">Retail POS</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium mb-1">Salesperson</label>
                      <input
                        type="text"
                        value={salesperson}
                        onChange={(e) => setSalesperson(e.target.value)}
                        className="w-full h-9 px-2.5 rounded-lg text-xs bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Comm %</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={commissionRate}
                        onChange={(e) => setCommissionRate(e.target.value)}
                        className="w-full h-9 px-2.5 rounded-lg text-xs font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            {isSales && (
              <div className="flex flex-wrap items-center gap-6 text-xs">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                  />
                  <span>Recurring Subscription Billing</span>
                </label>
                {isRecurring && (
                  <select
                    value={recurringInterval}
                    onChange={(e) => setRecurringInterval(e.target.value as typeof recurringInterval)}
                    className="h-8 px-2 rounded-md text-xs bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annual">Annual</option>
                  </select>
                )}
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isDropShip}
                    onChange={(e) => setIsDropShip(e.target.checked)}
                  />
                  <span>Drop-Ship Direct from Vendor</span>
                </label>
              </div>
            )}

            {/* Line Items */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#1C1917] dark:text-slate-100">
                  Line Items (Qty · Price · Disc % · Tax %)
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setLines((prev) => [...prev, emptyDraftLine()])}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Line
                </Button>
              </div>

              <div className="space-y-2">
                {lines.map((line) => (
                  <div
                    key={line.key}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-2.5 rounded-lg border border-slate-200 dark:border-[#32242A] bg-[#FAF9F7]/60 dark:bg-[#141013]"
                  >
                    <div className="sm:col-span-3">
                      <select
                        value={line.itemId}
                        onChange={(e) => handleSelectCatalogueItem(line.key, e.target.value)}
                        className="w-full h-8 px-2 rounded-md text-xs bg-white dark:bg-[#1B1417] border border-slate-200 dark:border-[#32242A]"
                      >
                        <option value="">Custom line...</option>
                        {data.catalogue.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.sku} · {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-3">
                      <input
                        type="text"
                        value={line.description}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((x) =>
                              x.key === line.key ? { ...x, description: e.target.value } : x,
                            ),
                          )
                        }
                        placeholder="Item or service description"
                        className="w-full h-8 px-2.5 rounded-md text-xs bg-white dark:bg-[#1B1417] border border-slate-200 dark:border-[#32242A]"
                      />
                    </div>
                    <div className="sm:col-span-1">
                      <input
                        type="number"
                        step="0.01"
                        value={line.quantity}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((x) =>
                              x.key === line.key ? { ...x, quantity: e.target.value } : x,
                            ),
                          )
                        }
                        aria-label="Quantity"
                        className="w-full h-8 px-2 rounded-md text-xs font-mono bg-white dark:bg-[#1B1417] border border-slate-200 dark:border-[#32242A]"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <input
                        type="number"
                        step="0.01"
                        value={line.unitPrice}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((x) =>
                              x.key === line.key ? { ...x, unitPrice: e.target.value } : x,
                            ),
                          )
                        }
                        aria-label="Unit price"
                        className="w-full h-8 px-2 rounded-md text-xs font-mono bg-white dark:bg-[#1B1417] border border-slate-200 dark:border-[#32242A]"
                      />
                    </div>
                    <div className="sm:col-span-1">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="100"
                        value={line.discountRate}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((x) =>
                              x.key === line.key ? { ...x, discountRate: e.target.value } : x,
                            ),
                          )
                        }
                        aria-label="Discount percent"
                        title="Discount %"
                        className="w-full h-8 px-2 rounded-md text-xs font-mono bg-white dark:bg-[#1B1417] border border-slate-200 dark:border-[#32242A]"
                      />
                    </div>
                    <div className="sm:col-span-1">
                      <input
                        type="number"
                        step="0.01"
                        value={line.taxRate}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((x) =>
                              x.key === line.key ? { ...x, taxRate: e.target.value } : x,
                            ),
                          )
                        }
                        aria-label="Tax percent"
                        title="Tax %"
                        className="w-full h-8 px-2 rounded-md text-xs font-mono bg-white dark:bg-[#1B1417] border border-slate-200 dark:border-[#32242A]"
                      />
                    </div>
                    <div className="sm:col-span-1 flex justify-end">
                      <button
                        type="button"
                        disabled={lines.length === 1}
                        onClick={() =>
                          setLines((prev) => prev.filter((x) => x.key !== line.key))
                        }
                        aria-label="Remove line"
                        className="p-1.5 text-[#718096] hover:text-red-600 disabled:opacity-30 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-slate-200 dark:border-[#32242A]">
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Payment terms or delivery notes (optional)"
                className="w-full sm:max-w-sm h-9 px-3 rounded-lg text-xs bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
              />
              <div className="flex items-center gap-6 text-xs font-mono tabular-nums">
                <span>
                  Subtotal: {formatNumericCurrency(draftTotals.subtotal, currency, 2)}
                </span>
                <span>Tax: {formatNumericCurrency(draftTotals.taxTotal, currency, 2)}</span>
                <span className="text-sm font-bold text-[#DC2626]">
                  Total: {formatNumericCurrency(draftTotals.grandTotal, currency, 2)}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm">
                Save {isSales ? (documentType === 'quote' ? 'Quote' : 'Invoice') : 'Purchase Order'}
              </Button>
            </div>
          </form>
        </Surface>
      )}

      {isSales ? (
        subTab === 'primary' ? (
          <DataTable
            data={data.salesOrders}
            columns={salesColumns}
            getRowKey={(r) => r.id}
            searchPlaceholder="Search invoice number or customer..."
            searchPredicate={(r, q) =>
              `${r.documentNumber} ${r.customerName} ${r.status} ${r.fulfillmentStatus}`
                .toLowerCase()
                .includes(q)
            }
            emptyTitle="No sales quotes or invoices yet"
            emptyDescription="Create your first invoice or quotation to reserve stock, post double-entry AR/Revenue, and dispatch orders."
            emptyActionLabel="New Invoice / Quote"
            onEmptyAction={() => setShowForm(true)}
          />
        ) : (
          <DataTable
            data={data.creditNotes}
            columns={creditColumns}
            getRowKey={(r) => r.id}
            searchPlaceholder="Search credit note or invoice..."
            searchPredicate={(r, q) =>
              `${r.creditNumber} ${r.invoiceNumber} ${r.customerName}`.toLowerCase().includes(q)
            }
            emptyTitle="No credit notes issued yet"
            emptyDescription="Issue a credit note from any posted Sales Invoice to reverse Revenue/Tax/AR and optionally return stock."
          />
        )
      ) : subTab === 'primary' ? (
        <DataTable
          data={data.purchaseOrders}
          columns={purchaseColumns}
          getRowKey={(r) => r.id}
          searchPlaceholder="Search PO number or vendor..."
          searchPredicate={(r, q) =>
            `${r.documentNumber} ${r.vendorName} ${r.status}`.toLowerCase().includes(q)
          }
          emptyTitle="No purchase orders yet"
          emptyDescription="Create purchase orders to procure inventory from vendors, post GRNs, and settle supplier payables."
          emptyActionLabel="New Purchase Order"
          onEmptyAction={() => setShowForm(true)}
        />
      ) : (
        <div className="space-y-6">
          <Surface padding="lg">
            <form onSubmit={handleCreateRequisition} className="space-y-4">
              <h2 className="text-sm font-semibold">New Purchase Requisition / RFQ</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                <select
                  value={reqItemId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setReqItemId(id);
                    const found = data.catalogue.find((c) => c.id === id);
                    if (found) {
                      setReqDesc(found.name);
                      setReqCost(String(found.costPrice));
                    }
                  }}
                  className="h-9 px-2.5 rounded-lg text-xs bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                >
                  <option value="">Custom item...</option>
                  {data.catalogue.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.sku} · {c.name}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  required
                  value={reqDesc}
                  onChange={(e) => setReqDesc(e.target.value)}
                  placeholder="Item / Material needed *"
                  className="lg:col-span-2 h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
                <input
                  type="number"
                  min="1"
                  value={reqQty}
                  onChange={(e) => setReqQty(e.target.value)}
                  placeholder="Qty"
                  className="h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
                <input
                  type="number"
                  step="0.01"
                  value={reqCost}
                  onChange={(e) => setReqCost(e.target.value)}
                  placeholder="Est Unit Cost"
                  className="h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
                <input
                  type="text"
                  value={reqVendor}
                  onChange={(e) => setReqVendor(e.target.value)}
                  placeholder="Suggested Vendor"
                  className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
                <input
                  type="text"
                  value={reqBy}
                  onChange={(e) => setReqBy(e.target.value)}
                  placeholder="Requested By"
                  className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
                <input
                  type="text"
                  value={reqDept}
                  onChange={(e) => setReqDept(e.target.value)}
                  placeholder="Department"
                  className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
                <input
                  type="text"
                  value={reqNotes}
                  onChange={(e) => setReqNotes(e.target.value)}
                  placeholder="Justification / RFQ notes"
                  className="lg:col-span-3 h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
                <Button type="submit" variant="primary" size="sm" className="h-9">
                  Submit Requisition
                </Button>
              </div>
            </form>
          </Surface>

          <DataTable
            data={data.purchaseRequisitions}
            columns={reqColumns}
            getRowKey={(r) => r.id}
            searchPlaceholder="Search requisitions..."
            searchPredicate={(r, q) =>
              `${r.reqNumber} ${r.itemDescription} ${r.requestedBy}`.toLowerCase().includes(q)
            }
            emptyTitle="No purchase requisitions"
            emptyDescription="Submit internal purchase requests and convert approved requisitions directly into vendor Purchase Orders."
          />
        </div>
      )}

      {/* Credit Note Modal */}
      {creditTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1B1417]/60"
          role="dialog"
          aria-modal="true"
          onClick={() => setCreditTarget(null)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white dark:bg-[#1B1417] border border-slate-200 dark:border-[#32242A] p-5 space-y-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">Issue Credit Note ({creditTarget.documentNumber})</h3>
              <button
                type="button"
                onClick={() => setCreditTarget(null)}
                className="p-1 text-[#718096] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleIssueCreditNote} className="space-y-3">
              <div className="text-xs text-[#718096] dark:text-slate-400">
                Customer: <strong className="text-[#1C1917] dark:text-slate-100">{creditTarget.customerName}</strong> · Amount:{' '}
                <strong className="font-mono">{formatNumericCurrency(creditTarget.grandTotal, currency, 2)}</strong>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Reason for Credit Note</label>
                <input
                  type="text"
                  required
                  value={creditReason}
                  onChange={(e) => setCreditReason(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
              </div>
              {creditTarget.stockPosted && (
                <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={creditRestoreStock}
                    onChange={(e) => setCreditRestoreStock(e.target.checked)}
                  />
                  <span>Restore dispatched physical stock & reverse COGS</span>
                </label>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => setCreditTarget(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm">
                  Post Credit Note
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Document Modal */}
      {previewOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1B1417]/60"
          role="dialog"
          aria-modal="true"
          onClick={() => setPreviewOrder(null)}
        >
          <div
            className="w-full max-w-2xl rounded-xl bg-white dark:bg-[#1B1417] border border-slate-200 dark:border-[#32242A] p-6 space-y-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 dark:border-[#32242A] pb-4">
              <div>
                <div className="text-xs font-semibold text-[#DC2626]">
                  {activeCompany.legalName}
                </div>
                <h3 className="text-lg font-bold font-mono text-[#1C1917] dark:text-slate-100">
                  {previewOrder.documentNumber}
                </h3>
                <div className="text-xs text-[#718096] dark:text-slate-400">
                  {'customerName' in previewOrder
                    ? `Bill To: ${previewOrder.customerName}`
                    : `Supplier: ${previewOrder.vendorName}`}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="primary" size="sm" onClick={() => window.print()}>
                  <Printer className="h-3.5 w-3.5" />
                  Print
                </Button>
                <button
                  type="button"
                  onClick={() => setPreviewOrder(null)}
                  className="p-1.5 rounded-md text-[#718096] hover:text-[#1C1917] cursor-pointer"
                  aria-label="Close preview"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <table className="w-full text-xs text-left">
              <thead className="border-b border-slate-200 dark:border-[#32242A] text-[#718096]">
                <tr>
                  <th className="py-2">Description</th>
                  <th className="py-2 text-right">Qty</th>
                  <th className="py-2 text-right">Rate</th>
                  <th className="py-2 text-right">Disc %</th>
                  <th className="py-2 text-right">Tax %</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-[#32242A]">
                {previewOrder.lines.map((l) => (
                  <tr key={l.id}>
                    <td className="py-2 font-medium">{l.description}</td>
                    <td className="py-2 text-right font-mono tabular-nums">{l.quantity}</td>
                    <td className="py-2 text-right font-mono tabular-nums">
                      {formatNumericCurrency(l.unitPrice, currency, 2)}
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums">{l.discountRate ?? 0}%</td>
                    <td className="py-2 text-right font-mono tabular-nums">{l.taxRate}%</td>
                    <td className="py-2 text-right font-mono font-semibold tabular-nums">
                      {formatNumericCurrency(l.lineTotal, currency, 2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end border-t border-slate-200 dark:border-[#32242A] pt-3 text-xs font-mono tabular-nums space-x-6">
              <span>Subtotal: {formatNumericCurrency(previewOrder.subtotal, currency, 2)}</span>
              <span>Tax: {formatNumericCurrency(previewOrder.taxTotal, currency, 2)}</span>
              <span className="text-sm font-bold text-[#DC2626]">
                Total: {formatNumericCurrency(previewOrder.grandTotal, currency, 2)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
