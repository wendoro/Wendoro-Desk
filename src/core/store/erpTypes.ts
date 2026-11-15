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

export interface CrmActivity {
  id: string;
  date: string;
  type: 'call' | 'email' | 'meeting' | 'note';
  summary: string;
}

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
  leadScore?: number;
  loyaltyPoints?: number;
  assignedTo?: string;
  activities?: CrmActivity[];
  notes: string;
  createdAt: string;
}

export interface OrderLineItem {
  id: string;
  itemId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountRate?: number;
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
  salesperson?: string;
  commissionRate?: number;
  isRecurring?: boolean;
  recurringInterval?: 'monthly' | 'quarterly' | 'annual';
  isDropShip?: boolean;
  channel?: 'direct' | 'pos' | 'ecommerce';
  createdAt: string;
}

export interface CreditNote {
  id: string;
  companyId: string;
  creditNumber: string;
  salesOrderId: string;
  invoiceNumber: string;
  customerName: string;
  issueDate: string;
  reason: string;
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  restoreStock: boolean;
  journalId: string;
  createdAt: string;
}

export interface PosShift {
  id: string;
  companyId: string;
  shiftNumber: string;
  registerName: string;
  cashierName: string;
  openedAt: string;
  closedAt?: string;
  openingCash: number;
  cashSalesTotal: number;
  cardUpiSalesTotal: number;
  expectedCash: number;
  countedCash?: number;
  variance?: number;
  status: 'open' | 'closed';
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
  requiresApproval?: boolean;
  approvedBy?: string;
  createdAt: string;
}

export interface PurchaseRequisition {
  id: string;
  companyId: string;
  reqNumber: string;
  requestedBy: string;
  department: string;
  itemId?: string;
  itemDescription: string;
  quantity: number;
  estimatedUnitCost: number;
  vendorName?: string;
  status: 'pending' | 'approved' | 'converted' | 'rejected';
  convertedPoId?: string;
  notes: string;
  createdAt: string;
}

export interface Warehouse {
  id: string;
  companyId: string;
  code: string;
  name: string;
  location: string;
  isDefault: boolean;
  createdAt: string;
}

export interface StockTransfer {
  id: string;
  companyId: string;
  transferNumber: string;
  itemId: string;
  itemName: string;
  sku: string;
  fromWarehouse: string;
  toWarehouse: string;
  quantity: number;
  status: 'completed';
  notes: string;
  createdAt: string;
}

export interface ShipmentRecord {
  id: string;
  companyId: string;
  trackingNumber: string;
  orderNumber: string;
  carrier: string;
  vehicleReg: string;
  driverName: string;
  origin: string;
  destination: string;
  status: 'scheduled' | 'in_transit' | 'delivered';
  dispatchDate: string;
  cost: number;
  notes: string;
  createdAt: string;
}

export type StockMovementType =
  | 'opening'
  | 'receipt'
  | 'dispatch'
  | 'reservation'
  | 'release'
  | 'adjustment'
  | 'production_consume'
  | 'production_output'
  | 'sales_return'
  | 'transfer';

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
  | 'fixed_asset'
  | 'accumulated_depreciation'
  | 'accounts_payable'
  | 'output_tax'
  | 'payroll_payable'
  | 'equity'
  | 'sales_revenue'
  | 'cogs'
  | 'payroll_expense'
  | 'depreciation_expense'
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
  sourceModule: 'manual' | 'sales' | 'purchase' | 'inventory' | 'payroll' | 'manufacturing' | 'assets' | 'expenses';
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
  sourceModule: JournalEntry['sourceModule'];
  journalId?: string;
  createdAt: string;
}

export interface FixedAsset {
  id: string;
  companyId: string;
  assetCode: string;
  name: string;
  category: string;
  purchaseDate: string;
  purchaseCost: number;
  salvageValue: number;
  usefulLifeMonths: number;
  accumulatedDepreciation: number;
  status: 'active' | 'disposed';
  lastDepreciationPeriod?: string;
  createdAt: string;
}

export interface BudgetAllocation {
  id: string;
  companyId: string;
  periodKey: string;
  costCenter: string;
  accountCode: string;
  accountName: string;
  plannedAmount: number;
  notes: string;
  createdAt: string;
}

export interface ExpenseClaim {
  id: string;
  companyId: string;
  claimNumber: string;
  employeeName: string;
  category: string;
  expenseDate: string;
  amount: number;
  taxAmount: number;
  description: string;
  status: 'pending' | 'approved' | 'paid' | 'rejected';
  journalId?: string;
  createdAt: string;
}

export interface BankTransaction {
  id: string;
  companyId: string;
  txDate: string;
  description: string;
  reference: string;
  direction: 'credit' | 'debit';
  amount: number;
  matchedJournalId?: string;
  status: 'unmatched' | 'reconciled';
  createdAt: string;
}

export interface BomComponent {
  itemId: string;
  sku: string;
  name: string;
  quantityPerUnit: number;
  unitCost: number;
}

export interface BomDefinition {
  id: string;
  companyId: string;
  bomCode: string;
  finishedItemId: string;
  finishedSku: string;
  finishedName: string;
  components: BomComponent[];
  laborCostPerUnit: number;
  overheadCostPerUnit: number;
  notes: string;
  createdAt: string;
}

export interface WorkOrder {
  id: string;
  companyId: string;
  woNumber: string;
  bomId: string;
  finishedItemId: string;
  finishedSku: string;
  finishedName: string;
  targetQty: number;
  completedQty: number;
  status: 'planned' | 'materials_issued' | 'completed' | 'cancelled';
  startDate: string;
  dueDate: string;
  totalMaterialCost: number;
  totalConversionCost: number;
  journalId?: string;
  createdAt: string;
}

