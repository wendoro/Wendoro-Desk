import {
  AuditLogRecord,
  CatalogueItem,
  CrmContact,
  CrmStage,
  DocumentRecord,
  EmployeeRecord,
  ErpDatabaseState,
  IndustryOperationRecord,
  InventoryLot,
  MarketingCampaign,
  OrderLineItem,
  PaymentAllocation,
  PayrollRun,
  ProjectTask,
  ProjectTaskStatus,
  PurchaseOrder,
  PurchaseStatus,
  SalesOrder,
  SalesStatus,
  StockMovement,
  StockReservation,
  SupportTicket,
  TicketStatus,
} from '@/src/core/store/erpTypes';
import {
  DraftJournalLine,
  ErpDomainError,
  createUuid,
  ensureCompanyAccounts,
  nextSequenceNumber,
  nowIso,
  postJournalEntry,
  roundMoney,
} from './accountingEngine';
import { BackupPayloadSchema } from './backupSchema';

export interface TransactionScope {
  companyId: string;
  branchId: string | null;
  actorUserId: string;
  actorRole: string;
}

export const EMPTY_ERP_DATABASE_STATE: ErpDatabaseState = {
  schemaVersion: 3,
  sequences: {},
  catalogue: [],
  contacts: [],
  salesOrders: [],
  creditNotes: [],
  posShifts: [],
  purchaseOrders: [],
  purchaseRequisitions: [],
  warehouses: [],
  stockTransfers: [],
  shipments: [],
  stockMovements: [],
  inventoryLots: [],
  stockReservations: [],
  accounts: [],
  fiscalPeriods: [],
  journals: [],
  paymentAllocations: [],
  ledgerEntries: [],
  fixedAssets: [],
  budgets: [],
  expenseClaims: [],
  bankTransactions: [],
  boms: [],
  workOrders: [],
  qualityInspections: [],
  maintenanceSchedules: [],
  employees: [],
  payrollRuns: [],
  leaveRequests: [],
  attendanceLogs: [],
  jobOpenings: [],
  candidates: [],
  performanceGoals: [],
  projectTasks: [],
  timesheets: [],
  supportTickets: [],
  kbArticles: [],
  documents: [],
  campaigns: [],
  approvalRules: [],
  customFields: [],
  biReports: [],
  industryRecords: [],
  auditLogs: [],
};

export function appendAuditLog(
  state: ErpDatabaseState,
  scope: TransactionScope,
  entry: Omit<AuditLogRecord, 'id' | 'companyId' | 'actorUserId' | 'actorRole' | 'createdAt'>,
): ErpDatabaseState {
  const record: AuditLogRecord = {
    id: createUuid(),
    companyId: scope.companyId,
    actorUserId: scope.actorUserId,
    actorRole: scope.actorRole,
    action: entry.action,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId,
    outcome: entry.outcome,
    details: entry.details,
    createdAt: nowIso(),
  };
  return {
    ...state,
    auditLogs: [record, ...state.auditLogs.slice(0, 499)],
  };
}

/**
 * Executes a multi-step ERP mutation atomically over an isolated snapshot.
 * If any validation, stock, fiscal period, or balance invariant fails, the
 * original state is preserved untouched (true rollback semantics).
 */
export function runAtomicTransaction<T>(
  currentState: ErpDatabaseState,
  fn: (snapshot: ErpDatabaseState) => { nextState: ErpDatabaseState; result: T },
): { nextState: ErpDatabaseState; result: T } {
  const snapshot = structuredClone(currentState);
  return fn(snapshot);
}

export function computeOrderTotals(
  rawLines: Array<Omit<OrderLineItem, 'id' | 'lineTotal'>>,
): {
  lines: OrderLineItem[];
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
} {
  if (rawLines.length === 0) {
    throw new ErpDomainError('EMPTY_ORDER', 'Order must contain at least one line item.');
  }

  let subtotal = 0;
  let taxTotal = 0;

  const lines: OrderLineItem[] = rawLines.map((line, idx) => {
    if (!line.description.trim()) {
      throw new ErpDomainError('INVALID_LINE', `Line ${idx + 1} requires a description.`);
    }
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
      throw new ErpDomainError('INVALID_QUANTITY', `Line ${idx + 1} quantity must be > 0.`);
    }
    if (!Number.isFinite(line.unitPrice) || line.unitPrice < 0) {
      throw new ErpDomainError('INVALID_PRICE', `Line ${idx + 1} unit price cannot be negative.`);
    }
    const discountRate = line.discountRate ?? 0;
    if (!Number.isFinite(discountRate) || discountRate < 0 || discountRate > 100) {
      throw new ErpDomainError('INVALID_DISCOUNT', `Line ${idx + 1} discount must be between 0 and 100%.`);
    }
    if (!Number.isFinite(line.taxRate) || line.taxRate < 0) {
      throw new ErpDomainError('INVALID_TAX', `Line ${idx + 1} tax rate cannot be negative.`);
    }

    const gross = roundMoney(line.quantity * line.unitPrice);
    const base = roundMoney(gross * (1 - discountRate / 100));
    const tax = roundMoney((base * line.taxRate) / 100);
    subtotal = roundMoney(subtotal + base);
    taxTotal = roundMoney(taxTotal + tax);

    return {
      ...line,
      id: createUuid(),
      discountRate,
      description: line.description.trim(),
      lineTotal: roundMoney(base + tax),
    };
  });

  return {
    lines,
    subtotal,
    taxTotal,
    grandTotal: roundMoney(subtotal + taxTotal),
  };
}

export function txAddCatalogueItem(
  state: ErpDatabaseState,
  scope: TransactionScope,
  input: Omit<
    CatalogueItem,
    'id' | 'companyId' | 'reservedQty' | 'inventoryAssetValue' | 'version' | 'createdAt'
  >,
): { nextState: ErpDatabaseState; item: CatalogueItem } {
    const res = runAtomicTransaction(state, (draft) => {
      const skuNorm = input.sku.trim().toUpperCase();
      if (!skuNorm || !input.name.trim()) {
        throw new ErpDomainError('INVALID_ITEM', 'SKU and item name are required.');
      }
      const duplicateSku = draft.catalogue.find(
        (i) => i.companyId === scope.companyId && i.sku.toUpperCase() === skuNorm,
      );
      if (duplicateSku) {
        throw new ErpDomainError('DUPLICATE_SKU', `SKU "${skuNorm}" already exists in catalogue.`);
      }

      const openingQty = input.trackStock ? Math.max(0, input.stockOnHand) : 0;
      const unitCost = roundMoney(Math.max(0, input.costPrice));
      const openingValue = roundMoney(openingQty * unitCost);
      const createdAt = nowIso();

      const item: CatalogueItem = {
        ...input,
        id: createUuid(),
        companyId: scope.companyId,
        sku: skuNorm,
        name: input.name.trim(),
        costPrice: unitCost,
        sellingPrice: roundMoney(Math.max(0, input.sellingPrice)),
        stockOnHand: openingQty,
        reservedQty: 0,
        inventoryAssetValue: openingValue,
        version: 1,
        createdAt,
      };

      let nextState: ErpDatabaseState = {
        ...draft,
        catalogue: [item, ...draft.catalogue],
      };

      if (item.trackStock && openingQty > 0) {
        const lot: InventoryLot = {
          id: createUuid(),
          companyId: scope.companyId,
          branchId: scope.branchId,
          itemId: item.id,
          batchNumber: `OPEN-${item.sku}`,
          serialNumbers: [],
          qtyReceived: openingQty,
          qtyRemaining: openingQty,
          unitCost,
          receiptReference: 'OPENING-STOCK',
          createdAt,
        };
        const movement: StockMovement = {
          id: createUuid(),
          companyId: scope.companyId,
          branchId: scope.branchId,
          itemId: item.id,
          itemName: item.name,
          sku: item.sku,
          direction: 'in',
          movementType: 'opening',
          quantity: openingQty,
          unitCost,
          totalValue: openingValue,
          balanceAfter: openingQty,
          reservedAfter: 0,
          batchNumber: lot.batchNumber,
          reference: 'OPENING-STOCK',
          idempotencyKey: `opening:${item.id}`,
          reason: 'Initial opening stock balance',
          createdAt,
        };

        nextState = {
          ...nextState,
          inventoryLots: [lot, ...nextState.inventoryLots],
          stockMovements: [movement, ...nextState.stockMovements],
        };

        if (openingValue > 0) {
          const jRes = postJournalEntry(nextState, {
            companyId: scope.companyId,
            branchId: scope.branchId,
            date: createdAt.slice(0, 10),
            reference: `OPEN-${item.sku}`,
            description: `Opening inventory valuation for ${item.sku}`,
            sourceModule: 'inventory',
            sourceId: item.id,
            idempotencyKey: `opening-journal:${item.id}`,
            lines: [
              { accountCode: '1300', debit: openingValue, credit: 0, memo: 'Opening inventory asset' },
              { accountCode: '3000', debit: 0, credit: openingValue, memo: 'Opening equity offset' },
            ],
          });
          nextState = jRes.nextState;
        }
      }

      nextState = appendAuditLog(nextState, scope, {
        action: 'catalogue.item.create',
        resourceType: 'catalogue_item',
        resourceId: item.id,
        outcome: 'success',
        details: `Created SKU ${item.sku} (${item.name})`,
      });

      return { nextState, result: item };
    });

    return { nextState: res.nextState, item: res.result };
}

