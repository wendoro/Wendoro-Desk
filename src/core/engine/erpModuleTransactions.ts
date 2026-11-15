import {
  CatalogueItem,
  CreditNote,
  EmployeeRecord,
  ErpDatabaseState,
  ExpenseClaim,
  FixedAsset,
  InventoryLot,
  PosShift,
  PurchaseOrder,
  StockMovement,
  StockTransfer,
  WorkOrder,
} from '@/src/core/store/erpTypes';
import {
  DraftJournalLine,
  ErpDomainError,
  createUuid,
  nextSequenceNumber,
  nowIso,
  postJournalEntry,
  roundMoney,
} from './accountingEngine';
import {
  TransactionScope,
  appendAuditLog,
  runAtomicTransaction,
  txCreatePurchaseOrder,
} from './erpTransactions';

export function txCreateCreditNote(
  state: ErpDatabaseState,
  scope: TransactionScope,
  input: {
    salesOrderId: string;
    issueDate: string;
    reason: string;
    restoreStock: boolean;
  },
): { nextState: ErpDatabaseState; creditNote: CreditNote } {
  const { nextState, result } = runAtomicTransaction(state, (draft) => {
    const order = draft.salesOrders.find(
      (o) => o.id === input.salesOrderId && o.companyId === scope.companyId,
    );
    if (!order) {
      throw new ErpDomainError('ORDER_NOT_FOUND', 'Target sales invoice not found.');
    }
    if (order.documentType !== 'invoice' || !order.ledgerPosted) {
      throw new ErpDomainError(
        'CANNOT_CREDIT_UNPOSTED',
        'Credit notes can only be issued against posted invoices.',
      );
    }
    const existingCn = draft.creditNotes.find(
      (c) => c.companyId === scope.companyId && c.salesOrderId === order.id,
    );
    if (existingCn) {
      throw new ErpDomainError(
        'DUPLICATE_CREDIT_NOTE',
        `Credit note ${existingCn.creditNumber} was already issued for ${order.documentNumber}.`,
      );
    }

    const seqRes = nextSequenceNumber(draft, scope.companyId, 'CN', 4);
    let nextState = seqRes.nextState;
    const creditNumber = seqRes.formatted;

    const lines: DraftJournalLine[] = [
      {
        accountCode: '4000',
        debit: order.subtotal,
        credit: 0,
        memo: `Sales return / credit note ${creditNumber}`,
      },
      {
        accountCode: '1200',
        debit: 0,
        credit: order.grandTotal,
        memo: `AR reduction for ${order.documentNumber}`,
      },
    ];
    if (order.taxTotal > 0) {
      lines.push({
        accountCode: '2200',
        debit: order.taxTotal,
        credit: 0,
        memo: `Output tax reversal (${creditNumber})`,
      });
    }

    const jRes = postJournalEntry(nextState, {
      companyId: scope.companyId,
      branchId: scope.branchId,
      date: input.issueDate,
      reference: creditNumber,
      description: `Credit note for ${order.documentNumber}: ${input.reason}`,
      sourceModule: 'sales',
      sourceId: order.id,
      idempotencyKey: `credit-note:${order.id}`,
      lines,
    });
    nextState = jRes.nextState;

    if (input.restoreStock && order.stockPosted) {
      let returnedCogs = 0;
      for (const line of order.lines) {
        if (!line.itemId) continue;
        const item = nextState.catalogue.find(
          (c) => c.id === line.itemId && c.companyId === scope.companyId,
        );
        if (!item || !item.trackStock) continue;

        const unitCost = item.costPrice;
        const val = roundMoney(line.quantity * unitCost);
        returnedCogs = roundMoney(returnedCogs + val);
        const nextQty = item.stockOnHand + line.quantity;
        const nextVal = roundMoney(item.inventoryAssetValue + val);

        const lot: InventoryLot = {
          id: createUuid(),
          companyId: scope.companyId,
          branchId: scope.branchId,
          itemId: item.id,
          batchNumber: `${creditNumber}-${item.sku}`,
          serialNumbers: [],
          qtyReceived: line.quantity,
          qtyRemaining: line.quantity,
          unitCost,
          receiptReference: creditNumber,
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
          movementType: 'sales_return',
          quantity: line.quantity,
          unitCost,
          totalValue: val,
          balanceAfter: nextQty,
          reservedAfter: item.reservedQty,
          batchNumber: lot.batchNumber,
          reference: creditNumber,
          idempotencyKey: `sales-return:${order.id}:${item.id}:${line.id}`,
          reason: `Returned on credit note ${creditNumber}`,
          createdAt: nowIso(),
        };

        nextState = {
          ...nextState,
          catalogue: nextState.catalogue.map((c) =>
            c.id === item.id
              ? { ...c, stockOnHand: nextQty, inventoryAssetValue: nextVal, version: c.version + 1 }
              : c,
          ),
          inventoryLots: [lot, ...nextState.inventoryLots],
          stockMovements: [movement, ...nextState.stockMovements],
        };
      }

      if (returnedCogs > 0) {
        nextState = postJournalEntry(nextState, {
          companyId: scope.companyId,
          branchId: scope.branchId,
          date: input.issueDate,
          reference: `${creditNumber}-INV`,
          description: `Inventory return & COGS reversal for ${creditNumber}`,
          sourceModule: 'inventory',
          sourceId: order.id,
          idempotencyKey: `credit-note-cogs:${order.id}`,
          lines: [
            { accountCode: '1300', debit: returnedCogs, credit: 0, memo: `Restored inventory (${creditNumber})` },
            { accountCode: '5000', debit: 0, credit: returnedCogs, memo: `COGS reversal (${creditNumber})` },
          ],
        }).nextState;
      }
    }

    const creditNote: CreditNote = {
      id: createUuid(),
      companyId: scope.companyId,
      creditNumber,
      salesOrderId: order.id,
      invoiceNumber: order.documentNumber,
      customerName: order.customerName,
      issueDate: input.issueDate,
      reason: input.reason.trim() || 'Sales return',
      subtotal: order.subtotal,
      taxTotal: order.taxTotal,
      grandTotal: order.grandTotal,
      restoreStock: input.restoreStock,
      journalId: jRes.journal.id,
      createdAt: nowIso(),
    };

    nextState = {
      ...nextState,
      creditNotes: [creditNote, ...nextState.creditNotes],
      salesOrders: nextState.salesOrders.map((o) =>
        o.id === order.id ? { ...o, status: 'cancelled' } : o,
      ),
    };

    nextState = appendAuditLog(nextState, scope, {
      action: 'sales.credit_note.create',
      resourceType: 'credit_note',
      resourceId: creditNote.id,
      outcome: 'success',
      details: `Issued ${creditNumber} against ${order.documentNumber} (${creditNote.grandTotal.toFixed(2)})`,
    });

    return { nextState, result: creditNote };
  });

  return { nextState, creditNote: result };
}

