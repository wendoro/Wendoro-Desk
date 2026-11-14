export type CatalogueItemType = 'physical' | 'service' | 'digital' | 'subscription';

export interface CatalogueItem {
  id: string;
  companyId: string;
  sku: string;
  name: string;
  type: CatalogueItemType;
  category: string;
  unit: string;
  costPrice: number;
  sellingPrice: number;
  taxRate: number;
  trackStock: boolean;
  stockOnHand: number;
  reservedQty: number;
  reorderLevel: number;
  inventoryAssetValue: number;
  version: number;
  createdAt: string;
}

export type CrmStage = 'lead' | 'qualified' | 'proposal' | 'customer' | 'lost';

export interface CrmContact {
  id: string;
  companyId: string;
  name: string;
  organization: string;
  email: string;
  phone: string;
  type: 'customer' | 'vendor' | 'both';
  stage: CrmStage;
  estimatedValue: number;
  notes: string;
  createdAt: string;
}

export interface OrderLineItem {
  id: string;
  itemId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  lineTotal: number;
}

export type SalesStatus = 'draft' | 'sent' | 'paid' | 'cancelled';
export type FulfillmentStatus = 'pending' | 'reserved' | 'dispatched';

export interface SalesOrder {
  id: string;
  companyId: string;
  branchId: string | null;
  documentNumber: string;
  documentType: 'invoice' | 'quote';
  customerId?: string;
  customerName: string;
  issueDate: string;
  dueDate: string;
  status: SalesStatus;
  fulfillmentStatus: FulfillmentStatus;
  lines: OrderLineItem[];
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  amountPaid: number;
  notes: string;
  stockPosted: boolean;
  ledgerPosted: boolean;
  invoiceJournalId?: string;
  cogsJournalId?: string;
  dispatchRef?: string;
  dispatchedAt?: string;
  createdAt: string;
}

export type PurchaseStatus = 'draft' | 'ordered' | 'received' | 'cancelled';

export interface PurchaseOrder {
  id: string;
  companyId: string;
  branchId: string | null;
  documentNumber: string;
  vendorId?: string;
  vendorName: string;
  orderDate: string;
  expectedDate: string;
  status: PurchaseStatus;
  lines: OrderLineItem[];
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  amountPaid: number;
  notes: string;
  stockPosted: boolean;
  ledgerPosted: boolean;
  receiptJournalId?: string;
  receiptRef?: string;
  receivedAt?: string;
  createdAt: string;
}

export type StockMovementType =
  | 'opening'
  | 'receipt'
  | 'dispatch'
  | 'reservation'
  | 'release'
  | 'adjustment';

export interface StockMovement {
  id: string;
  companyId: string;
  branchId: string | null;
  itemId: string;
  itemName: string;
  sku: string;
  direction: 'in' | 'out' | 'adjustment';
  movementType: StockMovementType;
  quantity: number;
  unitCost: number;
  totalValue: number;
  balanceAfter: number;
  reservedAfter: number;
  batchNumber?: string;
  serialNumbers?: string[];
  reference: string;
  idempotencyKey: string;
  reason: string;
  createdAt: string;
}

export interface InventoryLot {
  id: string;
  companyId: string;
  branchId: string | null;
  itemId: string;
  batchNumber: string;
  serialNumbers: string[];
  expiryDate?: string;
  qtyReceived: number;
  qtyRemaining: number;
  unitCost: number;
  receiptReference: string;
  createdAt: string;
}

export interface StockReservation {
  id: string;
  companyId: string;
  itemId: string;
  orderId: string;
  documentNumber: string;
  quantity: number;
  status: 'active' | 'fulfilled' | 'released';
  createdAt: string;
}

export type AccountCategory = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
export type AccountSubType =
  | 'cash'
  | 'accounts_receivable'
  | 'inventory'
  | 'input_tax'
  | 'accounts_payable'
  | 'output_tax'
  | 'payroll_payable'
  | 'equity'
  | 'sales_revenue'
  | 'cogs'
  | 'payroll_expense'
  | 'operating_expense';

export interface ChartAccount {
  id: string;
  companyId: string;
  code: string;
  name: string;
  category: AccountCategory;
  subType: AccountSubType;
  isSystem: boolean;
}

export interface FiscalPeriod {
  id: string;
  companyId: string;
  code: string; // YYYY-MM
  name: string;
  startDate: string;
  endDate: string;
  status: 'open' | 'closed';
}

export interface JournalLine {
  id: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  accountCategory: AccountCategory;
  debit: number;
  credit: number;
  memo?: string;
}