function reserveStockForOrder(
  state: ErpDatabaseState,
  scope: TransactionScope,
  order: SalesOrder,
): ErpDatabaseState {
  let nextState = state;
  for (const line of order.lines) {
    if (!line.itemId) continue;
    const item = nextState.catalogue.find(
      (c) => c.id === line.itemId && c.companyId === scope.companyId,
    );
    if (!item || !item.trackStock) continue;

    const alreadyReserved = nextState.stockReservations.some(
      (r) =>
        r.companyId === scope.companyId &&
        r.orderId === order.id &&
        r.itemId === item.id &&
        r.status === 'active',
    );
    if (alreadyReserved) continue;

    const available = item.stockOnHand - item.reservedQty;
    if (available < line.quantity) {
      throw new ErpDomainError(
        'INSUFFICIENT_AVAILABLE_STOCK',
        `Insufficient available stock to reserve ${line.quantity} of ${item.sku} (available: ${available}).`,
      );
    }

    const reservation: StockReservation = {
      id: createUuid(),
      companyId: scope.companyId,
      itemId: item.id,
      orderId: order.id,
      documentNumber: order.documentNumber,
      quantity: line.quantity,
      status: 'active',
      createdAt: nowIso(),
    };

    const nextReserved = item.reservedQty + line.quantity;
    const movement: StockMovement = {
      id: createUuid(),
      companyId: scope.companyId,
      branchId: scope.branchId,
      itemId: item.id,
      itemName: item.name,
      sku: item.sku,
      direction: 'adjustment',
      movementType: 'reservation',
      quantity: line.quantity,
      unitCost: item.costPrice,
      totalValue: roundMoney(line.quantity * item.costPrice),
      balanceAfter: item.stockOnHand,
      reservedAfter: nextReserved,
      reference: order.documentNumber,
      idempotencyKey: `reserve:${order.id}:${item.id}`,
      reason: `Stock reserved for ${order.documentNumber}`,
      createdAt: nowIso(),
    };

    nextState = {
      ...nextState,
      catalogue: nextState.catalogue.map((c) =>
        c.id === item.id ? { ...c, reservedQty: nextReserved, version: c.version + 1 } : c,
      ),
      stockReservations: [reservation, ...nextState.stockReservations],
      stockMovements: [movement, ...nextState.stockMovements],
    };
  }
  return nextState;
}

function postSalesRecognitionJournal(
  state: ErpDatabaseState,
  scope: TransactionScope,
  order: SalesOrder,
): { nextState: ErpDatabaseState; journalId: string } {
  if (order.invoiceJournalId || order.ledgerPosted) {
    throw new ErpDomainError(
      'DUPLICATE_INVOICE_POSTING',
      `Invoice ${order.documentNumber} has already been posted to Accounting.`,
    );
  }
  if (order.grandTotal <= 0) {
    throw new ErpDomainError(
      'ZERO_INVOICE_TOTAL',
      `Invoice ${order.documentNumber} total must be greater than zero to post.`,
    );
  }

  const lines: DraftJournalLine[] = [
    {
      accountCode: '1200',
      debit: order.grandTotal,
      credit: 0,
      memo: `AR for ${order.documentNumber} (${order.customerName})`,
    },
    {
      accountCode: '4000',
      debit: 0,
      credit: order.subtotal,
      memo: `Sales revenue for ${order.documentNumber}`,
    },
  ];
  if (order.taxTotal > 0) {
    lines.push({
      accountCode: '2200',
      debit: 0,
      credit: order.taxTotal,
      memo: `Output tax liability for ${order.documentNumber}`,
    });
  }

  const jRes = postJournalEntry(state, {
    companyId: scope.companyId,
    branchId: scope.branchId,
    date: order.issueDate,
    reference: order.documentNumber,
    description: `Sales invoice recognized: ${order.customerName}`,
    sourceModule: 'sales',
    sourceId: order.id,
    idempotencyKey: `sales-invoice-accrual:${order.id}`,
    lines,
  });

  const nextState: ErpDatabaseState = {
    ...jRes.nextState,
    salesOrders: jRes.nextState.salesOrders.map((o) =>
      o.id === order.id
        ? { ...o, ledgerPosted: true, invoiceJournalId: jRes.journal.id }
        : o,
    ),
  };

  return { nextState, journalId: jRes.journal.id };
}