export function txRegisterFixedAsset(
  state: ErpDatabaseState,
  scope: TransactionScope,
  input: {
    name: string;
    category: string;
    purchaseDate: string;
    purchaseCost: number;
    salvageValue: number;
    usefulLifeMonths: number;
    postAcquisitionJournal: boolean;
    paymentAccountCode?: '1000' | '2100';
  },
): { nextState: ErpDatabaseState; asset: FixedAsset } {
  const { nextState, result } = runAtomicTransaction(state, (draft) => {
    const cost = roundMoney(input.purchaseCost);
    const salvage = roundMoney(Math.max(0, input.salvageValue));
    if (!input.name.trim() || cost <= 0 || input.usefulLifeMonths < 1) {
      throw new ErpDomainError(
        'INVALID_ASSET',
        'Asset name, positive purchase cost, and useful life (>= 1 month) are required.',
      );
    }
    if (salvage >= cost) {
      throw new ErpDomainError(
        'INVALID_SALVAGE_VALUE',
        'Salvage value must be strictly less than purchase cost.',
      );
    }

    const seqRes = nextSequenceNumber(draft, scope.companyId, 'FA', 4);
    let nextState = seqRes.nextState;
    const assetCode = seqRes.formatted;

    const asset: FixedAsset = {
      id: createUuid(),
      companyId: scope.companyId,
      assetCode,
      name: input.name.trim(),
      category: input.category.trim() || 'Equipment',
      purchaseDate: input.purchaseDate,
      purchaseCost: cost,
      salvageValue: salvage,
      usefulLifeMonths: Math.floor(input.usefulLifeMonths),
      accumulatedDepreciation: 0,
      status: 'active',
      createdAt: nowIso(),
    };

    nextState = {
      ...nextState,
      fixedAssets: [asset, ...nextState.fixedAssets],
    };

    if (input.postAcquisitionJournal) {
      const creditCode = input.paymentAccountCode ?? '1000';
      nextState = postJournalEntry(nextState, {
        companyId: scope.companyId,
        branchId: scope.branchId,
        date: input.purchaseDate,
        reference: assetCode,
        description: `Fixed asset acquisition: ${asset.name}`,
        sourceModule: 'assets',
        sourceId: asset.id,
        idempotencyKey: `asset-acquire:${asset.id}`,
        lines: [
          { accountCode: '1500', debit: cost, credit: 0, memo: `Capitalized ${asset.name}` },
          {
            accountCode: creditCode,
            debit: 0,
            credit: cost,
            memo: creditCode === '2100' ? 'Asset payable' : 'Cash/Bank paid',
          },
        ],
      }).nextState;
    }

    nextState = appendAuditLog(nextState, scope, {
      action: 'finance.asset.register',
      resourceType: 'fixed_asset',
      resourceId: asset.id,
      outcome: 'success',
      details: `Registered ${assetCode} (${asset.name}) cost ${cost.toFixed(2)}`,
    });

    return { nextState, result: asset };
  });

  return { nextState, asset: result };
}

