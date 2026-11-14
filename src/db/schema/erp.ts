import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { branches, companies, tenants } from './organization';
import { users } from './identity';

export const catalogueSchema = pgSchema('catalogue');
export const crmSchema = pgSchema('crm');
export const financeSchema = pgSchema('finance');
export const inventorySchema = pgSchema('inventory');
export const salesSchema = pgSchema('sales');
export const purchaseSchema = pgSchema('purchase');
export const hrSchema = pgSchema('hr');
export const operationsSchema = pgSchema('operations');
export const integrationsSchema = pgSchema('integrations');

export const catalogueItems = catalogueSchema.table(
  'items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    sku: text('sku').notNull(),
    name: text('name').notNull(),
    itemType: text('item_type').notNull().default('physical'),
    category: text('category').notNull().default('General'),
    unit: text('unit').notNull().default('Nos'),
    costPrice: numeric('cost_price', { precision: 18, scale: 4 }).notNull().default('0'),
    sellingPrice: numeric('selling_price', { precision: 18, scale: 4 }).notNull().default('0'),
    taxRate: numeric('tax_rate', { precision: 7, scale: 4 }).notNull().default('0'),
    trackStock: boolean('track_stock').notNull().default(true),
    reorderLevel: numeric('reorder_level', { precision: 18, scale: 4 }).notNull().default('0'),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('cat_items_company_sku_uidx').on(t.companyId, t.sku),
    index('cat_items_tenant_company_idx').on(t.tenantId, t.companyId),
  ],
);

export const crmContacts = crmSchema.table(
  'contacts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    organizationName: text('organization_name').notNull().default(''),
    email: text('email').notNull().default(''),
    phone: text('phone').notNull().default(''),
    contactType: text('contact_type').notNull().default('customer'),
    stage: text('stage').notNull().default('lead'),
    estimatedValue: numeric('estimated_value', { precision: 18, scale: 2 }).notNull().default('0'),
    notes: text('notes').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('crm_contacts_tenant_company_idx').on(t.tenantId, t.companyId)],
);

export const chartAccounts = financeSchema.table(
  'accounts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    name: text('name').notNull(),
    category: text('category').notNull(),
    subType: text('sub_type').notNull(),
    isSystem: boolean('is_system').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('fin_accounts_company_code_uidx').on(t.companyId, t.code),
    index('fin_accounts_tenant_company_idx').on(t.tenantId, t.companyId),
  ],
);

export const fiscalPeriods = financeSchema.table(
  'fiscal_periods',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    code: text('code').notNull(), // YYYY-MM
    name: text('name').notNull(),
    startDate: text('start_date').notNull(),
    endDate: text('end_date').notNull(),
    status: text('status').notNull().default('open'),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    closedBy: uuid('closed_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (t) => [uniqueIndex('fin_fiscal_periods_company_code_uidx').on(t.companyId, t.code)],
);

export const journals = financeSchema.table(
  'journals',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'set null' }),
    journalNumber: text('journal_number').notNull(),
    entryDate: text('entry_date').notNull(),
    fiscalPeriodId: uuid('fiscal_period_id')
      .notNull()
      .references(() => fiscalPeriods.id, { onDelete: 'restrict' }),
    reference: text('reference').notNull(),
    description: text('description').notNull(),
    sourceModule: text('source_module').notNull(),
    sourceId: uuid('source_id'),
    idempotencyKey: text('idempotency_key').notNull(),
    status: text('status').notNull().default('posted'),
    reversesJournalId: uuid('reverses_journal_id'),
    reversedByJournalId: uuid('reversed_by_journal_id'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('fin_journals_company_number_uidx').on(t.companyId, t.journalNumber),
    uniqueIndex('fin_journals_company_idemp_uidx').on(t.companyId, t.idempotencyKey),
    index('fin_journals_tenant_company_date_idx').on(t.tenantId, t.companyId, t.entryDate),
  ],
);

export const journalLines = financeSchema.table(
  'journal_lines',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    journalId: uuid('journal_id')
      .notNull()
      .references(() => journals.id, { onDelete: 'cascade' }),
    accountId: uuid('account_id')
      .notNull()
      .references(() => chartAccounts.id, { onDelete: 'restrict' }),
    debit: numeric('debit', { precision: 18, scale: 2 }).notNull().default('0'),
    credit: numeric('credit', { precision: 18, scale: 2 }).notNull().default('0'),
    memo: text('memo'),
  },
  (t) => [
    index('fin_journal_lines_journal_idx').on(t.journalId),
    index('fin_journal_lines_company_acc_idx').on(t.companyId, t.accountId),
  ],
);

