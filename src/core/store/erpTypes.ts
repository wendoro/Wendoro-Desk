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
  reorderLevel: number;
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
  lines: OrderLineItem[];
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  notes: string;
  stockPosted: boolean;
  ledgerPosted: boolean;
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
  notes: string;
  stockPosted: boolean;
  ledgerPosted: boolean;
  createdAt: string;
}

export interface StockMovement {
  id: string;
  companyId: string;
  branchId: string | null;
  itemId: string;
  itemName: string;
  sku: string;
  direction: 'in' | 'out' | 'adjustment';
  quantity: number;
  balanceAfter: number;
  reference: string;
  reason: string;
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
  sourceModule: 'manual' | 'sales' | 'purchase' | 'payroll';
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

export interface ErpDatabaseState {
  catalogue: CatalogueItem[];
  contacts: CrmContact[];
  salesOrders: SalesOrder[];
  purchaseOrders: PurchaseOrder[];
  stockMovements: StockMovement[];
  ledgerEntries: LedgerEntry[];
  employees: EmployeeRecord[];
  projectTasks: ProjectTask[];
  supportTickets: SupportTicket[];
  documents: DocumentRecord[];
  campaigns: MarketingCampaign[];
  industryRecords: IndustryOperationRecord[];
}