export function txRunMonthlyDepreciation(
  state: ErpDatabaseState,
  scope: TransactionScope,
  input: { periodKey: string; postingDate: string },
): { nextState: ErpDatabaseState; totalDepreciation: number; assetsCount: number } {
  const { nextState, result } = runAtomicTransaction(state, (draft) => {
    const activeAssets = draft.fixedAssets.filter(
      (a) =>
        a.companyId === scope.companyId &&
        a.status === 'active' &&
        a.lastDepreciationPeriod !== input.periodKey,
    );

    let totalDep = 0;
    let count = 0;
    const updatedMap = new Map<string, FixedAsset>();

    for (const asset of activeAssets) {
      const depreciableBase = roundMoney(asset.purchaseCost - asset.salvageValue);
      const remaining = roundMoney(depreciableBase - asset.accumulatedDepreciation);
      if (remaining <= 0) continue;

      const monthly = roundMoney(
        Math.min(remaining, depreciableBase / Math.max(1, asset.usefulLifeMonths)),
      );
      if (monthly <= 0) continue;

      totalDep = roundMoney(totalDep + monthly);
      count += 1;
      updatedMap.set(asset.id, {
        ...asset,
        accumulatedDepreciation: roundMoney(asset.accumulatedDepreciation + monthly),
        lastDepreciationPeriod: input.periodKey,
      });
    }

    if (totalDep <= 0 || count === 0) {
      throw new ErpDomainError(
        'NO_DEPRECIATION_DUE',
        `No depreciable active assets due for period ${input.periodKey}.`,
      );
    }

    let nextState = postJournalEntry(draft, {
      companyId: scope.companyId,
      branchId: scope.branchId,
      date: input.postingDate,
      reference: `DEP-${input.periodKey}`,
      description: `Monthly straight-line depreciation for ${count} asset(s) (${input.periodKey})`,
      sourceModule: 'assets',
      idempotencyKey: `depreciation:${scope.companyId}:${input.periodKey}`,
      lines: [
        { accountCode: '5500', debit: totalDep, credit: 0, memo: `Depreciation (${input.periodKey})` },
        { accountCode: '1510', debit: 0, credit: totalDep, memo: `Accumulated depreciation (${input.periodKey})` },
      ],
    }).nextState;

    nextState = {
      ...nextState,
      fixedAssets: nextState.fixedAssets.map((a) => updatedMap.get(a.id) ?? a),
    };

    nextState = appendAuditLog(nextState, scope, {
      action: 'finance.depreciation.run',
      resourceType: 'depreciation',
      resourceId: input.periodKey,
      outcome: 'success',
      details: `Posted depreciation ${totalDep.toFixed(2)} across ${count} assets`,
    });

    return { nextState, result: { totalDepreciation: totalDep, assetsCount: count } };
  });

  return { nextState, ...result };
}

