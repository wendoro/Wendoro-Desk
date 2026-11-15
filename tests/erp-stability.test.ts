import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ErpDomainError,
  computeAgingReport,
  computeFinancialStatements,
  computeTrialBalance,
  createUuid,
  ensureCompanyAccounts,
  postJournalEntry,
  reverseJournalEntry,
  setFiscalPeriodStatus,
} from '@/src/core/engine/accountingEngine';
import {
  EMPTY_ERP_DATABASE_STATE,
  TransactionScope,
  txAddCatalogueItem,
  txAdjustStock,
  txCreatePurchaseOrder,
  txCreateSalesOrder,
  txDispatchSalesOrder,
  txExportCompanyBackup,
  txImportCompanyBackup,
  txReceivePurchaseOrder,
  txRecordPurchasePayment,
  txRecordSalesPayment,
  txRunMonthlyPayroll,
} from '@/src/core/engine/erpTransactions';
import {
  txApproveExpenseClaim,
  txCompleteWorkOrder,
  txCreateCreditNote,
  txRegisterFixedAsset,
  txRunMonthlyDepreciation,
  txTransferStockBetweenWarehouses,
} from '@/src/core/engine/erpModuleTransactions';
import { migrateBackupJsonToPostgres } from '@/src/db/client';
import { AuthorizationError, authorizeCompanyAccess } from '@/src/server/security';
import { decryptCredential, encryptCredential } from '@/src/server/crypto';
import { LicenseServerError, createLicenseService } from '@/src/server/licensing';
import {
  LicenseRegistrationBlueprintSchema,
  evaluateLicenseEntitlement,
  validateLicenseKeyFormat,
} from '@/src/lib/firebaseLicense';
import {
  buildInventoryTurnoverSeries,
  buildMonthlySalesTrends,
} from '@/src/core/engine/chartDataHelpers';
import {
  DashboardExportSnapshot,
  buildExportFilename,
  generateDashboardCsvReport,
  generateDashboardPdfReport,
} from '@/src/core/engine/dashboardExport';
import type { SessionPrincipal } from '@/src/core/contracts/tenancy';
import type { AuditLogRecord, ErpDatabaseState } from '@/src/core/store/erpTypes';

const COMPANY_A = createUuid();
const COMPANY_B = createUuid();
const BRANCH_A = createUuid();
const USER_A = createUuid();

const SCOPE_A: TransactionScope = {
  companyId: COMPANY_A,
  branchId: BRANCH_A,
  actorUserId: USER_A,
  actorRole: 'owner',
};

function baseState(): ErpDatabaseState {
  return ensureCompanyAccounts(EMPTY_ERP_DATABASE_STATE, COMPANY_A).nextState;
}

test('1. Invoice sent reserves stock without deducting physical stock; explicit dispatch deducts & blocks duplicate dispatch/posting', () => {
  let state = baseState();
  const itemRes = txAddCatalogueItem(state, SCOPE_A, {
    sku: 'LAP-100',
    name: 'Workstation Laptop',
    type: 'physical',
    category: 'Hardware',
    unit: 'Nos',
    costPrice: 500,
    sellingPrice: 1000,
    taxRate: 10,
    trackStock: true,
    stockOnHand: 10,
    reorderLevel: 2,
  });
  state = itemRes.nextState;

  const invRes = txCreateSalesOrder(state, SCOPE_A, {
    documentType: 'invoice',
    customerName: 'Acme Buyer',
    issueDate: '2026-11-10',
    dueDate: '2026-11-25',
    status: 'sent',
    lines: [
      {
        itemId: itemRes.item.id,
        description: 'Workstation Laptop',
        quantity: 3,
        unitPrice: 1000,
        taxRate: 10,
      },
    ],
    notes: 'Net 15',
  });
  state = invRes.nextState;

  // Sending invoice must reserve stock, NOT deduct physical on-hand stock
  const itemAfterInvoice = state.catalogue.find((c) => c.id === itemRes.item.id)!;
  assert.equal(itemAfterInvoice.stockOnHand, 10);
  assert.equal(itemAfterInvoice.reservedQty, 3);
  assert.equal(invRes.order.fulfillmentStatus, 'reserved');
  assert.equal(invRes.order.stockPosted, false);
  assert.equal(invRes.order.ledgerPosted, true);

  // Duplicate invoice accrual posting via same idempotency key must be rejected
  assert.throws(
    () =>
      postJournalEntry(state, {
        companyId: COMPANY_A,
        branchId: BRANCH_A,
        date: '2026-11-10',
        reference: invRes.order.documentNumber,
        description: 'Duplicate invoice post',
        sourceModule: 'sales',
        sourceId: invRes.order.id,
        idempotencyKey: `sales-invoice-accrual:${invRes.order.id}`,
        lines: [
          { accountCode: '1200', debit: 3300, credit: 0 },
          { accountCode: '4000', debit: 0, credit: 3000 },
          { accountCode: '2200', debit: 0, credit: 300 },
        ],
      }),
    (err: unknown) =>
      err instanceof ErpDomainError && err.code === 'DUPLICATE_JOURNAL_POSTING',
  );

  // Explicit dispatch deducts physical stock, releases reservation, and posts COGS
  const dispRes = txDispatchSalesOrder(state, SCOPE_A, {
    orderId: invRes.order.id,
    dispatchDate: '2026-11-11',
  });
  state = dispRes.nextState;

  const itemAfterDispatch = state.catalogue.find((c) => c.id === itemRes.item.id)!;
  assert.equal(itemAfterDispatch.stockOnHand, 7);
  assert.equal(itemAfterDispatch.reservedQty, 0);
  assert.equal(dispRes.order.fulfillmentStatus, 'dispatched');
  assert.equal(dispRes.order.stockPosted, true);

  // Duplicate dispatch must be blocked
  assert.throws(
    () =>
      txDispatchSalesOrder(state, SCOPE_A, {
        orderId: invRes.order.id,
        dispatchDate: '2026-11-11',
      }),
    (err: unknown) => err instanceof ErpDomainError && err.code === 'DUPLICATE_DISPATCH',
  );

  // Payment allocation settles AR into Cash/Bank
  const payRes = txRecordSalesPayment(state, SCOPE_A, {
    orderId: invRes.order.id,
    amount: 3300,
    paymentDate: '2026-11-12',
    method: 'bank',
  });
  state = payRes.nextState;

  const tb = computeTrialBalance(state, COMPANY_A);
  assert.equal(tb.isBalanced, true);
  assert.equal(tb.rows.find((r) => r.code === '1200')?.netBalance, 0);
  assert.equal(tb.rows.find((r) => r.code === '4000')?.netBalance, 3000);
  assert.equal(tb.rows.find((r) => r.code === '2200')?.netBalance, 300);
  assert.equal(tb.rows.find((r) => r.code === '5000')?.netBalance, 1500);
});