export function txDispatchSalesOrder(
  state: ErpDatabaseState,
  scope: TransactionScope,
  input: {
    orderId: string;
    dispatchDate?: string;
    serialOverrides?: Record<string, string[]>;
  },
): { nextState: ErpDatabaseState; order: SalesOrder } {
  const { nextState, result } = runAtomicTransaction(state, (draft) => {
    const order = draft.salesOrders.find(
      (o) => o.id === input.orderId && o.companyId === scope.companyId,
    );
    if (!order) {
      throw new ErpDomainError('ORDER_NOT_FOUND', 'Sales order not found in active company.');
    }
    if (order.documentType !== 'invoice') {
      throw new ErpDomainError('INVALID_DISPATCH', 'Cannot dispatch a quotation. Convert to invoice first.');
    }
    if (order.status === 'cancelled') {
      throw new ErpDomainError('INVALID_DISPATCH', 'Cannot dispatch a cancelled invoice.');
    }
    if (order.fulfillmentStatus === 'dispatched' || order.stockPosted) {
      throw new ErpDomainError(
        'DUPLICATE_DISPATCH',
        `Goods for ${order.documentNumber} have already been dispatched.`,
      );
    }

    const dispatchDate = input.dispatchDate || new Date().toISOString().slice(0, 10);
    const seqRes = nextSequenceNumber(draft, scope.companyId, 'DN', 4);
    let nextState = seqRes.nextState;
    const dispatchRef = seqRes.formatted;
    let totalCogs = 0;

    for (const line of order.lines) {
      if (!line.itemId) continue;
      const item = nextState.catalogue.find(
        (c) => c.id === line.itemId && c.companyId === scope.companyId,
      );
      if (!item || !item.trackStock) continue;

      const idempKey = `dispatch:${order.id}:${item.id}:${line.id}`;
      if (
        nextState.stockMovements.some(
          (m) => m.companyId === scope.companyId && m.idempotencyKey === idempKey,
        )
      ) {
        throw new ErpDomainError(
          'DUPLICATE_STOCK_MOVEMENT',
          `Duplicate dispatch movement detected for ${item.sku}.`,
        );
      }

      if (item.stockOnHand < line.quantity) {
        throw new ErpDomainError(
          'INSUFFICIENT_STOCK',
          `Cannot dispatch ${line.quantity} of ${item.sku}: only ${item.stockOnHand} on hand.`,
        );
      }

      const activeReservation = nextState.stockReservations.find(
        (r) =>
          r.companyId === scope.companyId &&
          r.orderId === order.id &&
          r.itemId === item.id &&
          r.status === 'active',
      );
      const releaseQty = activeReservation ? Math.min(activeReservation.quantity, item.reservedQty) : 0;
      const nextReserved = Math.max(0, item.reservedQty - releaseQty);

      const unitCost =
        item.stockOnHand > 0 && item.inventoryAssetValue > 0
          ? roundMoney(item.inventoryAssetValue / item.stockOnHand)
          : item.costPrice;
      const lineCogs = roundMoney(line.quantity * unitCost);
      totalCogs = roundMoney(totalCogs + lineCogs);

      const nextQty = item.stockOnHand - line.quantity;
      const nextAssetValue = nextQty === 0 ? 0 : roundMoney(Math.max(0, item.inventoryAssetValue - lineCogs));

      // Consume FIFO from available inventory lots
      let remainingToConsume = line.quantity;
      const updatedLots = nextState.inventoryLots.map((lot) => {
        if (
          remainingToConsume <= 0 ||
          lot.companyId !== scope.companyId ||
          lot.itemId !== item.id ||
          lot.qtyRemaining <= 0
        ) {
          return lot;
        }
        const take = Math.min(lot.qtyRemaining, remainingToConsume);
        remainingToConsume -= take;
        return { ...lot, qtyRemaining: lot.qtyRemaining - take };
      });

      const movement: StockMovement = {
        id: createUuid(),
        companyId: scope.companyId,
        branchId: scope.branchId,
        itemId: item.id,
        itemName: item.name,
        sku: item.sku,
        direction: 'out',
        movementType: 'dispatch',
        quantity: line.quantity,
        unitCost,
        totalValue: lineCogs,
        balanceAfter: nextQty,
        reservedAfter: nextReserved,
        serialNumbers: input.serialOverrides?.[item.id],
        reference: dispatchRef,
        idempotencyKey: idempKey,
        reason: `Dispatched ${order.documentNumber} to ${order.customerName}`,
        createdAt: nowIso(),
      };

      nextState = {
        ...nextState,
        catalogue: nextState.catalogue.map((c) =>
          c.id === item.id
            ? {
                ...c,
                stockOnHand: nextQty,
                reservedQty: nextReserved,
                inventoryAssetValue: nextAssetValue,
                version: c.version + 1,
              }
            : c,
        ),
        inventoryLots: updatedLots,
        stockReservations: nextState.stockReservations.map((r) =>
          r.companyId === scope.companyId &&
          r.orderId === order.id &&
          r.itemId === item.id &&
          r.status === 'active'
            ? { ...r, status: 'fulfilled' }
            : r,
        ),
        stockMovements: [movement, ...nextState.stockMovements],
      };
    }

    let cogsJournalId: string | undefined;
    if (totalCogs > 0) {
      const cogsRes = postJournalEntry(nextState, {
        companyId: scope.companyId,
        branchId: scope.branchId,
        date: dispatchDate,
        reference: dispatchRef,
        description: `COGS & inventory reduction for ${order.documentNumber}`,
        sourceModule: 'inventory',
        sourceId: order.id,
        idempotencyKey: `sales-cogs:${order.id}`,
        lines: [
          {
            accountCode: '5000',
            debit: totalCogs,
            credit: 0,
            memo: `COGS for ${order.documentNumber}`,
          },
          {
            accountCode: '1300',
            debit: 0,
            credit: totalCogs,
            memo: `Inventory dispatched (${dispatchRef})`,
          },
        ],
      });
      nextState = cogsRes.nextState;
      cogsJournalId = cogsRes.journal.id;
    }

    const updatedOrder: SalesOrder = {
      ...order,
      fulfillmentStatus: 'dispatched',
      stockPosted: true,
      dispatchRef,
      dispatchedAt: dispatchDate,
      cogsJournalId,
    };

    nextState = {
      ...nextState,
      salesOrders: nextState.salesOrders.map((o) =>
        o.id === order.id ? updatedOrder : o,
      ),
    };

    nextState = appendAuditLog(nextState, scope, {
      action: 'sales.order.dispatch',
      resourceType: 'sales_order',
      resourceId: order.id,
      outcome: 'success',
      details: `Dispatched ${order.documentNumber} (${dispatchRef}), COGS=${totalCogs}`,
    });

    return { nextState, result: updatedOrder };
  });

  return { nextState, order: result };
}

export function txRecordSalesPayment(
  state: ErpDatabaseState,
  scope: TransactionScope,
  input: {
    orderId: string;
    amount: number;
    paymentDate: string;
    method?: PaymentAllocation['method'];
    reference?: string;
  },
): { nextState: ErpDatabaseState; allocation: PaymentAllocation } {
  const { nextState, result } = runAtomicTransaction(state, (draft) => {
    const order = draft.salesOrders.find(
      (o) => o.id === input.orderId && o.companyId === scope.companyId,
    );
    if (!order) {
      throw new ErpDomainError('ORDER_NOT_FOUND', 'Sales order not found.');
    }
    if (order.documentType !== 'invoice') {
      throw new ErpDomainError('INVALID_PAYMENT', 'Cannot allocate payment to a quotation.');
    }
    if (order.status === 'cancelled') {
      throw new ErpDomainError('INVALID_PAYMENT', 'Cannot allocate payment to a cancelled invoice.');
    }

    const amount = roundMoney(input.amount);
    if (amount <= 0) {
      throw new ErpDomainError('INVALID_PAYMENT_AMOUNT', 'Payment amount must be greater than zero.');
    }

    const remaining = roundMoney(order.grandTotal - order.amountPaid);
    if (amount > remaining + 0.005) {
      throw new ErpDomainError(
        'OVERPAYMENT',
        `Payment (${amount.toFixed(2)}) exceeds remaining balance (${remaining.toFixed(2)}).`,
      );
    }

    let nextState = draft;
    if (!order.ledgerPosted) {
      nextState = postSalesRecognitionJournal(nextState, scope, order).nextState;
    }

    const seqRes = nextSequenceNumber(nextState, scope.companyId, 'RCPT', 4);
    nextState = seqRes.nextState;
    const payRef = input.reference?.trim() || seqRes.formatted;

    const jRes = postJournalEntry(nextState, {
      companyId: scope.companyId,
      branchId: scope.branchId,
      date: input.paymentDate,
      reference: payRef,
      description: `Customer payment allocated to ${order.documentNumber} (${order.customerName})`,
      sourceModule: 'sales',
      sourceId: order.id,
      idempotencyKey: `sales-payment:${order.id}:${payRef}`,
      lines: [
        {
          accountCode: '1000',
          debit: amount,
          credit: 0,
          memo: `Payment received via ${input.method || 'bank'}`,
        },
        {
          accountCode: '1200',
          debit: 0,
          credit: amount,
          memo: `AR settled for ${order.documentNumber}`,
        },
      ],
    });
    nextState = jRes.nextState;

    const allocation: PaymentAllocation = {
      id: createUuid(),
      companyId: scope.companyId,
      branchId: scope.branchId,
      paymentDate: input.paymentDate,
      direction: 'inbound',
      orderId: order.id,
      documentNumber: order.documentNumber,
      counterpartyName: order.customerName,
      amount,
      method: input.method || 'bank',
      journalId: jRes.journal.id,
      reference: payRef,
      createdAt: nowIso(),
    };

    const nextAmountPaid = roundMoney(order.amountPaid + amount);
    const nextStatus: SalesStatus =
      nextAmountPaid >= order.grandTotal - 0.005 ? 'paid' : 'sent';

    nextState = {
      ...nextState,
      paymentAllocations: [allocation, ...nextState.paymentAllocations],
      salesOrders: nextState.salesOrders.map((o) =>
        o.id === order.id
          ? {
              ...o,
              amountPaid: nextAmountPaid,
              status: nextStatus,
            }
          : o,
      ),
    };

    nextState = appendAuditLog(nextState, scope, {
      action: 'sales.payment.allocate',
      resourceType: 'payment_allocation',
      resourceId: allocation.id,
      outcome: 'success',
      details: `Allocated ${amount.toFixed(2)} to ${order.documentNumber}`,
    });

    return { nextState, result: allocation };
  });

  return { nextState, allocation: result };
}