export function txApproveExpenseClaim(
  state: ErpDatabaseState,
  scope: TransactionScope,
  input: { claimId: string; payImmediately: boolean; postingDate: string },
): { nextState: ErpDatabaseState; claim: ExpenseClaim } {
  const { nextState, result } = runAtomicTransaction(state, (draft) => {
    const claim = draft.expenseClaims.find(
      (e) => e.id === input.claimId && e.companyId === scope.companyId,
    );
    if (!claim) {
      throw new ErpDomainError('CLAIM_NOT_FOUND', 'Expense claim not found.');
    }
    if (claim.status === 'approved' || claim.status === 'paid') {
      throw new ErpDomainError('CLAIM_ALREADY_POSTED', `${claim.claimNumber} is already posted.`);
    }

    const netExpense = roundMoney(Math.max(0, claim.amount - claim.taxAmount));
    const lines: DraftJournalLine[] = [];
    if (netExpense > 0) {
      lines.push({
        accountCode: '5300',
        debit: netExpense,
        credit: 0,
        memo: `${claim.category}: ${claim.description}`,
      });
    }
    if (claim.taxAmount > 0) {
      lines.push({
        accountCode: '1400',
        debit: claim.taxAmount,
        credit: 0,
        memo: `Input tax on ${claim.claimNumber}`,
      });
    }
    lines.push({
      accountCode: input.payImmediately ? '1000' : '2100',
      debit: 0,
      credit: claim.amount,
      memo: input.payImmediately
        ? `Reimbursed ${claim.employeeName}`
        : `Reimbursement payable to ${claim.employeeName}`,
    });

    const jRes = postJournalEntry(draft, {
      companyId: scope.companyId,
      branchId: scope.branchId,
      date: input.postingDate,
      reference: claim.claimNumber,
      description: `Expense claim ${claim.claimNumber} (${claim.employeeName})`,
      sourceModule: 'expenses',
      sourceId: claim.id,
      idempotencyKey: `expense-claim:${claim.id}`,
      lines,
    });

    const updated: ExpenseClaim = {
      ...claim,
      status: input.payImmediately ? 'paid' : 'approved',
      journalId: jRes.journal.id,
    };

    let nextState: ErpDatabaseState = {
      ...jRes.nextState,
      expenseClaims: jRes.nextState.expenseClaims.map((c) => (c.id === claim.id ? updated : c)),
    };

    nextState = appendAuditLog(nextState, scope, {
      action: 'finance.expense_claim.post',
      resourceType: 'expense_claim',
      resourceId: claim.id,
      outcome: 'success',
      details: `Posted ${claim.claimNumber} (${claim.amount.toFixed(2)})`,
    });

    return { nextState, result: updated };
  });

  return { nextState, claim: result };
}