test('2. Duplicate purchase receipt is blocked and GRN updates weighted-average valuation & AP', () => {
  let state = baseState();
  const itemRes = txAddCatalogueItem(state, SCOPE_A, {
    sku: 'SSD-1TB',
    name: 'NVMe SSD 1TB',
    type: 'physical',
    category: 'Storage',
    unit: 'Nos',
    costPrice: 100,
    sellingPrice: 180,
    taxRate: 10,
    trackStock: true,
    stockOnHand: 2,
    reorderLevel: 1,
  });
  state = itemRes.nextState;

  const poRes = txCreatePurchaseOrder(state, SCOPE_A, {
    vendorName: 'Silicon Supply Co',
    orderDate: '2026-11-10',
    expectedDate: '2026-11-15',
    status: 'ordered',
    lines: [
      {
        itemId: itemRes.item.id,
        description: 'NVMe SSD 1TB',
        quantity: 2,
        unitPrice: 120,
        taxRate: 10,
      },
    ],
    notes: 'Batch order',
  });
  state = poRes.nextState;

  const grnRes = txReceivePurchaseOrder(state, SCOPE_A, {
    orderId: poRes.order.id,
    receiptDate: '2026-11-12',
    batchNumber: 'BATCH-SSD-01',
  });
  state = grnRes.nextState;

  const itemAfterGrn = state.catalogue.find((c) => c.id === itemRes.item.id)!;
  assert.equal(itemAfterGrn.stockOnHand, 4);
  assert.equal(itemAfterGrn.inventoryAssetValue, 440); // 200 + 240
  assert.equal(itemAfterGrn.costPrice, 110); // weighted average

  // Second receipt of same PO must fail with DUPLICATE_PURCHASE_RECEIPT
  assert.throws(
    () =>
      txReceivePurchaseOrder(state, SCOPE_A, {
        orderId: poRes.order.id,
        receiptDate: '2026-11-12',
      }),
    (err: unknown) =>
      err instanceof ErpDomainError && err.code === 'DUPLICATE_PURCHASE_RECEIPT',
  );

  // Settle AP
  const payRes = txRecordPurchasePayment(state, SCOPE_A, {
    orderId: poRes.order.id,
    amount: poRes.order.grandTotal,
    paymentDate: '2026-11-13',
  });
  state = payRes.nextState;
  const tb = computeTrialBalance(state, COMPANY_A);
  assert.equal(tb.isBalanced, true);
  assert.equal(tb.rows.find((r) => r.code === '2100')?.netBalance, 0);
});

test('3. Duplicate payroll execution for the same month is rejected', () => {
  let state = baseState();
  state = {
    ...state,
    employees: [
      {
        id: createUuid(),
        companyId: COMPANY_A,
        branchId: BRANCH_A,
        employeeCode: 'EMP-001',
        fullName: 'Priya Nair',
        email: 'priya@acme.example',
        department: 'Engineering',
        designation: 'Lead Engineer',
        monthlySalary: 4500,
        status: 'active',
        joinedDate: '2026-01-15',
        createdAt: new Date().toISOString(),
      },
    ],
  };

  const firstRun = txRunMonthlyPayroll(state, SCOPE_A, {
    periodKey: '2026-11',
    paymentDate: '2026-11-28',
  });
  state = firstRun.nextState;
  assert.equal(firstRun.payrollRun.totalGross, 4500);

  assert.throws(
    () =>
      txRunMonthlyPayroll(state, SCOPE_A, {
        periodKey: '2026-11',
        paymentDate: '2026-11-29',
      }),
    (err: unknown) => err instanceof ErpDomainError && err.code === 'DUPLICATE_PAYROLL_RUN',
  );
});

test('4. Concurrent inventory updates with stale version are rejected via optimistic locking', () => {
  let state = baseState();
  const itemRes = txAddCatalogueItem(state, SCOPE_A, {
    sku: 'MON-27',
    name: '27-inch Monitor',
    type: 'physical',
    category: 'Displays',
    unit: 'Nos',
    costPrice: 200,
    sellingPrice: 350,
    taxRate: 18,
    trackStock: true,
    stockOnHand: 5,
    reorderLevel: 1,
  });
  state = itemRes.nextState;
  const initialVersion = itemRes.item.version; // 1

  // First concurrent operator commits stock adjustment (v1 -> v2)
  const firstUpdate = txAdjustStock(state, SCOPE_A, {
    itemId: itemRes.item.id,
    direction: 'in',
    quantity: 3,
    reason: 'Warehouse A count',
    expectedVersion: initialVersion,
  });
  state = firstUpdate.nextState;
  assert.equal(firstUpdate.item.version, 2);
  assert.equal(firstUpdate.item.stockOnHand, 8);

  // Second concurrent operator still holding v1 must fail with CONCURRENCY_CONFLICT
  assert.throws(
    () =>
      txAdjustStock(state, SCOPE_A, {
        itemId: itemRes.item.id,
        direction: 'out',
        quantity: 2,
        reason: 'Stale terminal adjustment',
        expectedVersion: initialVersion,
      }),
    (err: unknown) => err instanceof ErpDomainError && err.code === 'CONCURRENCY_CONFLICT',
  );
});