export function txCreateSalesOrder(
  state: ErpDatabaseState,
  scope: TransactionScope,
  input: {
    documentType: 'invoice' | 'quote';
    customerId?: string;
    customerName: string;
    issueDate: string;
    dueDate: string;
    status: SalesStatus;
    lines: Array<Omit<OrderLineItem, 'id' | 'lineTotal'>>;
    notes: string;
    isImmediatePosSale?: boolean;
    paymentMethod?: PaymentAllocation['method'];
    salesperson?: string;
    commissionRate?: number;
    isRecurring?: boolean;
    recurringInterval?: 'monthly' | 'quarterly' | 'annual';
    isDropShip?: boolean;
    channel?: 'direct' | 'pos' | 'ecommerce';
  },
): { nextState: ErpDatabaseState; order: SalesOrder } {
  const { nextState, result } = runAtomicTransaction(state, (draft) => {
    if (!input.customerName.trim()) {
      throw new ErpDomainError('INVALID_CUSTOMER', 'Customer name is required.');
    }

    const totals = computeOrderTotals(input.lines);
    const prefix = input.documentType === 'quote' ? 'QT' : 'INV';
    const seqRes = nextSequenceNumber(draft, scope.companyId, prefix, 4);

    let order: SalesOrder = {
      id: createUuid(),
      companyId: scope.companyId,
      branchId: scope.branchId,
      documentNumber: seqRes.formatted,
      documentType: input.documentType,
      customerId: input.customerId,
      customerName: input.customerName.trim(),
      issueDate: input.issueDate,
      dueDate: input.dueDate,
      status: input.status,
      fulfillmentStatus: 'pending',
      lines: totals.lines,
      subtotal: totals.subtotal,
      taxTotal: totals.taxTotal,
      grandTotal: totals.grandTotal,
      amountPaid: 0,
      notes: input.notes,
      stockPosted: false,
      ledgerPosted: false,
      salesperson: input.salesperson?.trim() || undefined,
      commissionRate: input.commissionRate,
      isRecurring: input.isRecurring,
      recurringInterval: input.recurringInterval,
      isDropShip: input.isDropShip,
      channel: input.channel ?? (input.isImmediatePosSale ? 'pos' : 'direct'),
      createdAt: nowIso(),
    };

    let nextState: ErpDatabaseState = {
      ...seqRes.nextState,
      salesOrders: [order, ...seqRes.nextState.salesOrders],
    };

    if (order.documentType === 'invoice' && (order.status === 'sent' || order.status === 'paid')) {
      const rec = postSalesRecognitionJournal(nextState, scope, order);
      nextState = rec.nextState;

      if (!input.isImmediatePosSale && !input.isDropShip) {
        nextState = reserveStockForOrder(nextState, scope, order);
        const hasTrackedItems = order.lines.some((l) => {
          const item = nextState.catalogue.find((c) => c.id === l.itemId);
          return Boolean(item?.trackStock);
        });
        if (hasTrackedItems) {
          nextState = {
            ...nextState,
            salesOrders: nextState.salesOrders.map((o) =>
              o.id === order.id ? { ...o, fulfillmentStatus: 'reserved' } : o,
            ),
          };
        }
      }

      if (order.status === 'paid') {
        const payMethod = input.paymentMethod ?? (input.isImmediatePosSale ? 'cash' : 'bank');
        const payRes = txRecordSalesPayment(nextState, scope, {
          orderId: order.id,
          amount: order.grandTotal,
          paymentDate: order.issueDate,
          method: payMethod,
          reference: `${order.documentNumber}-SETTLE`,
        });
        nextState = payRes.nextState;

        if (input.isImmediatePosSale) {
          const openShift = nextState.posShifts.find(
            (s) => s.companyId === scope.companyId && s.status === 'open',
          );
          if (openShift) {
            const isCash = payMethod === 'cash';
            const cashSalesTotal = roundMoney(openShift.cashSalesTotal + (isCash ? order.grandTotal : 0));
            const cardUpiSalesTotal = roundMoney(openShift.cardUpiSalesTotal + (isCash ? 0 : order.grandTotal));
            nextState = {
              ...nextState,
              posShifts: nextState.posShifts.map((s) =>
                s.id === openShift.id
                  ? {
                      ...s,
                      cashSalesTotal,
                      cardUpiSalesTotal,
                      expectedCash: roundMoney(openShift.openingCash + cashSalesTotal),
                    }
                  : s,
              ),
            };
          }
          if (input.customerId) {
            const earnedPts = Math.floor(order.grandTotal / 100);
            if (earnedPts > 0) {
              nextState = {
                ...nextState,
                contacts: nextState.contacts.map((c) =>
                  c.id === input.customerId
                    ? { ...c, loyaltyPoints: (c.loyaltyPoints ?? 0) + earnedPts }
                    : c,
                ),
              };
            }
          }
        }
      }

      if (input.isImmediatePosSale) {
        const dispRes = txDispatchSalesOrder(nextState, scope, {
          orderId: order.id,
          dispatchDate: order.issueDate,
        });
        nextState = dispRes.nextState;
      }
    }

    order = nextState.salesOrders.find((o) => o.id === order.id)!;
    nextState = appendAuditLog(nextState, scope, {
      action: 'sales.order.create',
      resourceType: 'sales_order',
      resourceId: order.id,
      outcome: 'success',
      details: `Created ${order.documentNumber} (${order.status}) for ${order.customerName}`,
    });

    return { nextState, result: order };
  });

  return { nextState, order: result };
}

export function txUpdateSalesStatus(
  state: ErpDatabaseState,
  scope: TransactionScope,
  orderId: string,
  nextStatus: SalesStatus,
): ErpDatabaseState {
  return runAtomicTransaction(state, (draft) => {
    const order = draft.salesOrders.find(
      (o) => o.id === orderId && o.companyId === scope.companyId,
    );
    if (!order) {
      throw new ErpDomainError('ORDER_NOT_FOUND', 'Sales order not found.');
    }
    if (order.status === nextStatus) {
      return { nextState: draft, result: undefined };
    }
    if (order.status === 'cancelled') {
      throw new ErpDomainError(
        'IMMUTABLE_CANCELLED_ORDER',
        'Cancelled orders cannot be reactivated. Create a new order instead.',
      );
    }
    if (order.ledgerPosted && nextStatus === 'draft') {
      throw new ErpDomainError(
        'CANNOT_REVERT_POSTED_INVOICE',
        `Invoice ${order.documentNumber} is already posted to Accounting. Reverse the journal instead of reverting to draft.`,
      );
    }

    let nextState: ErpDatabaseState = {
      ...draft,
      salesOrders: draft.salesOrders.map((o) =>
        o.id === order.id ? { ...o, status: nextStatus } : o,
      ),
    };

    const currentOrder = nextState.salesOrders.find((o) => o.id === order.id)!;

    if (currentOrder.documentType === 'invoice') {
      if ((nextStatus === 'sent' || nextStatus === 'paid') && !currentOrder.ledgerPosted) {
        nextState = postSalesRecognitionJournal(nextState, scope, currentOrder).nextState;
        if (currentOrder.fulfillmentStatus === 'pending') {
          nextState = reserveStockForOrder(nextState, scope, currentOrder);
          const hasTracked = currentOrder.lines.some(
            (l) => nextState.catalogue.find((c) => c.id === l.itemId)?.trackStock,
          );
          if (hasTracked) {
            nextState = {
              ...nextState,
              salesOrders: nextState.salesOrders.map((o) =>
                o.id === order.id ? { ...o, fulfillmentStatus: 'reserved' } : o,
              ),
            };
          }
        }
      }

      if (nextStatus === 'paid') {
        const refreshed = nextState.salesOrders.find((o) => o.id === order.id)!;
        const remaining = roundMoney(refreshed.grandTotal - refreshed.amountPaid);
        if (remaining > 0) {
          nextState = txRecordSalesPayment(nextState, scope, {
            orderId: refreshed.id,
            amount: remaining,
            paymentDate: new Date().toISOString().slice(0, 10),
            method: 'bank',
          }).nextState;
        }
      }

      if (nextStatus === 'cancelled') {
        // Release active stock reservations if not yet dispatched
        nextState = releaseReservationsForOrder(nextState, scope, currentOrder);
      }
    }

    return { nextState, result: undefined };
  }).nextState;
}

