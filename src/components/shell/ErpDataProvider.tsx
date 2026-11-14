import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  CatalogueItem,
  CrmContact,
  CrmStage,
  DocumentRecord,
  EmployeeRecord,
  ErpDatabaseState,
  IndustryOperationRecord,
  LedgerEntry,
  MarketingCampaign,
  OrderLineItem,
  ProjectTask,
  ProjectTaskStatus,
  PurchaseOrder,
  PurchaseStatus,
  SalesOrder,
  SalesStatus,
  StockMovement,
  SupportTicket,
  TicketStatus,
} from '@/src/core/store/erpTypes';
import { useTenant } from './TenantProvider';

const ERP_STORAGE_KEY = 'wendoro.erp.data.v1';

const EMPTY_ERP_STATE: ErpDatabaseState = {
  catalogue: [],
  contacts: [],
  salesOrders: [],
  purchaseOrders: [],
  stockMovements: [],
  ledgerEntries: [],
  employees: [],
  projectTasks: [],
  supportTickets: [],
  documents: [],
  campaigns: [],
  industryRecords: [],
};

function uid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `rec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadErpState(): ErpDatabaseState {
  if (typeof window === 'undefined') return EMPTY_ERP_STATE;
  try {
    const raw = window.localStorage.getItem(ERP_STORAGE_KEY);
    if (!raw) return EMPTY_ERP_STATE;
    const parsed = JSON.parse(raw) as Partial<ErpDatabaseState>;
    return {
      catalogue: Array.isArray(parsed.catalogue) ? parsed.catalogue : [],
      contacts: Array.isArray(parsed.contacts) ? parsed.contacts : [],
      salesOrders: Array.isArray(parsed.salesOrders) ? parsed.salesOrders : [],
      purchaseOrders: Array.isArray(parsed.purchaseOrders) ? parsed.purchaseOrders : [],
      stockMovements: Array.isArray(parsed.stockMovements) ? parsed.stockMovements : [],
      ledgerEntries: Array.isArray(parsed.ledgerEntries) ? parsed.ledgerEntries : [],
      employees: Array.isArray(parsed.employees) ? parsed.employees : [],
      projectTasks: Array.isArray(parsed.projectTasks) ? parsed.projectTasks : [],
      supportTickets: Array.isArray(parsed.supportTickets) ? parsed.supportTickets : [],
      documents: Array.isArray(parsed.documents) ? parsed.documents : [],
      campaigns: Array.isArray(parsed.campaigns) ? parsed.campaigns : [],
      industryRecords: Array.isArray(parsed.industryRecords) ? parsed.industryRecords : [],
    };
  } catch {
    return EMPTY_ERP_STATE;
  }
}

export interface ErpCompanyScopedData {
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

interface ErpDataContextValue {
  data: ErpCompanyScopedData;
  metrics: {
    totalRevenue: number;
    totalExpenses: number;
    netIncome: number;
    openReceivables: number;
    openPayables: number;
    lowStockCount: number;
    openTasksCount: number;
    openTicketsCount: number;
  };
  addCatalogueItem: (
    item: Omit<CatalogueItem, 'id' | 'companyId' | 'createdAt'>,
  ) => CatalogueItem;
  deleteCatalogueItem: (id: string) => void;
  addContact: (contact: Omit<CrmContact, 'id' | 'companyId' | 'createdAt'>) => CrmContact;
  updateContactStage: (id: string, stage: CrmStage) => void;
  deleteContact: (id: string) => void;
  createSalesOrder: (input: {
    documentType: 'invoice' | 'quote';
    customerId?: string;
    customerName: string;
    issueDate: string;
    dueDate: string;
    status: SalesStatus;
    lines: Omit<OrderLineItem, 'id' | 'lineTotal'>[];
    notes: string;
  }) => SalesOrder;
  updateSalesStatus: (id: string, status: SalesStatus) => void;
  deleteSalesOrder: (id: string) => void;
  createPurchaseOrder: (input: {
    vendorId?: string;
    vendorName: string;
    orderDate: string;
    expectedDate: string;
    status: PurchaseStatus;
    lines: Omit<OrderLineItem, 'id' | 'lineTotal'>[];
    notes: string;
  }) => PurchaseOrder;
  updatePurchaseStatus: (id: string, status: PurchaseStatus) => void;
  deletePurchaseOrder: (id: string) => void;
  adjustStock: (input: {
    itemId: string;
    direction: 'in' | 'out' | 'adjustment';
    quantity: number;
    reason: string;
  }) => void;
  addLedgerEntry: (
    entry: Omit<LedgerEntry, 'id' | 'companyId' | 'branchId' | 'createdAt' | 'sourceModule'>,
  ) => LedgerEntry;
  deleteLedgerEntry: (id: string) => void;
  addEmployee: (
    emp: Omit<EmployeeRecord, 'id' | 'companyId' | 'branchId' | 'createdAt'>,
  ) => EmployeeRecord;
  toggleEmployeeStatus: (id: string) => void;
  deleteEmployee: (id: string) => void;
  runMonthlyPayroll: () => number;
  addProjectTask: (task: Omit<ProjectTask, 'id' | 'companyId' | 'createdAt'>) => ProjectTask;
  updateProjectTaskStatus: (id: string, status: ProjectTaskStatus) => void;
  deleteProjectTask: (id: string) => void;
  addSupportTicket: (
    ticket: Omit<SupportTicket, 'id' | 'companyId' | 'ticketNumber' | 'createdAt'>,
  ) => SupportTicket;
  updateSupportTicketStatus: (id: string, status: TicketStatus) => void;
  deleteSupportTicket: (id: string) => void;
  addDocument: (doc: Omit<DocumentRecord, 'id' | 'companyId' | 'createdAt'>) => DocumentRecord;
  deleteDocument: (id: string) => void;
  addCampaign: (
    campaign: Omit<MarketingCampaign, 'id' | 'companyId' | 'createdAt'>,
  ) => MarketingCampaign;
  deleteCampaign: (id: string) => void;
  addIndustryRecord: (
    rec: Omit<IndustryOperationRecord, 'id' | 'companyId' | 'createdAt'>,
  ) => IndustryOperationRecord;
  updateIndustryRecordStatus: (
    id: string,
    status: IndustryOperationRecord['status'],
  ) => void;
  deleteIndustryRecord: (id: string) => void;
  exportCompanyBackupJson: () => string;
  importCompanyBackupJson: (jsonText: string) => { importedCount: number };
  clearActiveCompanyData: () => void;
}

const ErpDataContext = createContext<ErpDataContextValue | null>(null);

export function ErpDataProvider({ children }: { children: React.ReactNode }) {
  const { activeCompany, activeBranchId, pushNotification } = useTenant();
  const [state, setState] = useState<ErpDatabaseState>(() => loadErpState());

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ERP_STORAGE_KEY, JSON.stringify(state));
    }
  }, [state]);

  const companyId = activeCompany.companyId;

  const data: ErpCompanyScopedData = useMemo(
    () => ({
      catalogue: state.catalogue.filter((r) => r.companyId === companyId),
      contacts: state.contacts.filter((r) => r.companyId === companyId),
      salesOrders: state.salesOrders.filter((r) => r.companyId === companyId),
      purchaseOrders: state.purchaseOrders.filter((r) => r.companyId === companyId),
      stockMovements: state.stockMovements.filter((r) => r.companyId === companyId),
      ledgerEntries: state.ledgerEntries.filter((r) => r.companyId === companyId),
      employees: state.employees.filter((r) => r.companyId === companyId),
      projectTasks: state.projectTasks.filter((r) => r.companyId === companyId),
      supportTickets: state.supportTickets.filter((r) => r.companyId === companyId),
      documents: state.documents.filter((r) => r.companyId === companyId),
      campaigns: state.campaigns.filter((r) => r.companyId === companyId),
      industryRecords: state.industryRecords.filter((r) => r.companyId === companyId),
    }),
    [state, companyId],
  );

  const metrics = useMemo(() => {
    const totalRevenue = data.ledgerEntries
      .filter((e) => e.entryType === 'income')
      .reduce((sum, e) => sum + e.amount, 0);
    const totalExpenses = data.ledgerEntries
      .filter((e) => e.entryType === 'expense')
      .reduce((sum, e) => sum + e.amount, 0);
    const openReceivables = data.salesOrders
      .filter((o) => o.documentType === 'invoice' && o.status === 'sent')
      .reduce((sum, o) => sum + o.grandTotal, 0);
    const openPayables = data.purchaseOrders
      .filter((o) => o.status === 'ordered')
      .reduce((sum, o) => sum + o.grandTotal, 0);
    const lowStockCount = data.catalogue.filter(
      (i) => i.trackStock && i.stockOnHand <= i.reorderLevel,
    ).length;
    const openTasksCount = data.projectTasks.filter((t) => t.status !== 'done').length;
    const openTicketsCount = data.supportTickets.filter(
      (t) => t.status === 'open' || t.status === 'in_progress',
    ).length;

    return {
      totalRevenue,
      totalExpenses,
      netIncome: totalRevenue - totalExpenses,
      openReceivables,
      openPayables,
      lowStockCount,
      openTasksCount,
      openTicketsCount,
    };
  }, [data]);

  const addCatalogueItem: ErpDataContextValue['addCatalogueItem'] = (input) => {
    const created: CatalogueItem = {
      ...input,
      id: uid(),
      companyId,
      createdAt: nowIso(),
    };
    setState((prev) => {
      const movements: StockMovement[] =
        created.trackStock && created.stockOnHand > 0
          ? [
              {
                id: uid(),
                companyId,
                branchId: activeBranchId,
                itemId: created.id,
                itemName: created.name,
                sku: created.sku,
                direction: 'in',
                quantity: created.stockOnHand,
                balanceAfter: created.stockOnHand,
                reference: 'OPENING-STOCK',
                reason: 'Initial opening stock balance',
                createdAt: nowIso(),
              },
              ...prev.stockMovements,
            ]
          : prev.stockMovements;
      return {
        ...prev,
        catalogue: [created, ...prev.catalogue],
        stockMovements: movements,
      };
    });
    return created;
  };

  const deleteCatalogueItem = (id: string) => {
    setState((prev) => ({
      ...prev,
      catalogue: prev.catalogue.filter((i) => i.id !== id),
    }));
  };

  const addContact: ErpDataContextValue['addContact'] = (input) => {
    const created: CrmContact = {
      ...input,
      id: uid(),
      companyId,
      createdAt: nowIso(),
    };
    setState((prev) => ({
      ...prev,
      contacts: [created, ...prev.contacts],
    }));
    return created;
  };

  const updateContactStage = (id: string, stage: CrmStage) => {
    setState((prev) => ({
      ...prev,
      contacts: prev.contacts.map((c) => (c.id === id ? { ...c, stage } : c)),
    }));
  };

  const deleteContact = (id: string) => {
    setState((prev) => ({
      ...prev,
      contacts: prev.contacts.filter((c) => c.id !== id),
    }));
  };

  const computeTotals = (rawLines: Omit<OrderLineItem, 'id' | 'lineTotal'>[]) => {
    let subtotal = 0;
    let taxTotal = 0;
    const lines: OrderLineItem[] = rawLines.map((l) => {
      const base = Number((l.quantity * l.unitPrice).toFixed(4));
      const tax = Number(((base * l.taxRate) / 100).toFixed(4));
      subtotal += base;
      taxTotal += tax;
      return {
        ...l,
        id: uid(),
        lineTotal: Number((base + tax).toFixed(4)),
      };
    });
    return {
      lines,
      subtotal: Number(subtotal.toFixed(4)),
      taxTotal: Number(taxTotal.toFixed(4)),
      grandTotal: Number((subtotal + taxTotal).toFixed(4)),
    };
  };

  const applySalesSideEffects = (
    prev: ErpDatabaseState,
    order: SalesOrder,
  ): ErpDatabaseState => {
    let nextCatalogue = prev.catalogue;
    let nextMovements = prev.stockMovements;
    let nextLedger = prev.ledgerEntries;
    let stockPosted = order.stockPosted;
    let ledgerPosted = order.ledgerPosted;

    const shouldDeductStock =
      order.documentType === 'invoice' &&
      (order.status === 'sent' || order.status === 'paid') &&
      !order.stockPosted;

    if (shouldDeductStock) {
      nextCatalogue = prev.catalogue.map((item) => {
        const matchedQty = order.lines
          .filter((l) => l.itemId === item.id)
          .reduce((s, l) => s + l.quantity, 0);
        if (!item.trackStock || matchedQty <= 0) return item;
        const nextQty = Math.max(0, item.stockOnHand - matchedQty);
        nextMovements = [
          {
            id: uid(),
            companyId,
            branchId: activeBranchId,
            itemId: item.id,
            itemName: item.name,
            sku: item.sku,
            direction: 'out',
            quantity: matchedQty,
            balanceAfter: nextQty,
            reference: order.documentNumber,
            reason: `Dispatched via ${order.documentNumber} (${order.customerName})`,
            createdAt: nowIso(),
          },
          ...nextMovements,
        ];
        return { ...item, stockOnHand: nextQty };
      });
      stockPosted = true;
    }

    const shouldPostLedger =
      order.documentType === 'invoice' && order.status === 'paid' && !order.ledgerPosted;

    if (shouldPostLedger) {
      nextLedger = [
        {
          id: uid(),
          companyId,
          branchId: activeBranchId,
          date: order.issueDate,
          accountName: 'Sales Revenue',
          entryType: 'income',
          amount: order.grandTotal,
          reference: order.documentNumber,
          description: `Invoice payment from ${order.customerName}`,
          sourceModule: 'sales',
          createdAt: nowIso(),
        },
        ...nextLedger,
      ];
      ledgerPosted = true;
    }

    return {
      ...prev,
      catalogue: nextCatalogue,
      stockMovements: nextMovements,
      ledgerEntries: nextLedger,
      salesOrders: prev.salesOrders.map((o) =>
        o.id === order.id ? { ...order, stockPosted, ledgerPosted } : o,
      ),
    };
  };

  const createSalesOrder: ErpDataContextValue['createSalesOrder'] = (input) => {
    const totals = computeTotals(input.lines);
    const seq = data.salesOrders.length + 1;
    const prefix = input.documentType === 'quote' ? 'QT' : 'INV';
    const order: SalesOrder = {
      id: uid(),
      companyId,
      branchId: activeBranchId,
      documentNumber: `${prefix}-${String(seq).padStart(4, '0')}`,
      documentType: input.documentType,
      customerId: input.customerId,
      customerName: input.customerName.trim(),
      issueDate: input.issueDate,
      dueDate: input.dueDate,
      status: input.status,
      lines: totals.lines,
      subtotal: totals.subtotal,
      taxTotal: totals.taxTotal,
      grandTotal: totals.grandTotal,
      notes: input.notes,
      stockPosted: false,
      ledgerPosted: false,
      createdAt: nowIso(),
    };

    setState((prev) => {
      const withOrder: ErpDatabaseState = {
        ...prev,
        salesOrders: [order, ...prev.salesOrders],
      };
      return applySalesSideEffects(withOrder, order);
    });

    pushNotification({
      category: 'governance',
      title: `${order.documentNumber} Created`,
      body: `${order.customerName} · ${order.status.toUpperCase()}`,
    });

    return order;
  };

  const updateSalesStatus = (id: string, status: SalesStatus) => {
    setState((prev) => {
      const target = prev.salesOrders.find((o) => o.id === id);
      if (!target) return prev;
      const updated = { ...target, status };
      return applySalesSideEffects(prev, updated);
    });
  };

  const deleteSalesOrder = (id: string) => {
    setState((prev) => ({
      ...prev,
      salesOrders: prev.salesOrders.filter((o) => o.id !== id),
    }));
  };

  const applyPurchaseSideEffects = (
    prev: ErpDatabaseState,
    order: PurchaseOrder,
  ): ErpDatabaseState => {
    let nextCatalogue = prev.catalogue;
    let nextMovements = prev.stockMovements;
    let nextLedger = prev.ledgerEntries;
    let stockPosted = order.stockPosted;
    let ledgerPosted = order.ledgerPosted;

    if (order.status === 'received' && !order.stockPosted) {
      nextCatalogue = prev.catalogue.map((item) => {
        const matchedQty = order.lines
          .filter((l) => l.itemId === item.id)
          .reduce((s, l) => s + l.quantity, 0);
        if (!item.trackStock || matchedQty <= 0) return item;
        const nextQty = item.stockOnHand + matchedQty;
        nextMovements = [
          {
            id: uid(),
            companyId,
            branchId: activeBranchId,
            itemId: item.id,
            itemName: item.name,
            sku: item.sku,
            direction: 'in',
            quantity: matchedQty,
            balanceAfter: nextQty,
            reference: order.documentNumber,
            reason: `Goods received from ${order.vendorName}`,
            createdAt: nowIso(),
          },
          ...nextMovements,
        ];
        return { ...item, stockOnHand: nextQty };
      });
      stockPosted = true;
    }

    if (order.status === 'received' && !order.ledgerPosted) {
      nextLedger = [
        {
          id: uid(),
          companyId,
          branchId: activeBranchId,
          date: order.orderDate,
          accountName: 'Cost of Goods & Procurement',
          entryType: 'expense',
          amount: order.grandTotal,
          reference: order.documentNumber,
          description: `Purchase receipt from ${order.vendorName}`,
          sourceModule: 'purchase',
          createdAt: nowIso(),
        },
        ...nextLedger,
      ];
      ledgerPosted = true;
    }

    return {
      ...prev,
      catalogue: nextCatalogue,
      stockMovements: nextMovements,
      ledgerEntries: nextLedger,
      purchaseOrders: prev.purchaseOrders.map((o) =>
        o.id === order.id ? { ...order, stockPosted, ledgerPosted } : o,
      ),
    };
  };

  const createPurchaseOrder: ErpDataContextValue['createPurchaseOrder'] = (input) => {
    const totals = computeTotals(input.lines);
    const seq = data.purchaseOrders.length + 1;
    const order: PurchaseOrder = {
      id: uid(),
      companyId,
      branchId: activeBranchId,
      documentNumber: `PO-${String(seq).padStart(4, '0')}`,
      vendorId: input.vendorId,
      vendorName: input.vendorName.trim(),
      orderDate: input.orderDate,
      expectedDate: input.expectedDate,
      status: input.status,
      lines: totals.lines,
      subtotal: totals.subtotal,
      taxTotal: totals.taxTotal,
      grandTotal: totals.grandTotal,
      notes: input.notes,
      stockPosted: false,
      ledgerPosted: false,
      createdAt: nowIso(),
    };

    setState((prev) => {
      const withOrder: ErpDatabaseState = {
        ...prev,
        purchaseOrders: [order, ...prev.purchaseOrders],
      };
      return applyPurchaseSideEffects(withOrder, order);
    });

    return order;
  };

  const updatePurchaseStatus = (id: string, status: PurchaseStatus) => {
    setState((prev) => {
      const target = prev.purchaseOrders.find((o) => o.id === id);
      if (!target) return prev;
      return applyPurchaseSideEffects(prev, { ...target, status });
    });
  };

  const deletePurchaseOrder = (id: string) => {
    setState((prev) => ({
      ...prev,
      purchaseOrders: prev.purchaseOrders.filter((o) => o.id !== id),
    }));
  };

  const adjustStock: ErpDataContextValue['adjustStock'] = ({
    itemId,
    direction,
    quantity,
    reason,
  }) => {
    setState((prev) => {
      const target = prev.catalogue.find((i) => i.id === itemId && i.companyId === companyId);
      if (!target) return prev;
      const nextBalance =
        direction === 'in'
          ? target.stockOnHand + quantity
          : direction === 'out'
            ? Math.max(0, target.stockOnHand - quantity)
            : Math.max(0, quantity);
      const movement: StockMovement = {
        id: uid(),
        companyId,
        branchId: activeBranchId,
        itemId: target.id,
        itemName: target.name,
        sku: target.sku,
        direction,
        quantity,
        balanceAfter: nextBalance,
        reference: `ADJ-${todayDate()}`,
        reason: reason.trim() || 'Manual inventory adjustment',
        createdAt: nowIso(),
      };
      return {
        ...prev,
        catalogue: prev.catalogue.map((i) =>
          i.id === itemId ? { ...i, stockOnHand: nextBalance } : i,
        ),
        stockMovements: [movement, ...prev.stockMovements],
      };
    });
  };

  const addLedgerEntry: ErpDataContextValue['addLedgerEntry'] = (input) => {
    const created: LedgerEntry = {
      ...input,
      id: uid(),
      companyId,
      branchId: activeBranchId,
      sourceModule: 'manual',
      createdAt: nowIso(),
    };
    setState((prev) => ({
      ...prev,
      ledgerEntries: [created, ...prev.ledgerEntries],
    }));
    return created;
  };

  const deleteLedgerEntry = (id: string) => {
    setState((prev) => ({
      ...prev,
      ledgerEntries: prev.ledgerEntries.filter((e) => e.id !== id),
    }));
  };

  const addEmployee: ErpDataContextValue['addEmployee'] = (input) => {
    const created: EmployeeRecord = {
      ...input,
      id: uid(),
      companyId,
      branchId: activeBranchId,
      createdAt: nowIso(),
    };
    setState((prev) => ({
      ...prev,
      employees: [created, ...prev.employees],
    }));
    return created;
  };

  const toggleEmployeeStatus = (id: string) => {
    setState((prev) => ({
      ...prev,
      employees: prev.employees.map((e) =>
        e.id === id
          ? { ...e, status: e.status === 'active' ? 'on_leave' : 'active' }
          : e,
      ),
    }));
  };

  const deleteEmployee = (id: string) => {
    setState((prev) => ({
      ...prev,
      employees: prev.employees.filter((e) => e.id !== id),
    }));
  };

  const runMonthlyPayroll = (): number => {
    const activeEmployees = data.employees.filter((e) => e.status === 'active');
    const totalPayroll = activeEmployees.reduce((sum, e) => sum + e.monthlySalary, 0);
    if (totalPayroll <= 0) return 0;

    const monthTag = todayDate().slice(0, 7);
    const entry: LedgerEntry = {
      id: uid(),
      companyId,
      branchId: activeBranchId,
      date: todayDate(),
      accountName: 'Salaries & Payroll Expense',
      entryType: 'expense',
      amount: totalPayroll,
      reference: `PAYROLL-${monthTag}`,
      description: `Monthly payroll run for ${activeEmployees.length} active employees`,
      sourceModule: 'payroll',
      createdAt: nowIso(),
    };
    setState((prev) => ({
      ...prev,
      ledgerEntries: [entry, ...prev.ledgerEntries],
    }));
    pushNotification({
      category: 'governance',
      title: `Payroll Posted (${monthTag})`,
      body: `Disbursed payroll for ${activeEmployees.length} employees into Accounting Ledger.`,
    });
    return totalPayroll;
  };

  const addProjectTask: ErpDataContextValue['addProjectTask'] = (input) => {
    const created: ProjectTask = {
      ...input,
      id: uid(),
      companyId,
      createdAt: nowIso(),
    };
    setState((prev) => ({
      ...prev,
      projectTasks: [created, ...prev.projectTasks],
    }));
    return created;
  };

  const updateProjectTaskStatus = (id: string, status: ProjectTaskStatus) => {
    setState((prev) => ({
      ...prev,
      projectTasks: prev.projectTasks.map((t) => (t.id === id ? { ...t, status } : t)),
    }));
  };

  const deleteProjectTask = (id: string) => {
    setState((prev) => ({
      ...prev,
      projectTasks: prev.projectTasks.filter((t) => t.id !== id),
    }));
  };

  const addSupportTicket: ErpDataContextValue['addSupportTicket'] = (input) => {
    const seq = data.supportTickets.length + 1;
    const created: SupportTicket = {
      ...input,
      id: uid(),
      companyId,
      ticketNumber: `TKT-${String(seq).padStart(4, '0')}`,
      createdAt: nowIso(),
    };
    setState((prev) => ({
      ...prev,
      supportTickets: [created, ...prev.supportTickets],
    }));
    return created;
  };

  const updateSupportTicketStatus = (id: string, status: TicketStatus) => {
    setState((prev) => ({
      ...prev,
      supportTickets: prev.supportTickets.map((t) =>
        t.id === id ? { ...t, status } : t,
      ),
    }));
  };

  const deleteSupportTicket = (id: string) => {
    setState((prev) => ({
      ...prev,
      supportTickets: prev.supportTickets.filter((t) => t.id !== id),
    }));
  };

  const addDocument: ErpDataContextValue['addDocument'] = (input) => {
    const created: DocumentRecord = {
      ...input,
      id: uid(),
      companyId,
      createdAt: nowIso(),
    };
    setState((prev) => ({
      ...prev,
      documents: [created, ...prev.documents],
    }));
    return created;
  };

  const deleteDocument = (id: string) => {
    setState((prev) => ({
      ...prev,
      documents: prev.documents.filter((d) => d.id !== id),
    }));
  };

  const addCampaign: ErpDataContextValue['addCampaign'] = (input) => {
    const created: MarketingCampaign = {
      ...input,
      id: uid(),
      companyId,
      createdAt: nowIso(),
    };
    setState((prev) => ({
      ...prev,
      campaigns: [created, ...prev.campaigns],
    }));
    return created;
  };

  const deleteCampaign = (id: string) => {
    setState((prev) => ({
      ...prev,
      campaigns: prev.campaigns.filter((c) => c.id !== id),
    }));
  };

  const addIndustryRecord: ErpDataContextValue['addIndustryRecord'] = (input) => {
    const created: IndustryOperationRecord = {
      ...input,
      id: uid(),
      companyId,
      createdAt: nowIso(),
    };
    setState((prev) => ({
      ...prev,
      industryRecords: [created, ...prev.industryRecords],
    }));
    return created;
  };

  const updateIndustryRecordStatus = (
    id: string,
    status: IndustryOperationRecord['status'],
  ) => {
    setState((prev) => ({
      ...prev,
      industryRecords: prev.industryRecords.map((r) =>
        r.id === id ? { ...r, status } : r,
      ),
    }));
  };

  const deleteIndustryRecord = (id: string) => {
    setState((prev) => ({
      ...prev,
      industryRecords: prev.industryRecords.filter((r) => r.id !== id),
    }));
  };

  const exportCompanyBackupJson = () => {
    return JSON.stringify(
      {
        exportedAt: nowIso(),
        companyId,
        companyCode: activeCompany.companyCode,
        companyName: activeCompany.companyName,
        records: data,
      },
      null,
      2,
    );
  };

  const importCompanyBackupJson = (jsonText: string) => {
    const parsed = JSON.parse(jsonText) as { records?: Partial<ErpCompanyScopedData> };
    const r = parsed.records;
    if (!r || typeof r !== 'object') {
      throw new Error('Invalid WENDORO backup JSON format.');
    }
    const stamp = <T extends { companyId: string }>(arr: T[] | undefined): T[] =>
      Array.isArray(arr) ? arr.map((item) => ({ ...item, companyId })) : [];

    const imported = {
      catalogue: stamp(r.catalogue),
      contacts: stamp(r.contacts),
      salesOrders: stamp(r.salesOrders),
      purchaseOrders: stamp(r.purchaseOrders),
      stockMovements: stamp(r.stockMovements),
      ledgerEntries: stamp(r.ledgerEntries),
      employees: stamp(r.employees),
      projectTasks: stamp(r.projectTasks),
      supportTickets: stamp(r.supportTickets),
      documents: stamp(r.documents),
      campaigns: stamp(r.campaigns),
      industryRecords: stamp(r.industryRecords),
    };

    const importedCount =
      imported.catalogue.length +
      imported.contacts.length +
      imported.salesOrders.length +
      imported.purchaseOrders.length +
      imported.ledgerEntries.length +
      imported.employees.length +
      imported.projectTasks.length +
      imported.supportTickets.length +
      imported.documents.length +
      imported.campaigns.length +
      imported.industryRecords.length;

    setState((prev) => ({
      catalogue: [...imported.catalogue, ...prev.catalogue.filter((x) => x.companyId !== companyId)],
      contacts: [...imported.contacts, ...prev.contacts.filter((x) => x.companyId !== companyId)],
      salesOrders: [...imported.salesOrders, ...prev.salesOrders.filter((x) => x.companyId !== companyId)],
      purchaseOrders: [...imported.purchaseOrders, ...prev.purchaseOrders.filter((x) => x.companyId !== companyId)],
      stockMovements: [...imported.stockMovements, ...prev.stockMovements.filter((x) => x.companyId !== companyId)],
      ledgerEntries: [...imported.ledgerEntries, ...prev.ledgerEntries.filter((x) => x.companyId !== companyId)],
      employees: [...imported.employees, ...prev.employees.filter((x) => x.companyId !== companyId)],
      projectTasks: [...imported.projectTasks, ...prev.projectTasks.filter((x) => x.companyId !== companyId)],
      supportTickets: [...imported.supportTickets, ...prev.supportTickets.filter((x) => x.companyId !== companyId)],
      documents: [...imported.documents, ...prev.documents.filter((x) => x.companyId !== companyId)],
      campaigns: [...imported.campaigns, ...prev.campaigns.filter((x) => x.companyId !== companyId)],
      industryRecords: [...imported.industryRecords, ...prev.industryRecords.filter((x) => x.companyId !== companyId)],
    }));

    return { importedCount };
  };

  const clearActiveCompanyData = () => {
    setState((prev) => ({
      catalogue: prev.catalogue.filter((x) => x.companyId !== companyId),
      contacts: prev.contacts.filter((x) => x.companyId !== companyId),
      salesOrders: prev.salesOrders.filter((x) => x.companyId !== companyId),
      purchaseOrders: prev.purchaseOrders.filter((x) => x.companyId !== companyId),
      stockMovements: prev.stockMovements.filter((x) => x.companyId !== companyId),
      ledgerEntries: prev.ledgerEntries.filter((x) => x.companyId !== companyId),
      employees: prev.employees.filter((x) => x.companyId !== companyId),
      projectTasks: prev.projectTasks.filter((x) => x.companyId !== companyId),
      supportTickets: prev.supportTickets.filter((x) => x.companyId !== companyId),
      documents: prev.documents.filter((x) => x.companyId !== companyId),
      campaigns: prev.campaigns.filter((x) => x.companyId !== companyId),
      industryRecords: prev.industryRecords.filter((x) => x.companyId !== companyId),
    }));
  };

  return (
    <ErpDataContext.Provider
      value={{
        data,
        metrics,
        addCatalogueItem,
        deleteCatalogueItem,
        addContact,
        updateContactStage,
        deleteContact,
        createSalesOrder,
        updateSalesStatus,
        deleteSalesOrder,
        createPurchaseOrder,
        updatePurchaseStatus,
        deletePurchaseOrder,
        adjustStock,
        addLedgerEntry,
        deleteLedgerEntry,
        addEmployee,
        toggleEmployeeStatus,
        deleteEmployee,
        runMonthlyPayroll,
        addProjectTask,
        updateProjectTaskStatus,
        deleteProjectTask,
        addSupportTicket,
        updateSupportTicketStatus,
        deleteSupportTicket,
        addDocument,
        deleteDocument,
        addCampaign,
        deleteCampaign,
        addIndustryRecord,
        updateIndustryRecordStatus,
        deleteIndustryRecord,
        exportCompanyBackupJson,
        importCompanyBackupJson,
        clearActiveCompanyData,
      }}
    >
      {children}
    </ErpDataContext.Provider>
  );
}

export function useErpData(): ErpDataContextValue {
  const ctx = useContext(ErpDataContext);
  if (!ctx) {
    throw new Error('useErpData must be used within ErpDataProvider');
  }
  return ctx;
}