export interface JournalEntry {
  id: string;
  companyId: string;
  branchId: string | null;
  journalNumber: string;
  date: string;
  fiscalPeriodId: string;
  reference: string;
  description: string;
  sourceModule: 'manual' | 'sales' | 'purchase' | 'inventory' | 'payroll';
  sourceId?: string;
  idempotencyKey: string;
  status: 'posted' | 'reversed';
  reversedByJournalId?: string;
  reversesJournalId?: string;
  lines: JournalLine[];
  totalDebit: number;
  totalCredit: number;
  createdAt: string;
}

export interface PaymentAllocation {
  id: string;
  companyId: string;
  branchId: string | null;
  paymentDate: string;
  direction: 'inbound' | 'outbound';
  orderId: string;
  documentNumber: string;
  counterpartyName: string;
  amount: number;
  method: 'bank' | 'cash' | 'card' | 'upi';
  journalId: string;
  reference: string;
  createdAt: string;
}

export type LedgerEntryType = 'income' | 'expense' | 'asset' | 'liability';

export interface LedgerEntry {
  id: string;
  companyId: string;
  branchId: string | null;
  date: string;
  accountName: string;
  entryType: LedgerEntryType;
  amount: number;
  reference: string;
  description: string;
  sourceModule: 'manual' | 'sales' | 'purchase' | 'payroll' | 'inventory';
  journalId?: string;
  createdAt: string;
}

export interface EmployeeRecord {
  id: string;
  companyId: string;
  branchId: string | null;
  employeeCode: string;
  fullName: string;
  email: string;
  department: string;
  designation: string;
  monthlySalary: number;
  status: 'active' | 'on_leave' | 'inactive';
  joinedDate: string;
  createdAt: string;
}

export interface PayrollRun {
  id: string;
  companyId: string;
  branchId: string | null;
  periodKey: string; // YYYY-MM
  employeeCount: number;
  totalGross: number;
  journalId: string;
  status: 'posted' | 'reversed';
  createdAt: string;
}

export type ProjectTaskStatus = 'backlog' | 'in_progress' | 'review' | 'done';

export interface ProjectTask {
  id: string;
  companyId: string;
  projectName: string;
  title: string;
  assigneeName: string;
  priority: 'low' | 'medium' | 'high';
  status: ProjectTaskStatus;
  dueDate: string;
  budget: number;
  createdAt: string;
}

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface SupportTicket {
  id: string;
  companyId: string;
  ticketNumber: string;
  subject: string;
  customerName: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: TicketStatus;
  notes: string;
  createdAt: string;
}

export interface DocumentRecord {
  id: string;
  companyId: string;
  title: string;
  category: 'contract' | 'tax_gst' | 'sop' | 'hr_policy' | 'other';
  referenceCode: string;
  ownerName: string;
  expiryDate: string;
  notes: string;
  createdAt: string;
}

export interface MarketingCampaign {
  id: string;
  companyId: string;
  name: string;
  channel: 'email' | 'social' | 'search' | 'events' | 'whatsapp';
  status: 'planned' | 'active' | 'completed';
  budget: number;
  leadsCount: number;
  startDate: string;
  createdAt: string;
}

export interface IndustryOperationRecord {
  id: string;
  companyId: string;
  moduleSlug: string;
  reference: string;
  title: string;
  counterparty: string;
  status: 'open' | 'in_progress' | 'completed';
  quantityOrUnits: number;
  amount: number;
  metadata: string;
  createdAt: string;
}

export interface AuditLogRecord {
  id: string;
  companyId: string;
  actorUserId: string;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId: string;
  outcome: 'success' | 'denied' | 'failed';
  details: string;
  createdAt: string;
}

export interface ErpDatabaseState {
  schemaVersion: number;
  sequences: Record<string, number>;
  catalogue: CatalogueItem[];
  contacts: CrmContact[];
  salesOrders: SalesOrder[];
  purchaseOrders: PurchaseOrder[];
  stockMovements: StockMovement[];
  inventoryLots: InventoryLot[];
  stockReservations: StockReservation[];
  accounts: ChartAccount[];
  fiscalPeriods: FiscalPeriod[];
  journals: JournalEntry[];
  paymentAllocations: PaymentAllocation[];
  ledgerEntries: LedgerEntry[];
  employees: EmployeeRecord[];
  payrollRuns: PayrollRun[];
  projectTasks: ProjectTask[];
  supportTickets: SupportTicket[];
  documents: DocumentRecord[];
  campaigns: MarketingCampaign[];
  industryRecords: IndustryOperationRecord[];
  auditLogs: AuditLogRecord[];
}