export function txTransferStockBetweenWarehouses(
  state: ErpDatabaseState,
  scope: TransactionScope,
  input: {
    itemId: string;
    fromWarehouse: string;
    toWarehouse: string;
    quantity: number;
    notes: string;
  },
): { nextState: ErpDatabaseState; transfer: StockTransfer } {
  const { nextState, result } = runAtomicTransaction(state, (draft) => {
    if (input.fromWarehouse === input.toWarehouse) {
      throw new ErpDomainError('SAME_WAREHOUSE', 'Source and destination warehouses must differ.');
    }
    const item = draft.catalogue.find(
      (c) => c.id === input.itemId && c.companyId === scope.companyId,
    );
    if (!item || !item.trackStock) {
      throw new ErpDomainError('INVALID_ITEM', 'Select a stock-tracked item to transfer.');
    }
    const available = item.stockOnHand - item.reservedQty;
    if (input.quantity <= 0 || input.quantity > available) {
      throw new ErpDomainError(
        'INSUFFICIENT_AVAILABLE_STOCK',
        `Transfer quantity (${input.quantity}) exceeds available stock (${available}).`,
      );
    }

    const seqRes = nextSequenceNumber(draft, scope.companyId, 'TRF', 4);
    const transferNumber = seqRes.formatted;

    const transfer: StockTransfer = {
      id: createUuid(),
      companyId: scope.companyId,
      transferNumber,
      itemId: item.id,
      itemName: item.name,
      sku: item.sku,
      fromWarehouse: input.fromWarehouse,
      toWarehouse: input.toWarehouse,
      quantity: input.quantity,
      status: 'completed',
      notes: input.notes.trim(),
      createdAt: nowIso(),
    };

    const movement: StockMovement = {
      id: createUuid(),
      companyId: scope.companyId,
      branchId: scope.branchId,
      itemId: item.id,
      itemName: item.name,
      sku: item.sku,
      direction: 'adjustment',
      movementType: 'transfer',
      quantity: input.quantity,
      unitCost: item.costPrice,
      totalValue: roundMoney(input.quantity * item.costPrice),
      balanceAfter: item.stockOnHand,
      reservedAfter: item.reservedQty,
      reference: transferNumber,
      idempotencyKey: `transfer:${transfer.id}`,
      reason: `Transferred ${input.fromWarehouse} -> ${input.toWarehouse}`,
      createdAt: nowIso(),
    };

    let nextState: ErpDatabaseState = {
      ...seqRes.nextState,
      stockTransfers: [transfer, ...seqRes.nextState.stockTransfers],
      stockMovements: [movement, ...seqRes.nextState.stockMovements],
    };

    nextState = appendAuditLog(nextState, scope, {
      action: 'inventory.warehouse.transfer',
      resourceType: 'stock_transfer',
      resourceId: transfer.id,
      outcome: 'success',
      details: `${transferNumber}: ${input.quantity} x ${item.sku} (${input.fromWarehouse} -> ${input.toWarehouse})`,
    });

    return { nextState, result: transfer };
  });

  return { nextState, transfer: result };
}