export interface QualityInspection {
  id: string;
  companyId: string;
  inspectionNumber: string;
  referenceNumber: string;
  itemSku: string;
  itemName: string;
  inspectorName: string;
  sampleSize: number;
  defectCount: number;
  result: 'pass' | 'fail' | 'hold';
  notes: string;
  createdAt: string;
}

export interface MaintenanceSchedule {
  id: string;
  companyId: string;
  assetOrMachine: string;
  taskTitle: string;
  frequency: 'weekly' | 'monthly' | 'quarterly';
  nextDueDate: string;
  technician: string;
  estimatedCost: number;
  status: 'scheduled' | 'completed';
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
  basicSalary?: number;
  allowances?: number;
  deductions?: number;
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

export interface LeaveRequest {
  id: string;
  companyId: string;
  employeeId: string;
  employeeName: string;
  leaveType: 'annual' | 'sick' | 'casual' | 'unpaid';
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface AttendanceLog {
  id: string;
  companyId: string;
  employeeId: string;
  employeeName: string;
  date: string;
  checkIn: string;
  checkOut: string;
  hoursWorked: number;
  status: 'present' | 'late' | 'remote' | 'absent';
  createdAt: string;
}

export interface JobOpening {
  id: string;
  companyId: string;
  title: string;
  department: string;
  employmentType: 'full_time' | 'contract' | 'part_time';
  targetSalary: number;
  status: 'open' | 'closed';
  createdAt: string;
}

export interface Candidate {
  id: string;
  companyId: string;
  jobOpeningId: string;
  fullName: string;
  email: string;
  stage: 'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected';
  expectedSalary: number;
  notes: string;
  createdAt: string;
}

export interface PerformanceGoal {
  id: string;
  companyId: string;
  employeeName: string;
  title: string;
  metricTarget: string;
  progressPct: number;
  periodKey: string;
  status: 'on_track' | 'at_risk' | 'completed';
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
  isFieldService?: boolean;
  siteAddress?: string;
  createdAt: string;
}

export interface TimesheetEntry {
  id: string;
  companyId: string;
  projectName: string;
  taskId?: string;
  employeeName: string;
  workDate: string;
  hours: number;
  hourlyRate: number;
  billable: boolean;
  billed: boolean;
  notes: string;
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
  slaDueDate?: string;
  channel?: 'email' | 'chat' | 'phone' | 'portal';
  notes: string;
  createdAt: string;
}

export interface KbArticle {
  id: string;
  companyId: string;
  title: string;
  category: string;
  summary: string;
  content: string;
  published: boolean;
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
  version?: number;
  signedBy?: string;
  signedAt?: string;
  fileName?: string;
  fileSizeLabel?: string;
  notes: string;
  createdAt: string;
}

export interface MarketingCampaign {
  id: string;
  companyId: string;
  name: string;
  channel: 'email' | 'social' | 'search' | 'events' | 'whatsapp' | 'sms';
  status: 'planned' | 'active' | 'completed';
  targetStage?: CrmStage | 'all';
  budget: number;
  leadsCount: number;
  startDate: string;
  createdAt: string;
}

export interface ApprovalRule {
  id: string;
  companyId: string;
  name: string;
  module: 'purchase' | 'expense' | 'leave';
  minAmount: number;
  approverRole: string;
  active: boolean;
  createdAt: string;
}

export interface CustomFieldDefinition {
  id: string;
  companyId: string;
  module: 'crm' | 'catalogue' | 'sales' | 'hrms';
  fieldLabel: string;
  fieldType: 'text' | 'number' | 'date' | 'select';
  required: boolean;
  optionsCsv?: string;
  createdAt: string;
}

export interface BiSavedReport {
  id: string;
  companyId: string;
  name: string;
  dataset: 'revenue_by_customer' | 'margin_by_sku' | 'expense_by_category' | 'pipeline_by_stage';
  chartType: 'bar' | 'pie' | 'table';
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
  creditNotes: CreditNote[];
  posShifts: PosShift[];
  purchaseOrders: PurchaseOrder[];
  purchaseRequisitions: PurchaseRequisition[];
  warehouses: Warehouse[];
  stockTransfers: StockTransfer[];
  shipments: ShipmentRecord[];
  stockMovements: StockMovement[];
  inventoryLots: InventoryLot[];
  stockReservations: StockReservation[];
  accounts: ChartAccount[];
  fiscalPeriods: FiscalPeriod[];
  journals: JournalEntry[];
  paymentAllocations: PaymentAllocation[];
  ledgerEntries: LedgerEntry[];
  fixedAssets: FixedAsset[];
  budgets: BudgetAllocation[];
  expenseClaims: ExpenseClaim[];
  bankTransactions: BankTransaction[];
  boms: BomDefinition[];
  workOrders: WorkOrder[];
  qualityInspections: QualityInspection[];
  maintenanceSchedules: MaintenanceSchedule[];
  employees: EmployeeRecord[];
  payrollRuns: PayrollRun[];
  leaveRequests: LeaveRequest[];
  attendanceLogs: AttendanceLog[];
  jobOpenings: JobOpening[];
  candidates: Candidate[];
  performanceGoals: PerformanceGoal[];
  projectTasks: ProjectTask[];
  timesheets: TimesheetEntry[];
  supportTickets: SupportTicket[];
  kbArticles: KbArticle[];
  documents: DocumentRecord[];
  campaigns: MarketingCampaign[];
  approvalRules: ApprovalRule[];
  customFields: CustomFieldDefinition[];
  biReports: BiSavedReport[];
  industryRecords: IndustryOperationRecord[];
  auditLogs: AuditLogRecord[];
}