function releaseReservationsForOrder(
  state: ErpDatabaseState,
  scope: TransactionScope,
  order: SalesOrder,
): ErpDatabaseState {
  let nextState = state;
  const activeReservations = nextState.stockReservations.filter(
    (r) =>
      r.companyId === scope.companyId &&
      r.orderId === order.id &&
      r.status === 'active',
  );
  for (const res of activeReservations) {
    const item = nextState.catalogue.find((c) => c.id === res.itemId);
    if (!item) continue;
    const nextReserved = Math.max(0, item.reservedQty - res.quantity);
    const movement: StockMovement = {
      id: createUuid(),
      companyId: scope.companyId,
      branchId: scope.branchId,
      itemId: item.id,
      itemName: item.name,
      sku: item.sku,
      direction: 'adjustment',
      movementType: 'release',
      quantity: res.quantity,
      unitCost: item.costPrice,
      totalValue: 0,
      balanceAfter: item.stockOnHand,
      reservedAfter: nextReserved,
      reference: order.documentNumber,
      idempotencyKey: `release:${order.id}:${res.id}`,
      reason: `Released reservation on cancellation of ${order.documentNumber}`,
      createdAt: nowIso(),
    };
    nextState = {
      ...nextState,
      catalogue: nextState.catalogue.map((c) =>
        c.id === item.id ? { ...c, reservedQty: nextReserved, version: c.version + 1 } : c,
      ),
      stockReservations: nextState.stockReservations.map((r) =>
        r.id === res.id ? { ...r, status: 'released' } : r,
      ),
      stockMovements: [movement, ...nextState.stockMovements],
    };
  }
  return nextState;
}

export function txReceivePurchaseOrder(
  state: ErpDatabaseState,
  scope: TransactionScope,
  input: {
    orderId: string;
    receiptDate?: string;
    batchNumber?: string;
    serialNumbers?: string[];
    expiryDate?: string;
  },
): { nextState: ErpDatabaseState; order: PurchaseOrder } {
  const { nextState, result } = runAtomicTransaction(state, (draft) => {
    const order = draft.purchaseOrders.find(
      (o) => o.id === input.orderId && o.companyId === scope.companyId,
    );
    if (!order) {
      throw new ErpDomainError('PO_NOT_FOUND', 'Purchase order not found.');
    }
    if (order.status === 'cancelled') {
      throw new ErpDomainError('INVALID_RECEIPT', 'Cannot receive a cancelled purchase order.');
    }
    if (order.stockPosted || order.ledgerPosted || order.status === 'received') {
      throw new ErpDomainError(
        'DUPLICATE_PURCHASE_RECEIPT',
        `Purchase Order ${order.documentNumber} has already been received and posted.`,
      );
    }

    const receiptDate = input.receiptDate || order.orderDate;
    const seqRes = nextSequenceNumber(draft, scope.companyId, 'GRN', 4);
    let nextState = seqRes.nextState;
    const receiptRef = seqRes.formatted;

    let stockedCostTotal = 0;
    let nonStockExpenseTotal = 0;

    for (const line of order.lines) {
      const lineBase = roundMoney(line.quantity * line.unitPrice);
      const item = line.itemId
        ? nextState.catalogue.find(
            (c) => c.id === line.itemId && c.companyId === scope.companyId,
          )
        : undefined;

      if (item && item.trackStock) {
        const idempKey = `receipt:${order.id}:${item.id}:${line.id}`;
        if (
          nextState.stockMovements.some(
            (m) => m.companyId === scope.companyId && m.idempotencyKey === idempKey,
          )
        ) {
          throw new ErpDomainError(
            'DUPLICATE_STOCK_MOVEMENT',
            `Duplicate receipt movement detected for ${item.sku}.`,
          );
        }

        stockedCostTotal = roundMoney(stockedCostTotal + lineBase);
        const nextQty = item.stockOnHand + line.quantity;
        const nextAssetValue = roundMoney(item.inventoryAssetValue + lineBase);
        const weightedCost = nextQty > 0 ? roundMoney(nextAssetValue / nextQty) : line.unitPrice;
        const batchNo = input.batchNumber?.trim() || `${receiptRef}-${item.sku}`;

        const lot: InventoryLot = {
          id: createUuid(),
          companyId: scope.companyId,
          branchId: scope.branchId,
          itemId: item.id,
          batchNumber: batchNo,
          serialNumbers: input.serialNumbers ?? [],
          expiryDate: input.expiryDate,
          qtyReceived: line.quantity,
          qtyRemaining: line.quantity,
          unitCost: line.unitPrice,
          receiptReference: receiptRef,
          createdAt: nowIso(),
        };

        const movement: StockMovement = {
          id: createUuid(),
          companyId: scope.companyId,
          branchId: scope.branchId,
          itemId: item.id,
          itemName: item.name,
          sku: item.sku,
          direction: 'in',
          movementType: 'receipt',
          quantity: line.quantity,
          unitCost: line.unitPrice,
          totalValue: lineBase,
          balanceAfter: nextQty,
          reservedAfter: item.reservedQty,
          batchNumber: batchNo,
          serialNumbers: input.serialNumbers,
          reference: receiptRef,
          idempotencyKey: idempKey,
          reason: `Goods received on ${order.documentNumber} (${order.vendorName})`,
          createdAt: nowIso(),
        };

        nextState = {
          ...nextState,
          catalogue: nextState.catalogue.map((c) =>
            c.id === item.id
              ? {
                  ...c,
                  stockOnHand: nextQty,
                  costPrice: weightedCost,
                  inventoryAssetValue: nextAssetValue,
                  version: c.version + 1,
                }
              : c,
          ),
          inventoryLots: [lot, ...nextState.inventoryLots],
          stockMovements: [movement, ...nextState.stockMovements],
        };
      } else {
        nonStockExpenseTotal = roundMoney(nonStockExpenseTotal + lineBase);
      }
    }

    const journalLines: DraftJournalLine[] = [];
    if (stockedCostTotal > 0) {
      journalLines.push({
        accountCode: '1300',
        debit: stockedCostTotal,
        credit: 0,
        memo: `Inventory received (${receiptRef})`,
      });
    }
    if (nonStockExpenseTotal > 0) {
      journalLines.push({
        accountCode: '5300',
        debit: nonStockExpenseTotal,
        credit: 0,
        memo: `Non-stock procurement (${order.documentNumber})`,
      });
    }
    if (order.taxTotal > 0) {
      journalLines.push({
        accountCode: '1400',
        debit: order.taxTotal,
        credit: 0,
        memo: `Input tax credit for ${order.documentNumber}`,
      });
    }
    journalLines.push({
      accountCode: '2100',
      debit: 0,
      credit: order.grandTotal,
      memo: `Accounts Payable: ${order.vendorName} (${order.documentNumber})`,
    });

    const jRes = postJournalEntry(nextState, {
      companyId: scope.companyId,
      branchId: scope.branchId,
      date: receiptDate,
      reference: receiptRef,
      description: `Goods receipt ${order.documentNumber} from ${order.vendorName}`,
      sourceModule: 'purchase',
      sourceId: order.id,
      idempotencyKey: `purchase-receipt:${order.id}`,
      lines: journalLines,
    });
    nextState = jRes.nextState;

    const updatedOrder: PurchaseOrder = {
      ...order,
      status: 'received',
      stockPosted: true,
      ledgerPosted: true,
      receiptJournalId: jRes.journal.id,
      receiptRef,
      receivedAt: receiptDate,
    };

    nextState = {
      ...nextState,
      purchaseOrders: nextState.purchaseOrders.map((o) =>
        o.id === order.id ? updatedOrder : o,
      ),
    };

    nextState = appendAuditLog(nextState, scope, {
      action: 'purchase.order.receive',
      resourceType: 'purchase_order',
      resourceId: order.id,
      outcome: 'success',
      details: `Received ${order.documentNumber} (${receiptRef}) for ${order.grandTotal.toFixed(2)}`,
    });

    return { nextState, result: updatedOrder };
  });

  return { nextState, order: result };
}