export function txCompleteWorkOrder(
  state: ErpDatabaseState,
  scope: TransactionScope,
  input: { workOrderId: string; completionDate: string },
): { nextState: ErpDatabaseState; workOrder: WorkOrder } {
  const { nextState, result } = runAtomicTransaction(state, (draft) => {
    const wo = draft.workOrders.find(
      (w) => w.id === input.workOrderId && w.companyId === scope.companyId,
    );
    if (!wo) {
      throw new ErpDomainError('WORK_ORDER_NOT_FOUND', 'Work order not found.');
    }
    if (wo.status === 'completed' || wo.status === 'cancelled') {
      throw new ErpDomainError('INVALID_WORK_ORDER_STATE', `Work order ${wo.woNumber} is already ${wo.status}.`);
    }

    const bom = draft.boms.find(
      (b) => b.id === wo.bomId && b.companyId === scope.companyId,
    );
    if (!bom) {
      throw new ErpDomainError('BOM_NOT_FOUND', 'Linked Bill of Materials not found.');
    }

    const finishedItem = draft.catalogue.find(
      (c) => c.id === wo.finishedItemId && c.companyId === scope.companyId,
    );
    if (!finishedItem) {
      throw new ErpDomainError('FINISHED_ITEM_NOT_FOUND', 'Finished good item not found in catalogue.');
    }

    let nextState = draft;
    let totalMaterialCost = 0;

    // 1. Validate & consume all BOM raw material components atomically
    for (const comp of bom.components) {
      const rawItem = nextState.catalogue.find(
        (c) => c.id === comp.itemId && c.companyId === scope.companyId,
      );
      if (!rawItem) {
        throw new ErpDomainError('COMPONENT_NOT_FOUND', `BOM component ${comp.sku} missing from catalogue.`);
      }
      const requiredQty = roundMoney(comp.quantityPerUnit * wo.targetQty);
      if (rawItem.trackStock && rawItem.stockOnHand < requiredQty) {
        throw new ErpDomainError(
          'INSUFFICIENT_RAW_MATERIAL',
          `Cannot complete ${wo.woNumber}: need ${requiredQty} of ${rawItem.sku}, only ${rawItem.stockOnHand} on hand.`,
        );
      }

      const unitCost =
        rawItem.stockOnHand > 0 && rawItem.inventoryAssetValue > 0
          ? roundMoney(rawItem.inventoryAssetValue / rawItem.stockOnHand)
          : rawItem.costPrice;
      const compCost = roundMoney(requiredQty * unitCost);
      totalMaterialCost = roundMoney(totalMaterialCost + compCost);

      if (rawItem.trackStock) {
        const nextQty = roundMoney(rawItem.stockOnHand - requiredQty);
        const nextVal = nextQty <= 0 ? 0 : roundMoney(Math.max(0, rawItem.inventoryAssetValue - compCost));
        const consumeMov: StockMovement = {
          id: createUuid(),
          companyId: scope.companyId,
          branchId: scope.branchId,
          itemId: rawItem.id,
          itemName: rawItem.name,
          sku: rawItem.sku,
          direction: 'out',
          movementType: 'production_consume',
          quantity: requiredQty,
          unitCost,
          totalValue: compCost,
          balanceAfter: nextQty,
          reservedAfter: rawItem.reservedQty,
          reference: wo.woNumber,
          idempotencyKey: `wo-consume:${wo.id}:${rawItem.id}`,
          reason: `Consumed in manufacturing ${wo.woNumber}`,
          createdAt: nowIso(),
        };

        nextState = {
          ...nextState,
          catalogue: nextState.catalogue.map((c) =>
            c.id === rawItem.id
              ? { ...c, stockOnHand: nextQty, inventoryAssetValue: nextVal, version: c.version + 1 }
              : c,
          ),
          stockMovements: [consumeMov, ...nextState.stockMovements],
        };
      }
    }

    // 2. Receive finished goods into inventory at rolled-up cost
    const totalConversionCost = roundMoney(
      (bom.laborCostPerUnit + bom.overheadCostPerUnit) * wo.targetQty,
    );
    const totalProducedValue = roundMoney(totalMaterialCost + totalConversionCost);
    const producedUnitCost = roundMoney(totalProducedValue / Math.max(1, wo.targetQty));

    const refreshedFinished = nextState.catalogue.find((c) => c.id === finishedItem.id)!;
    const fgNextQty = roundMoney(refreshedFinished.stockOnHand + wo.targetQty);
    const fgNextVal = roundMoney(refreshedFinished.inventoryAssetValue + totalProducedValue);
    const fgWeightedCost = fgNextQty > 0 ? roundMoney(fgNextVal / fgNextQty) : producedUnitCost;

    const fgLot: InventoryLot = {
      id: createUuid(),
      companyId: scope.companyId,
      branchId: scope.branchId,
      itemId: refreshedFinished.id,
      batchNumber: `${wo.woNumber}-FG`,
      serialNumbers: [],
      qtyReceived: wo.targetQty,
      qtyRemaining: wo.targetQty,
      unitCost: producedUnitCost,
      receiptReference: wo.woNumber,
      createdAt: nowIso(),
    };

    const fgMov: StockMovement = {
      id: createUuid(),
      companyId: scope.companyId,
      branchId: scope.branchId,
      itemId: refreshedFinished.id,
      itemName: refreshedFinished.name,
      sku: refreshedFinished.sku,
      direction: 'in',
      movementType: 'production_output',
      quantity: wo.targetQty,
      unitCost: producedUnitCost,
      totalValue: totalProducedValue,
      balanceAfter: fgNextQty,
      reservedAfter: refreshedFinished.reservedQty,
      batchNumber: fgLot.batchNumber,
      reference: wo.woNumber,
      idempotencyKey: `wo-output:${wo.id}:${refreshedFinished.id}`,
      reason: `Manufactured output from ${wo.woNumber}`,
      createdAt: nowIso(),
    };

    nextState = {
      ...nextState,
      catalogue: nextState.catalogue.map((c): CatalogueItem =>
        c.id === refreshedFinished.id
          ? {
              ...c,
              stockOnHand: fgNextQty,
              inventoryAssetValue: fgNextVal,
              costPrice: fgWeightedCost,
              version: c.version + 1,
            }
          : c,
      ),
      inventoryLots: [fgLot, ...nextState.inventoryLots],
      stockMovements: [fgMov, ...nextState.stockMovements],
    };

    // 3. Post balanced conversion cost capitalization if labor/overhead > 0
    let journalId: string | undefined;
    if (totalConversionCost > 0) {
      const jRes = postJournalEntry(nextState, {
        companyId: scope.companyId,
        branchId: scope.branchId,
        date: input.completionDate,
        reference: wo.woNumber,
        description: `Manufacturing conversion absorption for ${wo.woNumber} (${wo.finishedSku})`,
        sourceModule: 'manufacturing',
        sourceId: wo.id,
        idempotencyKey: `wo-conversion:${wo.id}`,
        lines: [
          {
            accountCode: '1300',
            debit: totalConversionCost,
            credit: 0,
            memo: `Capitalized labor & overhead (${wo.woNumber})`,
          },
          {
            accountCode: '5300',
            debit: 0,
            credit: totalConversionCost,
            memo: `Production overhead absorbed (${wo.woNumber})`,
          },
        ],
      });
      nextState = jRes.nextState;
      journalId = jRes.journal.id;
    }

    const updatedWo: WorkOrder = {
      ...wo,
      status: 'completed',
      completedQty: wo.targetQty,
      totalMaterialCost,
      totalConversionCost,
      journalId,
    };

    nextState = {
      ...nextState,
      workOrders: nextState.workOrders.map((w) => (w.id === wo.id ? updatedWo : w)),
    };

    nextState = appendAuditLog(nextState, scope, {
      action: 'manufacturing.work_order.complete',
      resourceType: 'work_order',
      resourceId: wo.id,
      outcome: 'success',
      details: `Completed ${wo.woNumber}: produced ${wo.targetQty} x ${wo.finishedSku}`,
    });

    return { nextState, result: updatedWo };
  });

  return { nextState, workOrder: result };
}