test('5. Unbalanced journals & closed fiscal periods are rejected; immutable reversal restores balance', () => {
  let state = baseState();

  assert.throws(
    () =>
      postJournalEntry(state, {
        companyId: COMPANY_A,
        branchId: BRANCH_A,
        date: '2026-11-10',
        reference: 'BAD-01',
        description: 'Unbalanced entry',
        sourceModule: 'manual',
        idempotencyKey: 'bad-01',
        lines: [
          { accountCode: '5300', debit: 500, credit: 0 },
          { accountCode: '1000', debit: 0, credit: 400 },
        ],
      }),
    (err: unknown) => err instanceof ErpDomainError && err.code === 'UNBALANCED_JOURNAL',
  );

  const posted = postJournalEntry(state, {
    companyId: COMPANY_A,
    branchId: BRANCH_A,
    date: '2026-11-10',
    reference: 'JV-01',
    description: 'Office utilities',
    sourceModule: 'manual',
    idempotencyKey: 'jv-01',
    lines: [
      { accountCode: '5300', debit: 250, credit: 0 },
      { accountCode: '1000', debit: 0, credit: 250 },
    ],
  });
  state = posted.nextState;

  // Reversal creates an offsetting balanced journal instead of deleting history
  const reversed = reverseJournalEntry(state, {
    companyId: COMPANY_A,
    branchId: BRANCH_A,
    journalId: posted.journal.id,
    reversalDate: '2026-11-11',
    reason: 'Duplicate utility bill',
  });
  state = reversed.nextState;

  const tb = computeTrialBalance(state, COMPANY_A);
  assert.equal(tb.isBalanced, true);
  assert.equal(tb.rows.find((r) => r.code === '5300')?.netBalance, 0);
  assert.equal(state.journals.length, 2);

  // Close fiscal period 2026-11 and verify subsequent posting is blocked
  state = setFiscalPeriodStatus(state, COMPANY_A, '2026-11', 'closed');
  assert.throws(
    () =>
      postJournalEntry(state, {
        companyId: COMPANY_A,
        branchId: BRANCH_A,
        date: '2026-11-15',
        reference: 'CLOSED-01',
        description: 'Should fail in closed period',
        sourceModule: 'manual',
        idempotencyKey: 'closed-01',
        lines: [
          { accountCode: '5300', debit: 100, credit: 0 },
          { accountCode: '1000', debit: 0, credit: 100 },
        ],
      }),
    (err: unknown) => err instanceof ErpDomainError && err.code === 'FISCAL_PERIOD_CLOSED',
  );
});

test('6. Cross-company access attempts & insufficient RBAC permissions are denied and audited; credentials encrypt via AES-256-GCM', () => {
  const auditEvents: AuditLogRecord[] = [];
  const tenantId = createUuid();
  const principal: SessionPrincipal = {
    userId: USER_A,
    email: 'ops@company-a.local',
    fullName: 'Ops Manager',
    mfaEnabled: false,
    isPlatformAdmin: false,
    activeTenantId: tenantId,
    activeCompanyId: COMPANY_A,
    activeBranchId: BRANCH_A,
    subscriptionTier: 'self_hosted',
    memberships: [
      {
        membershipId: createUuid(),
        tenantId,
        companyId: COMPANY_A,
        companyCode: 'CMP-A',
        companyName: 'Company Alpha',
        legalName: 'Company Alpha LLC',
        industryClassification: 'retail',
        countryCode: 'US',
        baseCurrency: 'USD',
        timezone: 'UTC',
        roleSlug: 'sales_rep',
        roleName: 'Sales Representative',
        roleScope: 'company',
        permissions: [],
        enabledModules: ['catalogue', 'sales', 'crm'],
        branches: [],
        defaultBranchId: BRANCH_A,
      },
    ],
  };

  // Cross-company access to COMPANY_B must fail with 403 CROSS_COMPANY_ACCESS_DENIED
  assert.throws(
    () =>
      authorizeCompanyAccess(principal, COMPANY_B, 'sales.order.read', (e) =>
        auditEvents.push(e),
      ),
    (err: unknown) =>
      err instanceof AuthorizationError &&
      err.statusCode === 403 &&
      err.code === 'CROSS_COMPANY_ACCESS_DENIED',
  );
  assert.equal(auditEvents.at(-1)?.outcome, 'denied');

  // Role sales_rep lacks finance.journal.post permission on COMPANY_A
  assert.throws(
    () =>
      authorizeCompanyAccess(principal, COMPANY_A, 'finance.journal.post', (e) =>
        auditEvents.push(e),
      ),
    (err: unknown) =>
      err instanceof AuthorizationError &&
      err.statusCode === 403 &&
      err.code === 'INSUFFICIENT_ROLE_PERMISSION',
  );

  // Authorized action succeeds and logs audit event
  const ctx = authorizeCompanyAccess(principal, COMPANY_A, 'sales.order.create', (e) =>
    auditEvents.push(e),
  );
  assert.equal(ctx.membership.companyId, COMPANY_A);
  assert.equal(auditEvents.at(-1)?.outcome, 'success');

  // AES-256-GCM integration credential vault round-trip
  const secret = 'test-better-auth-secret-key-minimum-32-chars';
  const encrypted = encryptCredential('sk_live_super_secret_token_123', secret);
  assert.ok(encrypted.startsWith('v1:'));
  assert.ok(!encrypted.includes('sk_live_super_secret_token_123'));
  assert.equal(decryptCredential(encrypted, secret), 'sk_live_super_secret_token_123');
});