export function txCreatePurchaseOrder(
  state: ErpDatabaseState,
  scope: TransactionScope,
  input: {
    vendorId?: string;
    vendorName: string;
    orderDate: string;
    expectedDate: string;
    status: PurchaseStatus;
    lines: Array<Omit<OrderLineItem, 'id' | 'lineTotal'>>;
    notes: string;
    approvedBy?: string;
  },
): { nextState: ErpDatabaseState; order: PurchaseOrder } {
  const { nextState, result } = runAtomicTransaction(state, (draft) => {
    if (!input.vendorName.trim()) {
      throw new ErpDomainError('INVALID_VENDOR', 'Vendor name is required.');
    }
    const totals = computeOrderTotals(input.lines);

    const triggeredRule = draft.approvalRules.find(
      (r) =>
        r.companyId === scope.companyId &&
        r.active &&
        r.module === 'purchase' &&
        totals.grandTotal >= r.minAmount,
    );
    const needsApproval = Boolean(triggeredRule && !input.approvedBy);

    const seqRes = nextSequenceNumber(draft, scope.companyId, 'PO', 4);
    const created: PurchaseOrder = {
      id: createUuid(),
      companyId: scope.companyId,
      branchId: scope.branchId,
      documentNumber: seqRes.formatted,
      vendorId: input.vendorId,
      vendorName: input.vendorName.trim(),
      orderDate: input.orderDate,
      expectedDate: input.expectedDate,
      status: needsApproval ? 'draft' : input.status === 'received' ? 'ordered' : input.status,
      lines: totals.lines,
      subtotal: totals.subtotal,
      taxTotal: totals.taxTotal,
      grandTotal: totals.grandTotal,
      amountPaid: 0,
      notes: needsApproval
        ? `${input.notes ? `${input.notes} · ` : ''}Held by approval rule "${triggeredRule?.name}" (>= ${triggeredRule?.minAmount})`
        : input.notes,
      stockPosted: false,
      ledgerPosted: false,
      requiresApproval: needsApproval,
      approvedBy: input.approvedBy,
      createdAt: nowIso(),
    };

    let nextState: ErpDatabaseState = {
      ...seqRes.nextState,
      purchaseOrders: [created, ...seqRes.nextState.purchaseOrders],
    };

    if (input.status === 'received' && !needsApproval) {
      const recRes = txReceivePurchaseOrder(nextState, scope, {
        orderId: created.id,
        receiptDate: input.orderDate,
      });
      nextState = recRes.nextState;
    }

    const finalOrder = nextState.purchaseOrders.find((o) => o.id === created.id)!;
    return { nextState, result: finalOrder };
  });

  return { nextState, order: result };
}

export function txRecordPurchasePayment(
  state: ErpDatabaseState,
  scope: TransactionScope,
  input: {
    orderId: string;
    amount: number;
    paymentDate: string;
    method?: PaymentAllocation['method'];
    reference?: string;
  },
): { nextState: ErpDatabaseState; allocation: PaymentAllocation } {
  const { nextState, result } = runAtomicTransaction(state, (draft) => {
    const order = draft.purchaseOrders.find(
      (o) => o.id === input.orderId && o.companyId === scope.companyId,
    );
    if (!order) {
      throw new ErpDomainError('PO_NOT_FOUND', 'Purchase order not found.');
    }
    if (!order.ledgerPosted) {
      throw new ErpDomainError(
        'PO_NOT_RECEIVED',
        'Receive the purchase order before allocating supplier payment.',
      );
    }

    const amount = roundMoney(input.amount);
    const remaining = roundMoney(order.grandTotal - order.amountPaid);
    if (amount <= 0 || amount > remaining + 0.005) {
      throw new ErpDomainError(
        'INVALID_PAYMENT_AMOUNT',
        `Supplier payment (${amount.toFixed(2)}) must be > 0 and <= remaining (${remaining.toFixed(2)}).`,
      );
    }

    const seqRes = nextSequenceNumber(draft, scope.companyId, 'PAY', 4);
    const payRef = input.reference?.trim() || seqRes.formatted;

    const jRes = postJournalEntry(seqRes.nextState, {
      companyId: scope.companyId,
      branchId: scope.branchId,
      date: input.paymentDate,
      reference: payRef,
      description: `Vendor payment for ${order.documentNumber} (${order.vendorName})`,
      sourceModule: 'purchase',
      sourceId: order.id,
      idempotencyKey: `purchase-payment:${order.id}:${payRef}`,
      lines: [
        { accountCode: '2100', debit: amount, credit: 0, memo: `AP settled for ${order.documentNumber}` },
        { accountCode: '1000', debit: 0, credit: amount, memo: `Paid via ${input.method || 'bank'}` },
      ],
    });

    const allocation: PaymentAllocation = {
      id: createUuid(),
      companyId: scope.companyId,
      branchId: scope.branchId,
      paymentDate: input.paymentDate,
      direction: 'outbound',
      orderId: order.id,
      documentNumber: order.documentNumber,
      counterpartyName: order.vendorName,
      amount,
      method: input.method || 'bank',
      journalId: jRes.journal.id,
      reference: payRef,
      createdAt: nowIso(),
    };

    const nextState: ErpDatabaseState = {
      ...jRes.nextState,
      paymentAllocations: [allocation, ...jRes.nextState.paymentAllocations],
      purchaseOrders: jRes.nextState.purchaseOrders.map((o) =>
        o.id === order.id ? { ...o, amountPaid: roundMoney(o.amountPaid + amount) } : o,
      ),
    };

    return { nextState, result: allocation };
  });

  return { nextState, allocation: result };
}