export function txClosePosShift(
  state: ErpDatabaseState,
  scope: TransactionScope,
  input: { shiftId: string; countedCash: number },
): { nextState: ErpDatabaseState; shift: PosShift } {
  const { nextState, result } = runAtomicTransaction(state, (draft) => {
    const shift = draft.posShifts.find(
      (s) => s.id === input.shiftId && s.companyId === scope.companyId,
    );
    if (!shift) {
      throw new ErpDomainError('SHIFT_NOT_FOUND', 'POS register shift not found.');
    }
    if (shift.status === 'closed') {
      throw new ErpDomainError('SHIFT_ALREADY_CLOSED', `Shift ${shift.shiftNumber} is already closed.`);
    }

    const countedCash = roundMoney(Math.max(0, input.countedCash));
    const variance = roundMoney(countedCash - shift.expectedCash);
    const updated: PosShift = {
      ...shift,
      countedCash,
      variance,
      closedAt: nowIso(),
      status: 'closed',
    };

    const nextState: ErpDatabaseState = {
      ...draft,
      posShifts: draft.posShifts.map((s) => (s.id === shift.id ? updated : s)),
    };

    return { nextState, result: updated };
  });

  return { nextState, shift: result };
}

export function txConvertRequisitionToPo(
  state: ErpDatabaseState,
  scope: TransactionScope,
  input: { reqId: string; vendorName: string; expectedDate: string },
): { nextState: ErpDatabaseState; order: PurchaseOrder } {
  const { nextState, result } = runAtomicTransaction(state, (draft) => {
    const req = draft.purchaseRequisitions.find(
      (r) => r.id === input.reqId && r.companyId === scope.companyId,
    );
    if (!req) {
      throw new ErpDomainError('REQ_NOT_FOUND', 'Purchase requisition not found.');
    }
    if (req.status === 'converted' || req.status === 'rejected') {
      throw new ErpDomainError('REQ_ALREADY_PROCESSED', `Requisition ${req.reqNumber} is ${req.status}.`);
    }

    const poRes = txCreatePurchaseOrder(draft, scope, {
      vendorName: input.vendorName.trim() || req.vendorName || 'Preferred Supplier',
      orderDate: new Date().toISOString().slice(0, 10),
      expectedDate: input.expectedDate,
      status: 'ordered',
      lines: [
        {
          itemId: req.itemId,
          description: req.itemDescription,
          quantity: req.quantity,
          unitPrice: req.estimatedUnitCost,
          taxRate: 0,
        },
      ],
      notes: `Converted from Purchase Requisition ${req.reqNumber}`,
    });

    const nextState: ErpDatabaseState = {
      ...poRes.nextState,
      purchaseRequisitions: poRes.nextState.purchaseRequisitions.map((r) =>
        r.id === req.id ? { ...r, status: 'converted', convertedPoId: poRes.order.id } : r,
      ),
    };

    return { nextState, result: poRes.order };
  });

  return { nextState, order: result };
}