test('7. Backup & restore validates schema & restores state; PostgreSQL migration rolls back cleanly on SQL failure', async () => {
  let state = baseState();
  const itemRes = txAddCatalogueItem(state, SCOPE_A, {
    sku: 'KBD-PRO',
    name: 'Mechanical Keyboard',
    type: 'physical',
    category: 'Peripherals',
    unit: 'Nos',
    costPrice: 60,
    sellingPrice: 120,
    taxRate: 10,
    trackStock: true,
    stockOnHand: 5,
    reorderLevel: 1,
  });
  state = itemRes.nextState;

  const backupJson = txExportCompanyBackup(state, {
    companyId: COMPANY_A,
    companyCode: 'CMP-A',
    companyName: 'Company Alpha',
  });

  // Restore into a clean target company
  const scopeTarget: TransactionScope = {
    companyId: COMPANY_B,
    branchId: null,
    actorUserId: USER_A,
    actorRole: 'owner',
  };
  const restored = txImportCompanyBackup(EMPTY_ERP_DATABASE_STATE, scopeTarget, backupJson);
  assert.equal(restored.nextState.catalogue.length, 1);
  assert.equal(restored.nextState.catalogue[0]?.companyId, COMPANY_B);
  assert.equal(restored.nextState.journals.length, 1);

  // Tampered backup with unbalanced journal must be rejected
  const tampered = JSON.parse(backupJson);
  tampered.records.journals[0].totalCredit = 999999;
  assert.throws(
    () => txImportCompanyBackup(EMPTY_ERP_DATABASE_STATE, scopeTarget, JSON.stringify(tampered)),
    (err: unknown) => err instanceof ErpDomainError && err.code === 'BACKUP_VALIDATION_FAILED',
  );

  // PostgreSQL migration mock client verifying BEGIN -> failure -> ROLLBACK
  const executedSql: string[] = [];
  const failingPgClient = {
    async query(sql: string) {
      executedSql.push(sql);
      if (sql.includes('INSERT INTO finance.journals')) {
        throw new Error('simulated constraint violation');
      }
      return { rows: [], rowCount: 0 } as never;
    },
  };

  await assert.rejects(
    () =>
      migrateBackupJsonToPostgres(
        failingPgClient,
        { tenantId: createUuid(), companyId: COMPANY_A, userId: USER_A },
        backupJson,
      ),
    /simulated constraint violation/,
  );
  assert.equal(executedSql[0], 'BEGIN');
  assert.equal(executedSql.at(-1), 'ROLLBACK');
  assert.ok(!executedSql.includes('COMMIT'));

  // Successful PostgreSQL migration issues BEGIN -> COMMIT
  const okSql: string[] = [];
  const okPgClient = {
    async query(sql: string) {
      okSql.push(sql);
      return { rows: [], rowCount: 0 } as never;
    },
  };
  const summary = await migrateBackupJsonToPostgres(
    okPgClient,
    { tenantId: createUuid(), companyId: COMPANY_A, userId: USER_A },
    backupJson,
  );
  assert.equal(okSql[0], 'BEGIN');
  assert.equal(okSql.at(-1), 'COMMIT');
  assert.equal(summary.counts.catalogue, 1);
});

test('8. Failed multi-line dispatch transaction rolls back all prior line deductions and journals atomically', () => {
  let state = baseState();
  const item1 = txAddCatalogueItem(state, SCOPE_A, {
    sku: 'ITEM-OK',
    name: 'In-Stock Component',
    type: 'physical',
    category: 'Parts',
    unit: 'Nos',
    costPrice: 50,
    sellingPrice: 100,
    taxRate: 0,
    trackStock: true,
    stockOnHand: 5,
    reorderLevel: 1,
  });
  state = item1.nextState;

  const item2 = txAddCatalogueItem(state, SCOPE_A, {
    sku: 'ITEM-SHORT',
    name: 'Shortage Component',
    type: 'physical',
    category: 'Parts',
    unit: 'Nos',
    costPrice: 40,
    sellingPrice: 80,
    taxRate: 0,
    trackStock: true,
    stockOnHand: 1,
    reorderLevel: 1,
  });
  state = item2.nextState;

  // Create draft invoice with qty 2 of ITEM-OK and qty 3 of ITEM-SHORT, then simulate
  // a dispatch attempt that succeeds on line 1 (qty 2 <= 5) and fails on line 2 (qty 3 > 1).
  const draftOrderRes = txCreateSalesOrder(state, SCOPE_A, {
    documentType: 'invoice',
    customerName: 'Atomic Rollback Co',
    issueDate: '2026-11-10',
    dueDate: '2026-11-20',
    status: 'draft',
    lines: [
      {
        itemId: item1.item.id,
        description: 'In-Stock Component',
        quantity: 2,
        unitPrice: 100,
        taxRate: 0,
      },
      {
        itemId: item2.item.id,
        description: 'Shortage Component',
        quantity: 3,
        unitPrice: 80,
        taxRate: 0,
      },
    ],
    notes: 'Rollback verification',
  });
  state = draftOrderRes.nextState;
  const journalsBefore = state.journals.length;
  const movementsBefore = state.stockMovements.length;

  assert.throws(
    () =>
      txDispatchSalesOrder(state, SCOPE_A, {
        orderId: draftOrderRes.order.id,
        dispatchDate: '2026-11-11',
      }),
    (err: unknown) => err instanceof ErpDomainError && err.code === 'INSUFFICIENT_STOCK',
  );

  // Line 1 stock MUST remain untouched at 5, and zero partial movements or journals persisted
  assert.equal(state.catalogue.find((c) => c.id === item1.item.id)?.stockOnHand, 5);
  assert.equal(state.catalogue.find((c) => c.id === item2.item.id)?.stockOnHand, 1);
  assert.equal(state.journals.length, journalsBefore);
  assert.equal(state.stockMovements.length, movementsBefore);
});

