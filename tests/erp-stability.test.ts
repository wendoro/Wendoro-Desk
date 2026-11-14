import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ErpDomainError,
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
import { migrateBackupJsonToPostgres } from '@/src/db/client';
import { AuthorizationError, authorizeCompanyAccess } from '@/src/server/security';
import { decryptCredential, encryptCredential } from '@/src/server/crypto';
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
