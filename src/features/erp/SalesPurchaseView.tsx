import React, { useMemo, useState } from 'react';
import { Banknote, PackageCheck, Plus, Printer, Trash2, Truck, X } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { DataColumn, DataTable } from '@/src/components/ui/DataTable';
import { Surface } from '@/src/components/ui/Surface';
import { useErpData } from '@/src/components/shell/ErpDataProvider';
import { useTenant } from '@/src/components/shell/TenantProvider';
import {
  PurchaseOrder,
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
  taxRate: string;
}

function emptyDraftLine(): DraftLine {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    itemId: '',
    description: '',
    quantity: '1',
    unitPrice: '0',
    taxRate: '18',
  };
}

export function SalesPurchaseView({ mode }: { mode: 'sales' | 'purchase' }) {
  const { activeCompany } = useTenant();
  const {
    data,
    createSalesOrder,
    updateSalesStatus,
    dispatchSalesOrder,
    recordSalesPayment,
    deleteSalesOrder,
    createPurchaseOrder,
    receivePurchaseOrder,
    recordPurchasePayment,
    deletePurchaseOrder,
  } = useErpData();

  const isSales = mode === 'sales';
  const currency = activeCompany.baseCurrency;
  const today = new Date().toISOString().slice(0, 10);

  const [showForm, setShowForm] = useState(false);
  const [documentType, setDocumentType] = useState<'invoice' | 'quote'>('invoice');
  const [counterpartyName, setCounterpartyName] = useState('');
  const [selectedContactId, setSelectedContactId] = useState('');
  const [issueDate, setIssueDate] = useState(today);
  const [dueDate, setDueDate] = useState(today);
  const [initialStatus, setInitialStatus] = useState<'draft' | 'sent' | 'paid' | 'ordered' | 'received'>(
    isSales ? 'sent' : 'ordered',
  );
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([emptyDraftLine()]);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [previewOrder, setPreviewOrder] = useState<SalesOrder | PurchaseOrder | null>(null);

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
      const rate = Math.max(0, Number(l.taxRate) || 0);
      const base = qty * price;
      subtotal += base;
      taxTotal += (base * rate) / 100;
    });
    return { subtotal, taxTotal, grandTotal: subtotal + taxTotal };
  }, [lines]);

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
        setActionNotice(`Created ${created.documentNumber} (${created.status}).`);
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

  const salesColumns: DataColumn<SalesOrder>[] = [
    {
      key: 'doc',
      header: 'Document',
      sortable: true,
      sortValue: (r) => r.documentNumber,
      render: (r) => (
        <div>
          <div className="font-mono text-xs font-semibold text-[#182238] dark:text-slate-100">
            {r.documentNumber}
          </div>
          <div className="text-[11px] text-[#718096] dark:text-slate-400 capitalize">
            {r.documentType} · {r.issueDate}
          </div>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      sortable: true,
      sortValue: (r) => r.customerName,
      render: (r) => <span className="font-medium">{r.customerName}</span>,
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
            className="h-7 px-2 rounded-md text-xs bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257] capitalize cursor-pointer"
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
                  ? 'text-[#4169F5]'
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
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-[#4169F5] hover:bg-[#4169F5]/10 cursor-pointer"
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
            <button
              type="button"
              onClick={() => setPreviewOrder(r)}
              aria-label={`Print ${r.documentNumber}`}
              className="p-1.5 rounded-md text-[#4169F5] hover:bg-[#4169F5]/10 cursor-pointer"
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

  const purchaseColumns: DataColumn<PurchaseOrder>[] = [
    {
      key: 'doc',
      header: 'PO Number',
      sortable: true,
      sortValue: (r) => r.documentNumber,
      render: (r) => (
        <div>
          <div className="font-mono text-xs font-semibold text-[#182238] dark:text-slate-100">
            {r.documentNumber}
          </div>
          <div className="text-[11px] text-[#718096] dark:text-slate-400">
            {r.orderDate}
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
      key: 'status',
      header: 'Receipt & Posting',
      render: (r) => (
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-semibold capitalize ${
              r.status === 'received'
                ? 'text-[#16B8A6]'
                : r.status === 'cancelled'
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-[#4169F5]'
            }`}
          >
            {r.status}
          </span>
          {r.stockPosted && (
            <span className="text-[11px] font-mono text-[#718096] dark:text-slate-400">
              {r.receiptRef ?? 'GRN'}
            </span>
          )}
        </div>
      ),
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
        const canReceive = r.status !== 'received' && r.status !== 'cancelled';
        const remaining = r.grandTotal - r.amountPaid;
        const canPay = r.status === 'received' && remaining > 0.005;

        return (
          <div className="inline-flex items-center gap-1">
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
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-[#4169F5] hover:bg-[#4169F5]/10 cursor-pointer"
              >
                <Banknote className="h-3.5 w-3.5" />
                Pay AP
              </button>
            )}
            <button
              type="button"
              onClick={() => setPreviewOrder(r)}
              aria-label={`Print ${r.documentNumber}`}
              className="p-1.5 rounded-md text-[#4169F5] hover:bg-[#4169F5]/10 cursor-pointer"
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#182238] dark:text-slate-100">
            {isSales ? 'Sales & Invoicing' : 'Purchase & Procurement'}
          </h1>
          <p className="mt-1 text-xs text-[#718096] dark:text-slate-400">
            {isSales
              ? 'Sending an invoice reserves stock and posts AR/Revenue/Output Tax. Use Dispatch to deduct physical inventory and post COGS.'
              : 'Create vendor purchase orders. Posting a Goods Receipt (GRN) updates inventory valuation, batches, Input Tax, and Accounts Payable.'}
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4" />
          {showForm
            ? 'Close Builder'
            : isSales
              ? 'New Invoice / Quote'
              : 'New Purchase Order'}
        </Button>
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
            <h2 className="text-sm font-semibold text-[#182238] dark:text-slate-100">
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
                    className="w-full h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
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
                  className="w-full h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
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
                  className="w-full h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Initial Status</label>
                <select
                  value={initialStatus}
                  onChange={(e) =>
                    setInitialStatus(e.target.value as typeof initialStatus)
                  }
                  className="w-full h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
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
                  className="w-full h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
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
                  className="w-full h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
                />
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#182238] dark:text-slate-100">
                  Line Items
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
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-2.5 rounded-lg border border-slate-200 dark:border-[#223257] bg-[#F6F8FC]/60 dark:bg-[#0E172E]"
                  >
                    <div className="sm:col-span-3">
                      <select
                        value={line.itemId}
                        onChange={(e) => handleSelectCatalogueItem(line.key, e.target.value)}
                        className="w-full h-8 px-2 rounded-md text-xs bg-white dark:bg-[#101B35] border border-slate-200 dark:border-[#223257]"
                      >
                        <option value="">Custom line...</option>
                        {data.catalogue.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.sku} · {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-4">
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
                        className="w-full h-8 px-2.5 rounded-md text-xs bg-white dark:bg-[#101B35] border border-slate-200 dark:border-[#223257]"
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
                        className="w-full h-8 px-2 rounded-md text-xs font-mono bg-white dark:bg-[#101B35] border border-slate-200 dark:border-[#223257]"
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
                        className="w-full h-8 px-2 rounded-md text-xs font-mono bg-white dark:bg-[#101B35] border border-slate-200 dark:border-[#223257]"
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
                        className="w-full h-8 px-2 rounded-md text-xs font-mono bg-white dark:bg-[#101B35] border border-slate-200 dark:border-[#223257]"
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

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-slate-200 dark:border-[#223257]">
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Payment terms or delivery notes (optional)"
                className="w-full sm:max-w-sm h-9 px-3 rounded-lg text-xs bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
              />
              <div className="flex items-center gap-6 text-xs font-mono tabular-nums">
                <span>
                  Subtotal: {formatNumericCurrency(draftTotals.subtotal, currency, 2)}
                </span>
                <span>Tax: {formatNumericCurrency(draftTotals.taxTotal, currency, 2)}</span>
                <span className="text-sm font-bold text-[#4169F5]">
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
      )}

      {/* Printable Document Modal */}
      {previewOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#101B35]/60"
          role="dialog"
          aria-modal="true"
          onClick={() => setPreviewOrder(null)}
        >
          <div
            className="w-full max-w-2xl rounded-xl bg-white dark:bg-[#101B35] border border-slate-200 dark:border-[#223257] p-6 space-y-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 dark:border-[#223257] pb-4">
              <div>
                <div className="text-xs font-semibold text-[#4169F5]">
                  {activeCompany.legalName}
                </div>
                <h3 className="text-lg font-bold font-mono text-[#182238] dark:text-slate-100">
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
                  className="p-1.5 rounded-md text-[#718096] hover:text-[#182238] cursor-pointer"
                  aria-label="Close preview"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <table className="w-full text-xs text-left">
              <thead className="border-b border-slate-200 dark:border-[#223257] text-[#718096]">
                <tr>
                  <th className="py-2">Description</th>
                  <th className="py-2 text-right">Qty</th>
                  <th className="py-2 text-right">Rate</th>
                  <th className="py-2 text-right">Tax %</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-[#223257]">
                {previewOrder.lines.map((l) => (
                  <tr key={l.id}>
                    <td className="py-2 font-medium">{l.description}</td>
                    <td className="py-2 text-right font-mono tabular-nums">{l.quantity}</td>
                    <td className="py-2 text-right font-mono tabular-nums">
                      {formatNumericCurrency(l.unitPrice, currency, 2)}
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums">{l.taxRate}%</td>
                    <td className="py-2 text-right font-mono font-semibold tabular-nums">
                      {formatNumericCurrency(l.lineTotal, currency, 2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end border-t border-slate-200 dark:border-[#223257] pt-3 text-xs font-mono tabular-nums space-x-6">
              <span>Subtotal: {formatNumericCurrency(previewOrder.subtotal, currency, 2)}</span>
              <span>Tax: {formatNumericCurrency(previewOrder.taxTotal, currency, 2)}</span>
              <span className="text-sm font-bold text-[#4169F5]">
                Total: {formatNumericCurrency(previewOrder.grandTotal, currency, 2)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