test('9. Manufacturing BOM work order consumes raw materials, receives finished goods, and posts conversion capitalization atomically', () => {
  let state = baseState();
  const rawSteel = txAddCatalogueItem(state, SCOPE_A, {
    sku: 'RAW-STEEL',
    name: 'Cold Rolled Steel Sheet',
    type: 'physical',
    category: 'Raw Material',
    unit: 'Kg',
    costPrice: 25,
    sellingPrice: 0,
    taxRate: 0,
    trackStock: true,
    stockOnHand: 20,
    reorderLevel: 5,
  });
  state = rawSteel.nextState;

  const finishedFrame = txAddCatalogueItem(state, SCOPE_A, {
    sku: 'FG-FRAME',
    name: 'Industrial Rack Frame',
    type: 'physical',
    category: 'Finished Goods',
    unit: 'Nos',
    costPrice: 100,
    sellingPrice: 280,
    taxRate: 18,
    trackStock: true,
    stockOnHand: 0,
    reorderLevel: 2,
  });
  state = finishedFrame.nextState;

  const bomId = createUuid();
  const woId = createUuid();
  const shortWoId = createUuid();

  state = {
    ...state,
    boms: [
      {
        id: bomId,
        companyId: COMPANY_A,
        bomCode: 'BOM-0001',
        finishedItemId: finishedFrame.item.id,
        finishedSku: finishedFrame.item.sku,
        finishedName: finishedFrame.item.name,
        components: [
          {
            itemId: rawSteel.item.id,
            sku: rawSteel.item.sku,
            name: rawSteel.item.name,
            quantityPerUnit: 4,
            unitCost: 25,
          },
        ],
        laborCostPerUnit: 15,
        overheadCostPerUnit: 10,
        notes: 'Standard steel frame assembly',
        createdAt: new Date().toISOString(),
      },
    ],
    workOrders: [
      {
        id: woId,
        companyId: COMPANY_A,
        woNumber: 'WO-0001',
        bomId,
        finishedItemId: finishedFrame.item.id,
        finishedSku: finishedFrame.item.sku,
        finishedName: finishedFrame.item.name,
        targetQty: 3,
        completedQty: 0,
        status: 'materials_issued',
        startDate: '2026-11-12',
        dueDate: '2026-11-20',
        totalMaterialCost: 0,
        totalConversionCost: 0,
        createdAt: new Date().toISOString(),
      },
      {
        id: shortWoId,
        companyId: COMPANY_A,
        woNumber: 'WO-0002',
        bomId,
        finishedItemId: finishedFrame.item.id,
        finishedSku: finishedFrame.item.sku,
        finishedName: finishedFrame.item.name,
        targetQty: 10, // needs 40kg, only 20kg -> 8kg left after WO-0001
        completedQty: 0,
        status: 'planned',
        startDate: '2026-11-13',
        dueDate: '2026-11-22',
        totalMaterialCost: 0,
        totalConversionCost: 0,
        createdAt: new Date().toISOString(),
      },
    ],
  };

  // Complete WO-0001 (3 units * 4 kg = 12 kg raw material consumed, 3 * $25 conversion = $75 capitalized)
  const completed = txCompleteWorkOrder(state, SCOPE_A, {
    workOrderId: woId,
    completionDate: '2026-11-14',
  });
  state = completed.nextState;

  assert.equal(completed.workOrder.status, 'completed');
  assert.equal(completed.workOrder.totalMaterialCost, 300); // 12 * 25
  assert.equal(completed.workOrder.totalConversionCost, 75); // 3 * (15 + 10)

  const steelAfter = state.catalogue.find((c) => c.id === rawSteel.item.id)!;
  const fgAfter = state.catalogue.find((c) => c.id === finishedFrame.item.id)!;
  assert.equal(steelAfter.stockOnHand, 8);
  assert.equal(fgAfter.stockOnHand, 3);
  assert.equal(fgAfter.inventoryAssetValue, 375);
  assert.equal(fgAfter.costPrice, 125); // (300 + 75) / 3
  assert.ok(state.stockMovements.some((m) => m.movementType === 'production_output' && m.reference === 'WO-0001'));

  // Insufficient raw material on WO-0002 rolls back cleanly
  assert.throws(
    () => txCompleteWorkOrder(state, SCOPE_A, { workOrderId: shortWoId, completionDate: '2026-11-15' }),
    (err: unknown) => err instanceof ErpDomainError && err.code === 'INSUFFICIENT_RAW_MATERIAL',
  );
  assert.equal(state.catalogue.find((c) => c.id === rawSteel.item.id)?.stockOnHand, 8);

  const tb = computeTrialBalance(state, COMPANY_A);
  assert.equal(tb.isBalanced, true);
});

test('10. Fixed asset registration & monthly straight-line depreciation post balanced journals and block duplicate period runs', () => {
  let state = baseState();

  const acquired = txRegisterFixedAsset(state, SCOPE_A, {
    name: 'CNC Milling Machine',
    category: 'Machinery',
    purchaseDate: '2026-11-01',
    purchaseCost: 13000,
    salvageValue: 1000,
    usefulLifeMonths: 12,
    postAcquisitionJournal: true,
    paymentAccountCode: '1000',
  });
  state = acquired.nextState;

  assert.equal(acquired.asset.assetCode, 'FA-0001');
  assert.equal(acquired.asset.accumulatedDepreciation, 0);

  // Monthly depreciation = (13000 - 1000) / 12 = 1000
  const dep = txRunMonthlyDepreciation(state, SCOPE_A, {
    periodKey: '2026-11',
    postingDate: '2026-11-30',
  });
  state = dep.nextState;
  assert.equal(dep.totalDepreciation, 1000);
  assert.equal(dep.assetsCount, 1);

  const assetAfter = state.fixedAssets.find((a) => a.id === acquired.asset.id)!;
  assert.equal(assetAfter.accumulatedDepreciation, 1000);

  // Second run for the same fiscal period must fail cleanly
  assert.throws(
    () => txRunMonthlyDepreciation(state, SCOPE_A, { periodKey: '2026-11', postingDate: '2026-11-30' }),
    (err: unknown) => err instanceof ErpDomainError && err.code === 'NO_DEPRECIATION_DUE',
  );

  const tb = computeTrialBalance(state, COMPANY_A);
  assert.equal(tb.isBalanced, true);
  assert.equal(tb.rows.find((r) => r.code === '1500')?.netBalance, 13000);
  assert.equal(tb.rows.find((r) => r.code === '5500')?.netBalance, 1000);
});