export function txAdjustStock(
  state: ErpDatabaseState,
  scope: TransactionScope,
  input: {
    itemId: string;
    direction: 'in' | 'out' | 'adjustment';
    quantity: number;
    reason: string;
    expectedVersion?: number;
    batchNumber?: string;
    serialNumbers?: string[];
  },
): { nextState: ErpDatabaseState; item: CatalogueItem } {
  const { nextState, result } = runAtomicTransaction(state, (draft) => {
    const target = draft.catalogue.find(
      (i) => i.id === input.itemId && i.companyId === scope.companyId,
    );
    if (!target) {
      throw new ErpDomainError('ITEM_NOT_FOUND', 'Catalogue item not found in active company.');
    }
    if (!target.trackStock) {
      throw new ErpDomainError('NOT_STOCK_TRACKED', `Item ${target.sku} does not track inventory.`);
    }
    if (
      typeof input.expectedVersion === 'number' &&
      target.version !== input.expectedVersion
    ) {
      throw new ErpDomainError(
        'CONCURRENCY_CONFLICT',
        `Concurrent inventory update detected on ${target.sku} (expected v${input.expectedVersion}, found v${target.version}). Refresh and retry.`,
      );
    }
    if (!Number.isFinite(input.quantity) || input.quantity < 0) {
      throw new ErpDomainError('INVALID_QUANTITY', 'Stock quantity cannot be negative.');
    }

    const nextBalance =
      input.direction === 'in'
        ? target.stockOnHand + input.quantity
        : input.direction === 'out'
          ? target.stockOnHand - input.quantity
          : input.quantity;

    if (nextBalance < 0) {
      throw new ErpDomainError(
        'INSUFFICIENT_STOCK',
        `Cannot reduce ${target.sku} below 0 (current balance: ${target.stockOnHand}).`,
      );
    }
    if (nextBalance < target.reservedQty) {
      throw new ErpDomainError(
        'STOCK_BELOW_RESERVED',
        `Cannot adjust ${target.sku} below active reservations (${target.reservedQty}).`,
      );
    }

    const deltaQty = nextBalance - target.stockOnHand;
    const unitCost =
      target.stockOnHand > 0 && target.inventoryAssetValue > 0
        ? roundMoney(target.inventoryAssetValue / target.stockOnHand)
        : target.costPrice;
    const deltaValue = roundMoney(Math.abs(deltaQty) * unitCost);
    const nextAssetValue =
      nextBalance === 0
        ? 0
        : deltaQty >= 0
          ? roundMoney(target.inventoryAssetValue + deltaValue)
          : roundMoney(Math.max(0, target.inventoryAssetValue - deltaValue));

    const seqRes = nextSequenceNumber(draft, scope.companyId, 'ADJ', 4);
    let nextState = seqRes.nextState;
    const adjRef = seqRes.formatted;

    const movement: StockMovement = {
      id: createUuid(),
      companyId: scope.companyId,
      branchId: scope.branchId,
      itemId: target.id,
      itemName: target.name,
      sku: target.sku,
      direction: input.direction,
      movementType: 'adjustment',
      quantity: input.quantity,
      unitCost,
      totalValue: deltaValue,
      balanceAfter: nextBalance,
      reservedAfter: target.reservedQty,
      batchNumber: input.batchNumber,
      serialNumbers: input.serialNumbers,
      reference: adjRef,
      idempotencyKey: `adj:${adjRef}:${target.id}`,
      reason: input.reason.trim() || 'Manual inventory adjustment',
      createdAt: nowIso(),
    };

    const updatedItem: CatalogueItem = {
      ...target,
      stockOnHand: nextBalance,
      inventoryAssetValue: nextAssetValue,
      version: target.version + 1,
    };

    nextState = {
      ...nextState,
      catalogue: nextState.catalogue.map((i) => (i.id === target.id ? updatedItem : i)),
      stockMovements: [movement, ...nextState.stockMovements],
    };

    if (deltaValue > 0) {
      const lines: DraftJournalLine[] =
        deltaQty > 0
          ? [
              { accountCode: '1300', debit: deltaValue, credit: 0, memo: `Stock gain (${adjRef})` },
              { accountCode: '5400', debit: 0, credit: deltaValue, memo: `Inventory adjustment gain` },
            ]
          : [
              { accountCode: '5400', debit: deltaValue, credit: 0, memo: `Inventory shrinkage/adjustment (${adjRef})` },
              { accountCode: '1300', debit: 0, credit: deltaValue, memo: `Inventory reduction (${adjRef})` },
            ];

      nextState = postJournalEntry(nextState, {
        companyId: scope.companyId,
        branchId: scope.branchId,
        date: new Date().toISOString().slice(0, 10),
        reference: adjRef,
        description: `Inventory adjustment for ${target.sku}: ${movement.reason}`,
        sourceModule: 'inventory',
        sourceId: target.id,
        idempotencyKey: `adj-journal:${adjRef}`,
        lines,
      }).nextState;
    }

    nextState = appendAuditLog(nextState, scope, {
      action: 'inventory.stock.adjust',
      resourceType: 'catalogue_item',
      resourceId: target.id,
      outcome: 'success',
      details: `${target.sku}: ${target.stockOnHand} -> ${nextBalance} (${adjRef})`,
    });

    return { nextState, result: updatedItem };
  });

  return { nextState, item: result };
}

export function txRunMonthlyPayroll(
  state: ErpDatabaseState,
  scope: TransactionScope,
  input?: {
    periodKey?: string;
    paymentDate?: string;
    disburseCashImmediately?: boolean;
  },
): { nextState: ErpDatabaseState; payrollRun: PayrollRun } {
  const { nextState, result } = runAtomicTransaction(state, (draft) => {
    const paymentDate = input?.paymentDate || new Date().toISOString().slice(0, 10);
    const periodKey = input?.periodKey || paymentDate.slice(0, 7);

    const existingRun = draft.payrollRuns.find(
      (r) =>
        r.companyId === scope.companyId &&
        r.periodKey === periodKey &&
        r.status === 'posted',
    );
    if (existingRun) {
      throw new ErpDomainError(
        'DUPLICATE_PAYROLL_RUN',
        `Payroll for period ${periodKey} has already been posted (${existingRun.totalGross.toFixed(2)}).`,
      );
    }

    const activeEmployees = draft.employees.filter(
      (e) => e.companyId === scope.companyId && e.status === 'active',
    );
    const totalGross = roundMoney(
      activeEmployees.reduce((sum, e) => sum + e.monthlySalary, 0),
    );
    if (totalGross <= 0) {
      throw new ErpDomainError(
        'EMPTY_PAYROLL',
        'Add at least one active employee with monthly salary > 0 to run payroll.',
      );
    }

    const creditAccountCode = input?.disburseCashImmediately ? '1000' : '2300';
    const jRes = postJournalEntry(draft, {
      companyId: scope.companyId,
      branchId: scope.branchId,
      date: paymentDate,
      reference: `PAYROLL-${periodKey}`,
      description: `Monthly payroll run for ${activeEmployees.length} active employees (${periodKey})`,
      sourceModule: 'payroll',
      idempotencyKey: `payroll:${scope.companyId}:${periodKey}`,
      lines: [
        {
          accountCode: '5200',
          debit: totalGross,
          credit: 0,
          memo: `Gross salaries (${periodKey})`,
        },
        {
          accountCode: creditAccountCode,
          debit: 0,
          credit: totalGross,
          memo: input?.disburseCashImmediately
            ? 'Immediate bank disbursement'
            : 'Accrued payroll payable',
        },
      ],
    });

    const payrollRun: PayrollRun = {
      id: createUuid(),
      companyId: scope.companyId,
      branchId: scope.branchId,
      periodKey,
      employeeCount: activeEmployees.length,
      totalGross,
      journalId: jRes.journal.id,
      status: 'posted',
      createdAt: nowIso(),
    };

    let nextState: ErpDatabaseState = {
      ...jRes.nextState,
      payrollRuns: [payrollRun, ...jRes.nextState.payrollRuns],
    };

    nextState = appendAuditLog(nextState, scope, {
      action: 'hr.payroll.run',
      resourceType: 'payroll_run',
      resourceId: payrollRun.id,
      outcome: 'success',
      details: `Posted payroll ${periodKey} for ${activeEmployees.length} staff (${totalGross.toFixed(2)})`,
    });

    return { nextState, result: payrollRun };
  });

  return { nextState, payrollRun: result };
}