export function txHireCandidateToEmployee(
  state: ErpDatabaseState,
  scope: TransactionScope,
  input: { candidateId: string; joinedDate: string; monthlySalary: number },
): { nextState: ErpDatabaseState; employee: EmployeeRecord } {
  const { nextState, result } = runAtomicTransaction(state, (draft) => {
    const cand = draft.candidates.find(
      (c) => c.id === input.candidateId && c.companyId === scope.companyId,
    );
    if (!cand) {
      throw new ErpDomainError('CANDIDATE_NOT_FOUND', 'Candidate not found.');
    }
    if (cand.stage === 'hired') {
      throw new ErpDomainError('ALREADY_HIRED', `${cand.fullName} has already been hired.`);
    }

    const job = draft.jobOpenings.find((j) => j.id === cand.jobOpeningId);
    const seqRes = nextSequenceNumber(draft, scope.companyId, 'EMP', 3);

    const employee: EmployeeRecord = {
      id: createUuid(),
      companyId: scope.companyId,
      branchId: scope.branchId,
      employeeCode: seqRes.formatted,
      fullName: cand.fullName,
      email: cand.email,
      department: job?.department || 'Operations',
      designation: job?.title || 'Specialist',
      monthlySalary: roundMoney(input.monthlySalary),
      basicSalary: roundMoney(input.monthlySalary * 0.7),
      allowances: roundMoney(input.monthlySalary * 0.3),
      deductions: 0,
      status: 'active',
      joinedDate: input.joinedDate,
      createdAt: nowIso(),
    };

    let nextState: ErpDatabaseState = {
      ...seqRes.nextState,
      employees: [employee, ...seqRes.nextState.employees],
      candidates: seqRes.nextState.candidates.map((c) =>
        c.id === cand.id ? { ...c, stage: 'hired' } : c,
      ),
    };

    nextState = appendAuditLog(nextState, scope, {
      action: 'hr.candidate.hire',
      resourceType: 'employee',
      resourceId: employee.id,
      outcome: 'success',
      details: `Hired ${cand.fullName} as ${employee.designation} (${employee.employeeCode})`,
    });

    return { nextState, result: employee };
  });

  return { nextState, employee: result };
}