test('11. Credit notes restore inventory & reverse AR/Revenue; Expense claims post balanced journals; Warehouse transfers block over-transfer', () => {
  let state = baseState();
  const itemRes = txAddCatalogueItem(state, SCOPE_A, {
    sku: 'RTR-AX6',
    name: 'Enterprise Wi-Fi 6 Router',
    type: 'physical',
    category: 'Networking',
    unit: 'Nos',
    costPrice: 80,
    sellingPrice: 200,
    taxRate: 10,
    trackStock: true,
    stockOnHand: 10,
    reorderLevel: 2,
  });
  state = itemRes.nextState;

  const inv = txCreateSalesOrder(state, SCOPE_A, {
    documentType: 'invoice',
    customerName: 'Branch Office Corp',
    issueDate: '2026-11-10',
    dueDate: '2026-11-20',
    status: 'sent',
    lines: [{ itemId: itemRes.item.id, description: 'Enterprise Wi-Fi 6 Router', quantity: 2, unitPrice: 200, taxRate: 10 }],
    notes: 'Direct delivery',
  });
  state = inv.nextState;
  state = txDispatchSalesOrder(state, SCOPE_A, { orderId: inv.order.id, dispatchDate: '2026-11-11' }).nextState;
  assert.equal(state.catalogue.find((c) => c.id === itemRes.item.id)?.stockOnHand, 8);

  // Issue Credit Note restoring stock
  const cn = txCreateCreditNote(state, SCOPE_A, {
    salesOrderId: inv.order.id,
    issueDate: '2026-11-12',
    reason: 'Customer returned unopened units',
    restoreStock: true,
  });
  state = cn.nextState;

  assert.equal(cn.creditNote.grandTotal, 440);
  assert.equal(state.catalogue.find((c) => c.id === itemRes.item.id)?.stockOnHand, 10);
  assert.equal(state.salesOrders.find((o) => o.id === inv.order.id)?.status, 'cancelled');

  // Expense Claim approval & posting
  const claimId = createUuid();
  state = {
    ...state,
    expenseClaims: [
      {
        id: claimId,
        companyId: COMPANY_A,
        claimNumber: 'EXP-0001',
        employeeName: 'Aarav Mehta',
        category: 'Travel',
        expenseDate: '2026-11-13',
        amount: 220,
        taxAmount: 20,
        description: 'Client onsite visit cab & toll',
        status: 'pending',
        createdAt: new Date().toISOString(),
      },
    ],
  };
  const expPosted = txApproveExpenseClaim(state, SCOPE_A, {
    claimId,
    payImmediately: true,
    postingDate: '2026-11-13',
  });
  state = expPosted.nextState;
  assert.equal(expPosted.claim.status, 'paid');

  // Warehouse transfer & over-transfer rejection
  const trf = txTransferStockBetweenWarehouses(state, SCOPE_A, {
    itemId: itemRes.item.id,
    fromWarehouse: 'Main DC',
    toWarehouse: 'West Hub',
    quantity: 4,
    notes: 'Rebalance stock',
  });
  state = trf.nextState;
  assert.equal(trf.transfer.quantity, 4);

  assert.throws(
    () =>
      txTransferStockBetweenWarehouses(state, SCOPE_A, {
        itemId: itemRes.item.id,
        fromWarehouse: 'Main DC',
        toWarehouse: 'West Hub',
        quantity: 99,
        notes: 'Over transfer',
      }),
    (err: unknown) => err instanceof ErpDomainError && err.code === 'INSUFFICIENT_AVAILABLE_STOCK',
  );

  const tb = computeTrialBalance(state, COMPANY_A);
  assert.equal(tb.isBalanced, true);
  assert.equal(tb.rows.find((r) => r.code === '1200')?.netBalance, 0);
  assert.equal(tb.rows.find((r) => r.code === '4000')?.netBalance, 0);
});

test('12. Approval rules enforce holds on large POs; Financial Statements balance and Aging buckets overdue AR/AP accurately', () => {
  let state = baseState();
  state = {
    ...state,
    approvalRules: [
      {
        id: createUuid(),
        companyId: COMPANY_A,
        name: 'Director PO Sign-off > $5,000',
        module: 'purchase',
        minAmount: 5000,
        approverRole: 'finance_manager',
        active: true,
        createdAt: new Date().toISOString(),
      },
    ],
  };

  // PO above $5,000 must be held in draft with requiresApproval = true
  const largePo = txCreatePurchaseOrder(state, SCOPE_A, {
    vendorName: 'Global Server Supply',
    orderDate: '2026-09-01',
    expectedDate: '2026-09-15',
    status: 'ordered',
    lines: [{ description: 'Rack Server Cluster', quantity: 1, unitPrice: 6000, taxRate: 10 }],
    notes: 'Q4 expansion',
  });
  state = largePo.nextState;
  assert.equal(largePo.order.requiresApproval, true);
  assert.equal(largePo.order.status, 'draft');

  // Create two unpaid invoices with different due dates to test Aging buckets
  const invCurrent = txCreateSalesOrder(state, SCOPE_A, {
    documentType: 'invoice',
    customerName: 'Current Client',
    issueDate: '2026-11-10',
    dueDate: '2026-11-30',
    status: 'sent',
    lines: [{ description: 'Annual Retainer', quantity: 1, unitPrice: 1000, taxRate: 0 }],
    notes: 'Current bucket',
  });
  state = invCurrent.nextState;

  const invOverdue45 = txCreateSalesOrder(state, SCOPE_A, {
    documentType: 'invoice',
    customerName: 'Delayed Client',
    issueDate: '2026-09-01',
    dueDate: '2026-10-01',
    status: 'sent',
    lines: [{ description: 'Integration Project', quantity: 1, unitPrice: 2500, taxRate: 0 }],
    notes: '45 days overdue as of 2026-11-15',
  });
  state = invOverdue45.nextState;

  const aging = computeAgingReport(state, COMPANY_A, '2026-11-15');
  assert.equal(aging.ar.current, 1000);
  assert.equal(aging.ar.days31to60, 2500);
  assert.equal(aging.ar.total, 3500);

  const fsReport = computeFinancialStatements(state, COMPANY_A);
  assert.equal(fsReport.balanceSheetBalanced, true);
  assert.equal(fsReport.totalRevenue, 3500);
  assert.equal(fsReport.totalAssets, 3500);
});