export function txExportCompanyBackup(
  state: ErpDatabaseState,
  companyMeta: { companyId: string; companyCode: string; companyName: string },
): string {
  const companyId = companyMeta.companyId;
  const companySequences: Record<string, number> = {};
  const prefix = `${companyId}:`;
  for (const [k, v] of Object.entries(state.sequences)) {
    if (k.startsWith(prefix)) {
      companySequences[k.slice(prefix.length)] = v;
    }
  }

  const filterByCompany = <T extends { companyId: string }>(arr: T[]) =>
    arr.filter((r) => r.companyId === companyId);

  return JSON.stringify(
    {
      schemaVersion: 3,
      exportedAt: nowIso(),
      companyId,
      companyCode: companyMeta.companyCode,
      companyName: companyMeta.companyName,
      sequences: companySequences,
      records: {
        catalogue: filterByCompany(state.catalogue),
        contacts: filterByCompany(state.contacts),
        salesOrders: filterByCompany(state.salesOrders),
        creditNotes: filterByCompany(state.creditNotes),
        posShifts: filterByCompany(state.posShifts),
        purchaseOrders: filterByCompany(state.purchaseOrders),
        purchaseRequisitions: filterByCompany(state.purchaseRequisitions),
        warehouses: filterByCompany(state.warehouses),
        stockTransfers: filterByCompany(state.stockTransfers),
        shipments: filterByCompany(state.shipments),
        stockMovements: filterByCompany(state.stockMovements),
        inventoryLots: filterByCompany(state.inventoryLots),
        stockReservations: filterByCompany(state.stockReservations),
        accounts: filterByCompany(state.accounts),
        fiscalPeriods: filterByCompany(state.fiscalPeriods),
        journals: filterByCompany(state.journals),
        paymentAllocations: filterByCompany(state.paymentAllocations),
        ledgerEntries: filterByCompany(state.ledgerEntries),
        fixedAssets: filterByCompany(state.fixedAssets),
        budgets: filterByCompany(state.budgets),
        expenseClaims: filterByCompany(state.expenseClaims),
        bankTransactions: filterByCompany(state.bankTransactions),
        boms: filterByCompany(state.boms),
        workOrders: filterByCompany(state.workOrders),
        qualityInspections: filterByCompany(state.qualityInspections),
        maintenanceSchedules: filterByCompany(state.maintenanceSchedules),
        employees: filterByCompany(state.employees),
        payrollRuns: filterByCompany(state.payrollRuns),
        leaveRequests: filterByCompany(state.leaveRequests),
        attendanceLogs: filterByCompany(state.attendanceLogs),
        jobOpenings: filterByCompany(state.jobOpenings),
        candidates: filterByCompany(state.candidates),
        performanceGoals: filterByCompany(state.performanceGoals),
        projectTasks: filterByCompany(state.projectTasks),
        timesheets: filterByCompany(state.timesheets),
        supportTickets: filterByCompany(state.supportTickets),
        kbArticles: filterByCompany(state.kbArticles),
        documents: filterByCompany(state.documents),
        campaigns: filterByCompany(state.campaigns),
        approvalRules: filterByCompany(state.approvalRules),
        customFields: filterByCompany(state.customFields),
        biReports: filterByCompany(state.biReports),
        industryRecords: filterByCompany(state.industryRecords),
        auditLogs: filterByCompany(state.auditLogs),
      },
    },
    null,
    2,
  );
}

export function txImportCompanyBackup(
  state: ErpDatabaseState,
  scope: TransactionScope,
  jsonText: string,
): { nextState: ErpDatabaseState; importedCount: number } {
  const { nextState, result } = runAtomicTransaction(state, (draft) => {
    let raw: unknown;
    try {
      raw = JSON.parse(jsonText);
    } catch {
      throw new ErpDomainError('INVALID_BACKUP_JSON', 'Backup file is not valid JSON.');
    }

    const parsed = BackupPayloadSchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new ErpDomainError(
        'BACKUP_VALIDATION_FAILED',
        `Backup validation failed at ${issue?.path.join('.') || 'root'}: ${issue?.message}`,
      );
    }

    const companyId = scope.companyId;
    const r = parsed.data.records;
    const mergeCollection = <T extends { companyId: string }>(
      incoming: Record<string, unknown>[],
      existing: T[],
    ): T[] => [
      ...(incoming.map((item) => ({ ...item, companyId })) as unknown as T[]),
      ...existing.filter((x) => x.companyId !== companyId),
    ];

    const nextSequences = { ...draft.sequences };
    for (const [k, v] of Object.entries(parsed.data.sequences ?? {})) {
      nextSequences[`${companyId}:${k}`] = v;
    }

    const importedCount =
      r.catalogue.length +
      r.contacts.length +
      r.salesOrders.length +
      r.creditNotes.length +
      r.purchaseOrders.length +
      r.journals.length +
      r.fixedAssets.length +
      r.boms.length +
      r.workOrders.length +
      r.employees.length +
      r.projectTasks.length +
      r.supportTickets.length +
      r.documents.length +
      r.campaigns.length +
      r.industryRecords.length;

    let nextState: ErpDatabaseState = {
      schemaVersion: 3,
      sequences: nextSequences,
      catalogue: mergeCollection(r.catalogue, draft.catalogue),
      contacts: mergeCollection(r.contacts, draft.contacts),
      salesOrders: mergeCollection(r.salesOrders, draft.salesOrders),
      creditNotes: mergeCollection(r.creditNotes, draft.creditNotes),
      posShifts: mergeCollection(r.posShifts, draft.posShifts),
      purchaseOrders: mergeCollection(r.purchaseOrders, draft.purchaseOrders),
      purchaseRequisitions: mergeCollection(r.purchaseRequisitions, draft.purchaseRequisitions),
      warehouses: mergeCollection(r.warehouses, draft.warehouses),
      stockTransfers: mergeCollection(r.stockTransfers, draft.stockTransfers),
      shipments: mergeCollection(r.shipments, draft.shipments),
      stockMovements: mergeCollection(r.stockMovements, draft.stockMovements),
      inventoryLots: mergeCollection(r.inventoryLots, draft.inventoryLots),
      stockReservations: mergeCollection(r.stockReservations, draft.stockReservations),
      accounts: mergeCollection(r.accounts, draft.accounts),
      fiscalPeriods: mergeCollection(r.fiscalPeriods, draft.fiscalPeriods),
      journals: mergeCollection(r.journals, draft.journals),
      paymentAllocations: mergeCollection(r.paymentAllocations, draft.paymentAllocations),
      ledgerEntries: mergeCollection(r.ledgerEntries, draft.ledgerEntries),
      fixedAssets: mergeCollection(r.fixedAssets, draft.fixedAssets),
      budgets: mergeCollection(r.budgets, draft.budgets),
      expenseClaims: mergeCollection(r.expenseClaims, draft.expenseClaims),
      bankTransactions: mergeCollection(r.bankTransactions, draft.bankTransactions),
      boms: mergeCollection(r.boms, draft.boms),
      workOrders: mergeCollection(r.workOrders, draft.workOrders),
      qualityInspections: mergeCollection(r.qualityInspections, draft.qualityInspections),
      maintenanceSchedules: mergeCollection(r.maintenanceSchedules, draft.maintenanceSchedules),
      employees: mergeCollection(r.employees, draft.employees),
      payrollRuns: mergeCollection(r.payrollRuns, draft.payrollRuns),
      leaveRequests: mergeCollection(r.leaveRequests, draft.leaveRequests),
      attendanceLogs: mergeCollection(r.attendanceLogs, draft.attendanceLogs),
      jobOpenings: mergeCollection(r.jobOpenings, draft.jobOpenings),
      candidates: mergeCollection(r.candidates, draft.candidates),
      performanceGoals: mergeCollection(r.performanceGoals, draft.performanceGoals),
      projectTasks: mergeCollection(r.projectTasks, draft.projectTasks),
      timesheets: mergeCollection(r.timesheets, draft.timesheets),
      supportTickets: mergeCollection(r.supportTickets, draft.supportTickets),
      kbArticles: mergeCollection(r.kbArticles, draft.kbArticles),
      documents: mergeCollection(r.documents, draft.documents),
      campaigns: mergeCollection(r.campaigns, draft.campaigns),
      approvalRules: mergeCollection(r.approvalRules, draft.approvalRules),
      customFields: mergeCollection(r.customFields, draft.customFields),
      biReports: mergeCollection(r.biReports, draft.biReports),
      industryRecords: mergeCollection(r.industryRecords, draft.industryRecords),
      auditLogs: mergeCollection(r.auditLogs, draft.auditLogs),
    };

    nextState = ensureCompanyAccounts(nextState, companyId).nextState;
    nextState = appendAuditLog(nextState, scope, {
      action: 'system.backup.import',
      resourceType: 'company_backup',
      resourceId: companyId,
      outcome: 'success',
      details: `Imported ${importedCount} validated records`,
    });

    return { nextState, result: importedCount };
  });

  return { nextState, importedCount: result };
}

export type { CrmStage, ProjectTaskStatus, TicketStatus };