export const stockMovements = inventorySchema.table(
  'stock_movements',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'set null' }),
    itemId: uuid('item_id')
      .notNull()
      .references(() => catalogueItems.id, { onDelete: 'restrict' }),
    direction: text('direction').notNull(),
    movementType: text('movement_type').notNull(),
    quantity: numeric('quantity', { precision: 18, scale: 4 }).notNull(),
    unitCost: numeric('unit_cost', { precision: 18, scale: 4 }).notNull().default('0'),
    totalValue: numeric('total_value', { precision: 18, scale: 2 }).notNull().default('0'),
    balanceAfter: numeric('balance_after', { precision: 18, scale: 4 }).notNull(),
    reservedAfter: numeric('reserved_after', { precision: 18, scale: 4 }).notNull().default('0'),
    batchNumber: text('batch_number'),
    serialNumbers: jsonb('serial_numbers').$type<string[]>().notNull().default([]),
    reference: text('reference').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    reason: text('reason').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('inv_movements_company_idemp_uidx').on(t.companyId, t.idempotencyKey),
    index('inv_movements_company_item_idx').on(t.companyId, t.itemId),
  ],
);

export const salesOrders = salesSchema.table(
  'orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'set null' }),
    documentNumber: text('document_number').notNull(),
    documentType: text('document_type').notNull(),
    customerId: uuid('customer_id').references(() => crmContacts.id, { onDelete: 'set null' }),
    customerName: text('customer_name').notNull(),
    issueDate: text('issue_date').notNull(),
    dueDate: text('due_date').notNull(),
    status: text('status').notNull(),
    fulfillmentStatus: text('fulfillment_status').notNull().default('pending'),
    subtotal: numeric('subtotal', { precision: 18, scale: 2 }).notNull(),
    taxTotal: numeric('tax_total', { precision: 18, scale: 2 }).notNull(),
    grandTotal: numeric('grand_total', { precision: 18, scale: 2 }).notNull(),
    amountPaid: numeric('amount_paid', { precision: 18, scale: 2 }).notNull().default('0'),
    invoiceJournalId: uuid('invoice_journal_id').references(() => journals.id, {
      onDelete: 'set null',
    }),
    cogsJournalId: uuid('cogs_journal_id').references(() => journals.id, {
      onDelete: 'set null',
    }),
    dispatchRef: text('dispatch_ref'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('sales_orders_company_doc_uidx').on(t.companyId, t.documentNumber),
    index('sales_orders_tenant_company_idx').on(t.tenantId, t.companyId),
  ],
);

export const purchaseOrders = purchaseSchema.table(
  'orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'set null' }),
    documentNumber: text('document_number').notNull(),
    vendorId: uuid('vendor_id').references(() => crmContacts.id, { onDelete: 'set null' }),
    vendorName: text('vendor_name').notNull(),
    orderDate: text('order_date').notNull(),
    expectedDate: text('expected_date').notNull(),
    status: text('status').notNull(),
    subtotal: numeric('subtotal', { precision: 18, scale: 2 }).notNull(),
    taxTotal: numeric('tax_total', { precision: 18, scale: 2 }).notNull(),
    grandTotal: numeric('grand_total', { precision: 18, scale: 2 }).notNull(),
    amountPaid: numeric('amount_paid', { precision: 18, scale: 2 }).notNull().default('0'),
    receiptJournalId: uuid('receipt_journal_id').references(() => journals.id, {
      onDelete: 'set null',
    }),
    receiptRef: text('receipt_ref'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('pur_orders_company_doc_uidx').on(t.companyId, t.documentNumber),
    index('pur_orders_tenant_company_idx').on(t.tenantId, t.companyId),
  ],
);

export const hrEmployees = hrSchema.table(
  'employees',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'set null' }),
    employeeCode: text('employee_code').notNull(),
    fullName: text('full_name').notNull(),
    email: text('email').notNull().default(''),
    department: text('department').notNull(),
    designation: text('designation').notNull(),
    monthlySalary: numeric('monthly_salary', { precision: 18, scale: 2 }).notNull(),
    status: text('status').notNull().default('active'),
    joinedDate: text('joined_date').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('hr_emp_company_code_uidx').on(t.companyId, t.employeeCode)],
);

export const hrPayrollRuns = hrSchema.table(
  'payroll_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    periodKey: text('period_key').notNull(),
    employeeCount: integer('employee_count').notNull(),
    totalGross: numeric('total_gross', { precision: 18, scale: 2 }).notNull(),
    journalId: uuid('journal_id')
      .notNull()
      .references(() => journals.id, { onDelete: 'restrict' }),
    status: text('status').notNull().default('posted'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('hr_payroll_company_period_uidx').on(t.companyId, t.periodKey)],
);

export const encryptedCredentials = integrationsSchema.table(
  'encrypted_credentials',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    keyVersion: integer('key_version').notNull().default(1),
    ciphertext: text('ciphertext').notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('int_creds_company_provider_uidx').on(t.companyId, t.provider)],
);