test('13. License authentication server registers users, issues signed keys, binds devices, and rejects invalid passwords or keys', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wendoro-lic-test-'));
  try {
    const service = createLicenseService({
      dataDir: tmpDir,
      signingSecret: 'unit-test-signing-secret-at-least-32-chars',
    });

    // 1. Register account & issue key
    const reg = service.registerAndIssueLicense({
      email: 'ops@redyellow.example',
      password: 'StrongPassword123',
      fullName: 'Rohan Kapoor',
      organizationName: 'RedYellow Logistics',
      planTier: 'professional',
      platform: 'both',
    });
    assert.ok(reg.license.licenseKey.startsWith('WND-PROF-'));
    assert.equal(reg.license.status, 'active');
    assert.equal(reg.license.usedDevices, 0);

    // 2. Login lists issued licenses; wrong password rejects with 401
    const loginRes = service.loginAndListLicenses({
      email: 'ops@redyellow.example',
      password: 'StrongPassword123',
    });
    assert.equal(loginRes.licenses.length, 1);
    assert.equal(loginRes.licenses[0]?.licenseKey, reg.license.licenseKey);

    assert.throws(
      () =>
        service.loginAndListLicenses({
          email: 'ops@redyellow.example',
          password: 'WrongPassword!',
        }),
      (err: unknown) => err instanceof LicenseServerError && err.statusCode === 401,
    );

    // 3. Activate key on a desktop device
    const act = service.activateLicense({
      licenseKey: reg.license.licenseKey,
      deviceId: 'desktop-win-001',
      deviceName: 'Warehouse Windows PC',
      platform: 'desktop',
      appVersion: '1.0.0',
    });
    assert.equal(act.valid, true);
    assert.ok(act.activationToken.length > 20);
    assert.equal(act.license.usedDevices, 1);

    // 4. Verify real key & reject tampered key
    const okCheck = service.verifyLicense({
      licenseKey: reg.license.licenseKey,
      deviceId: 'desktop-win-001',
    });
    assert.equal(okCheck.valid, true);
    assert.equal(okCheck.deviceBound, true);

    const badCheck = service.verifyLicense({
      licenseKey: 'WND-PROF-00000000-BAD00000',
    });
    assert.equal(badCheck.valid, false);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('14. Firebase license verification module validates key format, blueprint schema, revocation, expiry, platform scope, and device quota', () => {
  // Format validation
  const okFmt = validateLicenseKeyFormat('  wnd-prof-12ab34cd-98fe76dc  ');
  assert.equal(okFmt.valid, true);
  assert.equal(okFmt.normalized, 'WND-PROF-12AB34CD-98FE76DC');
  assert.equal(okFmt.tierCode, 'PROF');

  assert.equal(validateLicenseKeyFormat('INVALID-KEY').valid, false);
  assert.equal(validateLicenseKeyFormat('WND-XXXX-12345678-12345678').valid, false);

  // Blueprint schema validation rejects oversized/tampered documents
  const validBlueprint = LicenseRegistrationBlueprintSchema.parse({
    licenseKey: 'WND-PROF-12AB34CD-98FE76DC',
    ownerUid: 'firebase-user-01',
    organizationName: 'Crimson Logistics Pvt Ltd',
    planTier: 'professional',
    platform: 'both',
    status: 'active',
    maxDevices: 5,
    signature: '98FE76DCABCDEF12',
    expiresAt: '2028-01-01T00:00:00.000Z',
  });
  assert.equal(validBlueprint.planTier, 'professional');

  assert.throws(() =>
    LicenseRegistrationBlueprintSchema.parse({
      licenseKey: 'WND-PROF-12AB34CD-98FE76DC',
      ownerUid: 'bad uid with spaces!',
      organizationName: 'Acme',
      planTier: 'enterprise',
      platform: 'both',
      status: 'active',
      maxDevices: 999999,
      signature: '98FE76DC',
      expiresAt: 'never',
    }),
  );

  // Entitlement rules
  const allowedDesktop = evaluateLicenseEntitlement({
    license: validBlueprint,
    currentPlatform: 'desktop',
    boundDevicesCount: 2,
    alreadyBoundOnThisDevice: false,
    nowMs: Date.parse('2026-11-15T00:00:00.000Z'),
  });
  assert.equal(allowedDesktop.allowed, true);

  const revoked = evaluateLicenseEntitlement({
    license: { ...validBlueprint, status: 'revoked' },
    currentPlatform: 'desktop',
    boundDevicesCount: 1,
    alreadyBoundOnThisDevice: true,
  });
  assert.equal(revoked.allowed, false);
  assert.equal(revoked.code, 'LICENSE_INACTIVE');

  const expired = evaluateLicenseEntitlement({
    license: { ...validBlueprint, expiresAt: '2025-01-01T00:00:00.000Z' },
    currentPlatform: 'desktop',
    boundDevicesCount: 1,
    alreadyBoundOnThisDevice: true,
    nowMs: Date.parse('2026-11-15T00:00:00.000Z'),
  });
  assert.equal(expired.allowed, false);
  assert.equal(expired.code, 'LICENSE_EXPIRED');

  const wrongPlatform = evaluateLicenseEntitlement({
    license: { ...validBlueprint, platform: 'android' },
    currentPlatform: 'desktop',
    boundDevicesCount: 0,
    alreadyBoundOnThisDevice: false,
  });
  assert.equal(wrongPlatform.allowed, false);
  assert.equal(wrongPlatform.code, 'PLATFORM_NOT_LICENSED');

  const seatFull = evaluateLicenseEntitlement({
    license: { ...validBlueprint, maxDevices: 2 },
    currentPlatform: 'android',
    boundDevicesCount: 2,
    alreadyBoundOnThisDevice: false,
  });
  assert.equal(seatFull.allowed, false);
  assert.equal(seatFull.code, 'ACTIVATION_LIMIT_REACHED');

  // Already-bound device still refreshes cleanly even at maxDevices
  const seatExisting = evaluateLicenseEntitlement({
    license: { ...validBlueprint, maxDevices: 2 },
    currentPlatform: 'android',
    boundDevicesCount: 2,
    alreadyBoundOnThisDevice: true,
  });
  assert.equal(seatExisting.allowed, true);
});

test('15. Recharts chart aggregators compute Monthly Sales Trends and Inventory Turnover from live orders and stock movements', () => {
  let state = baseState();
  const skuA = txAddCatalogueItem(state, SCOPE_A, {
    sku: 'RED-PUMP',
    name: 'Hydraulic Pump Red',
    type: 'physical',
    category: 'Machinery',
    unit: 'Nos',
    costPrice: 200,
    sellingPrice: 450,
    taxRate: 10,
    trackStock: true,
    stockOnHand: 10,
    reorderLevel: 2,
  });
  state = skuA.nextState;

  // Month 1 invoice ($990 total), partially paid ($500) and dispatched (2 units out -> 8 remaining)
  const invOct = txCreateSalesOrder(state, SCOPE_A, {
    documentType: 'invoice',
    customerName: 'Apex Industries',
    issueDate: '2026-10-14',
    dueDate: '2026-10-30',
    status: 'sent',
    lines: [{ itemId: skuA.item.id, description: 'Hydraulic Pump Red', quantity: 2, unitPrice: 450, taxRate: 10 }],
    notes: 'Oct batch',
  });
  state = invOct.nextState;
  state = txDispatchSalesOrder(state, SCOPE_A, { orderId: invOct.order.id, dispatchDate: '2026-10-15' }).nextState;
  state = txRecordSalesPayment(state, SCOPE_A, {
    orderId: invOct.order.id,
    amount: 500,
    paymentDate: '2026-10-20',
    method: 'bank',
  }).nextState;

  // Month 2 invoice ($1,485 total), fully paid and dispatched (3 units out -> 5 remaining)
  const invNov = txCreateSalesOrder(state, SCOPE_A, {
    documentType: 'invoice',
    customerName: 'Beacon Logistics',
    issueDate: '2026-11-05',
    dueDate: '2026-11-20',
    status: 'sent',
    lines: [{ itemId: skuA.item.id, description: 'Hydraulic Pump Red', quantity: 3, unitPrice: 450, taxRate: 10 }],
    notes: 'Nov batch',
  });
  state = invNov.nextState;
  state = txDispatchSalesOrder(state, SCOPE_A, { orderId: invNov.order.id, dispatchDate: '2026-11-06' }).nextState;
  state = txRecordSalesPayment(state, SCOPE_A, {
    orderId: invNov.order.id,
    amount: 1485,
    paymentDate: '2026-11-08',
    method: 'bank',
  }).nextState;

  const monthlyTrends = buildMonthlySalesTrends(state, 'month');
  assert.equal(monthlyTrends.length, 2);
  assert.equal(monthlyTrends[0]?.periodKey, '2026-10');
  assert.equal(monthlyTrends[0]?.invoiced, 990);
  assert.equal(monthlyTrends[0]?.collected, 500);
  assert.equal(monthlyTrends[0]?.orderCount, 1);

  assert.equal(monthlyTrends[1]?.periodKey, '2026-11');
  assert.equal(monthlyTrends[1]?.invoiced, 1485);
  assert.equal(monthlyTrends[1]?.collected, 1485);
  assert.equal(monthlyTrends[1]?.orderCount, 1);

  const turnover = buildInventoryTurnoverSeries(state);
  assert.equal(turnover.length, 1);
  assert.equal(turnover[0]?.sku, 'RED-PUMP');
  assert.equal(turnover[0]?.unitsDispatched, 5);
  assert.equal(turnover[0]?.stockOnHand, 5);
  assert.equal(turnover[0]?.cogsOutValue, 1000);
  assert.equal(turnover[0]?.assetValue, 1000);
  assert.equal(turnover[0]?.turnoverRatio, 1);
});

test('16. Dashboard Export utility generates RFC-4180 CSV and valid binary PDF 1.4 reports offline', () => {
  const snapshot: DashboardExportSnapshot = {
    companyName: 'Crimson & Gold "Industries", LLC',
    companyCode: 'CMP_01',
    branchName: 'Main Warehouse',
    currency: 'USD',
    granularity: 'month',
    generatedAt: '2026-11-15 10:15:00',
    metrics: {
      totalRevenue: 24750,
      openReceivables: 4900,
      totalExpenses: 11200,
      openPayables: 2100,
      netIncome: 13550,
      inventoryAssetValue: 8600,
      lowStockCount: 2,
      openTasksCount: 4,
      openTicketsCount: 1,
      balancedJournalsCount: 18,
      collectionRatePct: 80,
      avgInventoryTurnover: 1.45,
      totalDispatchedUnits: 32,
    },
    monthlySalesTrends: [
      {
        periodKey: '2026-10',
        label: 'Oct 26',
        invoiced: 9900,
        collected: 7500,
        expenses: 4200,
        orderCount: 4,
      },
      {
        periodKey: '2026-11',
        label: 'Nov 26',
        invoiced: 14850,
        collected: 12350,
        expenses: 7000,
        orderCount: 6,
      },
    ],
    inventoryTurnover: [
      {
        sku: 'RED-PUMP',
        name: 'Hydraulic Pump, "Heavy Duty"',
        unitsDispatched: 20,
        stockOnHand: 8,
        cogsOutValue: 4000,
        assetValue: 1600,
        turnoverRatio: 2.5,
      },
    ],
    cashFlowSeries: [{ label: '2026-11', primary: 24750, secondary: 11200 }],
    channelBars: [
      { label: 'Direct B2B', primary: 18000, secondary: 14000 },
      { label: 'Retail POS', primary: 6750, secondary: 5850 },
    ],
    balanceSlices: [
      { label: 'Cash & Bank (1000)', value: 19850, color: '#F59E0B' },
      { label: 'Receivables AR (1200)', value: 4900, color: '#DC2626' },
    ],
    topInventoryBars: [{ label: 'RED-PUMP', primary: 1600, secondary: 3600 }],
  };

  assert.equal(
    buildExportFilename('CMP_01', 'pdf', '2026-11-15 10:15:00'),
    'wendoro-cmp-01-business-metrics-2026-11-15.pdf',
  );
  assert.equal(
    buildExportFilename('CMP_01', 'csv', '2026-11-15 10:15:00'),
    'wendoro-cmp-01-business-metrics-2026-11-15.csv',
  );

  // Verify CSV content & RFC-4180 escaping
  const csv = generateDashboardCsvReport(snapshot);
  assert.ok(csv.startsWith('\uFEFFWENDORO ERP'));
  assert.ok(csv.includes('"Crimson & Gold ""Industries"", LLC"'));
  assert.ok(csv.includes('"Hydraulic Pump, ""Heavy Duty"""'));
  assert.ok(csv.includes('SECTION 2: MONTHLY SALES TRENDS'));
  assert.ok(csv.includes('SECTION 3: INVENTORY TURNOVER BY SKU'));
  assert.ok(csv.includes('Oct 26,2026-10,4,9900.00,7500.00,4200.00,76%'));

  // Verify binary PDF 1.4 structure and exact xref byte offsets
  const pdfBytes = generateDashboardPdfReport(snapshot);
  const pdfText = Buffer.from(pdfBytes).toString('latin1');
  assert.ok(pdfText.startsWith('%PDF-1.4\n'));
  assert.ok(pdfText.endsWith('%%EOF\n'));
  assert.ok(pdfText.includes('/Type /Catalog'));
  assert.ok(pdfText.includes('/BaseFont /Helvetica-Bold'));
  assert.ok(pdfText.includes('WENDORO ERP - EXECUTIVE BUSINESS METRICS'));
  assert.ok(pdfText.includes('RED-PUMP'));

  // Validate xref byte offsets point cleanly to each "N 0 obj"
  const xrefIdx = pdfText.indexOf('xref\n');
  assert.ok(xrefIdx > 0);
  const xrefBlock = pdfText.slice(xrefIdx);
  const entryMatches = [...xrefBlock.matchAll(/(\d{10}) 00000 n /g)];
  assert.ok(entryMatches.length >= 6);
  entryMatches.forEach((m, i) => {
    const offset = Number(m[1]);
    const slice = pdfText.slice(offset, offset + 12);
    assert.ok(slice.startsWith(`${i + 1} 0 obj`), `Expected object ${i + 1} at byte ${offset}, found "${slice}"`);
  });
});

