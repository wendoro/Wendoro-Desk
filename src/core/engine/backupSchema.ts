import { z } from 'zod';

const OrderLineItemSchema = z.object({
  id: z.string().min(1),
  itemId: z.string().optional(),
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
  taxRate: z.number().min(0),
  lineTotal: z.number().min(0),
});

const JournalLineSchema = z.object({
  id: z.string().min(1),
  accountId: z.string().min(1),
  accountCode: z.string().min(1),
  accountName: z.string().min(1),
  accountCategory: z.enum(['asset', 'liability', 'equity', 'revenue', 'expense']),
  debit: z.number().min(0),
  credit: z.number().min(0),
  memo: z.string().optional(),
});

const JournalEntrySchema = z
  .object({
    id: z.string().min(1),
    companyId: z.string().min(1),
    branchId: z.string().nullable(),
    journalNumber: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    fiscalPeriodId: z.string().min(1),
    reference: z.string(),
    description: z.string(),
    sourceModule: z.enum(['manual', 'sales', 'purchase', 'inventory', 'payroll']),
    sourceId: z.string().optional(),
    idempotencyKey: z.string().min(1),
    status: z.enum(['posted', 'reversed']),
    reversedByJournalId: z.string().optional(),
    reversesJournalId: z.string().optional(),
    lines: z.array(JournalLineSchema).min(2),
    totalDebit: z.number().positive(),
    totalCredit: z.number().positive(),
    createdAt: z.string(),
  })
  .refine((j) => Math.abs(j.totalDebit - j.totalCredit) < 0.005, {
    message: 'Journal entry in backup is unbalanced.',
  });

export const CompanyBackupRecordsSchema = z.object({
  catalogue: z
    .array(
      z.object({
        id: z.string().min(1),
        companyId: z.string().min(1),
        sku: z.string().min(1),
        name: z.string().min(1),
        type: z.enum(['physical', 'service', 'digital', 'subscription']),
        category: z.string(),
        unit: z.string(),
        costPrice: z.number().min(0),
        sellingPrice: z.number().min(0),
        taxRate: z.number().min(0),
        trackStock: z.boolean(),
        stockOnHand: z.number().min(0),
        reservedQty: z.number().min(0).default(0),
        reorderLevel: z.number().min(0),
        inventoryAssetValue: z.number().min(0).default(0),
        version: z.number().int().min(1).default(1),
        createdAt: z.string(),
      }),
    )
    .default([]),
  contacts: z.array(z.record(z.string(), z.unknown())).default([]),
  salesOrders: z
    .array(
      z.object({
        id: z.string().min(1),
        companyId: z.string().min(1),
        branchId: z.string().nullable(),
        documentNumber: z.string().min(1),
        documentType: z.enum(['invoice', 'quote']),
        customerId: z.string().optional(),
        customerName: z.string().min(1),
        issueDate: z.string(),
        dueDate: z.string(),
        status: z.enum(['draft', 'sent', 'paid', 'cancelled']),
        fulfillmentStatus: z.enum(['pending', 'reserved', 'dispatched']).default('pending'),
        lines: z.array(OrderLineItemSchema).min(1),
        subtotal: z.number().min(0),
        taxTotal: z.number().min(0),
        grandTotal: z.number().min(0),
        amountPaid: z.number().min(0).default(0),
        notes: z.string().default(''),
        stockPosted: z.boolean().default(false),
        ledgerPosted: z.boolean().default(false),
        invoiceJournalId: z.string().optional(),
        cogsJournalId: z.string().optional(),
        dispatchRef: z.string().optional(),
        dispatchedAt: z.string().optional(),
        createdAt: z.string(),
      }),
    )
    .default([]),
  purchaseOrders: z
    .array(
      z.object({
        id: z.string().min(1),
        companyId: z.string().min(1),
        branchId: z.string().nullable(),
        documentNumber: z.string().min(1),
        vendorId: z.string().optional(),
        vendorName: z.string().min(1),
        orderDate: z.string(),
        expectedDate: z.string(),
        status: z.enum(['draft', 'ordered', 'received', 'cancelled']),
        lines: z.array(OrderLineItemSchema).min(1),
        subtotal: z.number().min(0),
        taxTotal: z.number().min(0),
        grandTotal: z.number().min(0),
        amountPaid: z.number().min(0).default(0),
        notes: z.string().default(''),
        stockPosted: z.boolean().default(false),
        ledgerPosted: z.boolean().default(false),
        receiptJournalId: z.string().optional(),
        receiptRef: z.string().optional(),
        receivedAt: z.string().optional(),
        createdAt: z.string(),
      }),
    )
    .default([]),
  stockMovements: z.array(z.record(z.string(), z.unknown())).default([]),
  inventoryLots: z.array(z.record(z.string(), z.unknown())).default([]),
  stockReservations: z.array(z.record(z.string(), z.unknown())).default([]),
  accounts: z.array(z.record(z.string(), z.unknown())).default([]),
  fiscalPeriods: z.array(z.record(z.string(), z.unknown())).default([]),
  journals: z.array(JournalEntrySchema).default([]),
  paymentAllocations: z.array(z.record(z.string(), z.unknown())).default([]),
  ledgerEntries: z.array(z.record(z.string(), z.unknown())).default([]),
  employees: z.array(z.record(z.string(), z.unknown())).default([]),
  payrollRuns: z.array(z.record(z.string(), z.unknown())).default([]),
  projectTasks: z.array(z.record(z.string(), z.unknown())).default([]),
  supportTickets: z.array(z.record(z.string(), z.unknown())).default([]),
  documents: z.array(z.record(z.string(), z.unknown())).default([]),
  campaigns: z.array(z.record(z.string(), z.unknown())).default([]),
  industryRecords: z.array(z.record(z.string(), z.unknown())).default([]),
  auditLogs: z.array(z.record(z.string(), z.unknown())).default([]),
});

export const BackupPayloadSchema = z.object({
  schemaVersion: z.number().int().min(1).default(2),
  exportedAt: z.string().min(1),
  companyId: z.string().min(1),
  companyCode: z.string().min(1),
  companyName: z.string().min(1),
  sequences: z.record(z.string(), z.number().int().min(0)).optional().default({}),
  records: CompanyBackupRecordsSchema,
});
