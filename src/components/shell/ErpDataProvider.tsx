import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  AuditLogRecord,
  CatalogueItem,
  ChartAccount,
  CrmContact,
  CrmStage,
  DocumentRecord,
  EmployeeRecord,
  ErpDatabaseState,
  FiscalPeriod,
  IndustryOperationRecord,
  InventoryLot,
  JournalEntry,
  LedgerEntry,
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
  TrialBalanceRow,
  computeTrialBalance,
  createUuid,
  ensureCompanyAccounts,
  nowIso,
  postJournalEntry,
  reverseJournalEntry,
  roundMoney,
  setFiscalPeriodStatus,
} from '@/src/core/engine/accountingEngine';
import {
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
  txUpdateSalesStatus,
} from '@/src/core/engine/erpTransactions';
import {
  PersistenceAdapterMode,
  defaultDevStorageAdapter,
} from '@/src/core/engine/storageAdapter';
import { useTenant } from './TenantProvider';

export interface ErpCompanyScopedData {
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

interface ErpDataContextValue {
  storageMode: PersistenceAdapterMode;
  data: ErpCompanyScopedData;
  trialBalance: {
    rows: TrialBalanceRow[];
    totalDebits: number;
    totalCredits: number;
    isBalanced: boolean;
  };
  metrics: {
    totalRevenue: number;
    totalExpenses: number;
    netIncome: number;
    openReceivables: number;
    openPayables: number;
    inventoryAssetValue: number;
    taxLiabilityNet: number;
    lowStockCount: number;
    openTasksCount: number;
    openTicketsCount: number;
  };
  addCatalogueItem: (
    item: Omit<
      CatalogueItem,
      'id' | 'companyId' | 'reservedQty' | 'inventoryAssetValue' | 'version' | 'createdAt'
    >,
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
    isImmediatePosSale?: boolean;
  }) => SalesOrder;
  updateSalesStatus: (id: string, status: SalesStatus) => void;
  dispatchSalesOrder: (orderId: string, dispatchDate?: string) => SalesOrder;
  recordSalesPayment: (input: {
    orderId: string;
    amount: number;
    paymentDate: string;
    method?: PaymentAllocation['method'];
    reference?: string;
  }) => PaymentAllocation;
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
  receivePurchaseOrder: (input: {
    orderId: string;
    receiptDate?: string;
    batchNumber?: string;
    serialNumbers?: string[];
    expiryDate?: string;
  }) => PurchaseOrder;
  recordPurchasePayment: (input: {
    orderId: string;
    amount: number;
    paymentDate: string;
    method?: PaymentAllocation['method'];
    reference?: string;
  }) => PaymentAllocation;
  deletePurchaseOrder: (id: string) => void;
  adjustStock: (input: {
    itemId: string;
    direction: 'in' | 'out' | 'adjustment';
    quantity: number;
    reason: string;
    expectedVersion?: number;
    batchNumber?: string;
    serialNumbers?: string[];
  }) => CatalogueItem;
  postBalancedJournal: (input: {
    date: string;
    reference: string;
    description: string;
    lines: DraftJournalLine[];
  }) => JournalEntry;
  reverseJournal: (journalId: string, reason: string) => JournalEntry;
  toggleFiscalPeriod: (periodCode: string, status: 'open' | 'closed') => void;
  addEmployee: (
    emp: Omit<EmployeeRecord, 'id' | 'companyId' | 'branchId' | 'createdAt'>,
  ) => EmployeeRecord;
  toggleEmployeeStatus: (id: string) => void;
  deleteEmployee: (id: string) => void;
  runMonthlyPayroll: (input?: {
    periodKey?: string;
    paymentDate?: string;
    disburseCashImmediately?: boolean;
  }) => PayrollRun;
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
  const { principal, activeCompany, activeBranchId, pushNotification } = useTenant();
  const [state, setState] = useState<ErpDatabaseState>(() => {
    const loaded = defaultDevStorageAdapter.loadState();
    return ensureCompanyAccounts(loaded, activeCompany.companyId).nextState;
  });

  const companyId = activeCompany.companyId;

  useEffect(() => {
    setState((prev) => ensureCompanyAccounts(prev, companyId).nextState);
  }, [companyId]);

  useEffect(() => {
    defaultDevStorageAdapter.saveState(state);
  }, [state]);

  const scope: TransactionScope = useMemo(
    () => ({
      companyId,
      branchId: activeBranchId,
      actorUserId: principal.userId,
      actorRole: activeCompany.roleSlug,
    }),
    [companyId, activeBranchId, principal.userId, activeCompany.roleSlug],
  );

  const data: ErpCompanyScopedData = useMemo(
    () => ({
      catalogue: state.catalogue.filter((r) => r.companyId === companyId),
      contacts: state.contacts.filter((r) => r.companyId === companyId),
      salesOrders: state.salesOrders.filter((r) => r.companyId === companyId),
      purchaseOrders: state.purchaseOrders.filter((r) => r.companyId === companyId),
      stockMovements: state.stockMovements.filter((r) => r.companyId === companyId),
      inventoryLots: state.inventoryLots.filter((r) => r.companyId === companyId),
      stockReservations: state.stockReservations.filter((r) => r.companyId === companyId),
      accounts: state.accounts.filter((r) => r.companyId === companyId),
      fiscalPeriods: state.fiscalPeriods.filter((r) => r.companyId === companyId),
      journals: state.journals.filter((r) => r.companyId === companyId),
      paymentAllocations: state.paymentAllocations.filter((r) => r.companyId === companyId),
      ledgerEntries: state.ledgerEntries.filter((r) => r.companyId === companyId),
      employees: state.employees.filter((r) => r.companyId === companyId),
      payrollRuns: state.payrollRuns.filter((r) => r.companyId === companyId),
      projectTasks: state.projectTasks.filter((r) => r.companyId === companyId),
      supportTickets: state.supportTickets.filter((r) => r.companyId === companyId),
      documents: state.documents.filter((r) => r.companyId === companyId),
      campaigns: state.campaigns.filter((r) => r.companyId === companyId),
      industryRecords: state.industryRecords.filter((r) => r.companyId === companyId),
      auditLogs: state.auditLogs.filter((r) => r.companyId === companyId),
    }),
    [state, companyId],
  );

  const trialBalance = useMemo(
    () => computeTrialBalance(state, companyId),
    [state, companyId],
  );

  const metrics = useMemo(() => {
    const byCode = new Map(trialBalance.rows.map((r) => [r.code, r.netBalance]));
    const totalRevenue = roundMoney(
      trialBalance.rows
        .filter((r) => r.category === 'revenue')
        .reduce((s, r) => s + r.netBalance, 0),
    );
    const totalExpenses = roundMoney(
      trialBalance.rows
        .filter((r) => r.category === 'expense')
        .reduce((s, r) => s + r.netBalance, 0),
    );
    const openReceivables = roundMoney(Math.max(0, byCode.get('1200') ?? 0));
    const openPayables = roundMoney(Math.max(0, byCode.get('2100') ?? 0));
    const inventoryAssetValue = roundMoney(Math.max(0, byCode.get('1300') ?? 0));
    const outputTax = byCode.get('2200') ?? 0;
    const inputTax = byCode.get('1400') ?? 0;
    const taxLiabilityNet = roundMoney(outputTax - inputTax);

    const lowStockCount = data.catalogue.filter(
      (i) => i.trackStock && i.stockOnHand - i.reservedQty <= i.reorderLevel,
    ).length;
    const openTasksCount = data.projectTasks.filter((t) => t.status !== 'done').length;
    const openTicketsCount = data.supportTickets.filter(
      (t) => t.status === 'open' || t.status === 'in_progress',
    ).length;

    return {
      totalRevenue,
      totalExpenses,
      netIncome: roundMoney(totalRevenue - totalExpenses),
      openReceivables,
      openPayables,
      inventoryAssetValue,
      taxLiabilityNet,
      lowStockCount,
      openTasksCount,
      openTicketsCount,
    };
  }, [trialBalance, data]);

  const addCatalogueItem: ErpDataContextValue['addCatalogueItem'] = (input) => {
    const res = txAddCatalogueItem(state, scope, input);
    setState(res.nextState);
    return res.item;
  };

  const deleteCatalogueItem = (id: string) => {
    setState((prev) => ({
      ...prev,
      catalogue: prev.catalogue.filter((i) => !(i.id === id && i.companyId === companyId)),
    }));
  };

  const addContact: ErpDataContextValue['addContact'] = (input) => {
    const created: CrmContact = {
      ...input,
      id: createUuid(),
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
      contacts: prev.contacts.map((c) =>
        c.id === id && c.companyId === companyId ? { ...c, stage } : c,
      ),
    }));
  };

  const deleteContact = (id: string) => {
    setState((prev) => ({
      ...prev,
      contacts: prev.contacts.filter((c) => !(c.id === id && c.companyId === companyId)),
    }));
  };

  const createSalesOrder: ErpDataContextValue['createSalesOrder'] = (input) => {
    const res = txCreateSalesOrder(state, scope, input);
    setState(res.nextState);
    pushNotification({
      category: 'governance',
      title: `${res.order.documentNumber} Created`,
      body: `${res.order.customerName} · ${res.order.status.toUpperCase()}`,
    });
    return res.order;
  };

  const updateSalesStatus = (id: string, status: SalesStatus) => {
    const next = txUpdateSalesStatus(state, scope, id, status);
    setState(next);
  };

  const dispatchSalesOrder: ErpDataContextValue['dispatchSalesOrder'] = (
    orderId,
    dispatchDate,
  ) => {
    const res = txDispatchSalesOrder(state, scope, { orderId, dispatchDate });
    setState(res.nextState);
    pushNotification({
      category: 'governance',
      title: `${res.order.documentNumber} Dispatched`,
      body: `Delivery note ${res.order.dispatchRef} posted stock deduction & COGS.`,
    });
    return res.order;
  };

  const recordSalesPayment: ErpDataContextValue['recordSalesPayment'] = (input) => {
    const res = txRecordSalesPayment(state, scope, input);
    setState(res.nextState);
    return res.allocation;
  };

  const deleteSalesOrder = (id: string) => {
    setState((prev) => {
      const target = prev.salesOrders.find((o) => o.id === id && o.companyId === companyId);
      if (target && (target.ledgerPosted || target.stockPosted)) {
        throw new Error(
          `Cannot delete ${target.documentNumber} after financial or stock posting. Cancel or reverse journal instead.`,
        );
      }
      return {
        ...prev,
        salesOrders: prev.salesOrders.filter((o) => o.id !== id),
      };
    });
  };

  const createPurchaseOrder: ErpDataContextValue['createPurchaseOrder'] = (input) => {
    const res = txCreatePurchaseOrder(state, scope, input);
    setState(res.nextState);
    return res.order;
  };

  const receivePurchaseOrder: ErpDataContextValue['receivePurchaseOrder'] = (input) => {
    const res = txReceivePurchaseOrder(state, scope, input);
    setState(res.nextState);
    pushNotification({
      category: 'governance',
      title: `${res.order.documentNumber} Received`,
      body: `GRN ${res.order.receiptRef} updated inventory valuation & Accounts Payable.`,
    });
    return res.order;
  };

  const recordPurchasePayment: ErpDataContextValue['recordPurchasePayment'] = (input) => {
    const res = txRecordPurchasePayment(state, scope, input);
    setState(res.nextState);
    return res.allocation;
  };

  const deletePurchaseOrder = (id: string) => {
    setState((prev) => {
      const target = prev.purchaseOrders.find((o) => o.id === id && o.companyId === companyId);
      if (target && (target.ledgerPosted || target.stockPosted)) {
        throw new Error(
          `Cannot delete ${target.documentNumber} after goods receipt. Reverse journal instead.`,
        );
      }
      return {
        ...prev,
        purchaseOrders: prev.purchaseOrders.filter((o) => o.id !== id),
      };
    });
  };

  const adjustStock: ErpDataContextValue['adjustStock'] = (input) => {
    const res = txAdjustStock(state, scope, input);
    setState(res.nextState);
    return res.item;
  };

  const postBalancedJournal: ErpDataContextValue['postBalancedJournal'] = (input) => {
    const res = postJournalEntry(state, {
      companyId,
      branchId: activeBranchId,
      date: input.date,
      reference: input.reference.trim() || `MAN-${Date.now().toString().slice(-4)}`,
      description: input.description.trim() || 'Manual double-entry journal',
      sourceModule: 'manual',
      idempotencyKey: `manual:${companyId}:${createUuid()}`,
      lines: input.lines,
    });
    setState(res.nextState);
    return res.journal;
  };

  const reverseJournal: ErpDataContextValue['reverseJournal'] = (journalId, reason) => {
    const res = reverseJournalEntry(state, {
      companyId,
      branchId: activeBranchId,
      journalId,
      reversalDate: new Date().toISOString().slice(0, 10),
      reason: reason.trim() || 'Operator reversal',
    });
    setState(res.nextState);
    return res.reversalJournal;
  };

  const toggleFiscalPeriod: ErpDataContextValue['toggleFiscalPeriod'] = (
    periodCode,
    status,
  ) => {
    setState((prev) => setFiscalPeriodStatus(prev, companyId, periodCode, status));
  };

  const addEmployee: ErpDataContextValue['addEmployee'] = (input) => {
    const created: EmployeeRecord = {
      ...input,
      id: createUuid(),
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
        e.id === id && e.companyId === companyId
          ? { ...e, status: e.status === 'active' ? 'on_leave' : 'active' }
          : e,
      ),
    }));
  };

  const deleteEmployee = (id: string) => {
    setState((prev) => ({
      ...prev,
      employees: prev.employees.filter((e) => !(e.id === id && e.companyId === companyId)),
    }));
  };

  const runMonthlyPayroll: ErpDataContextValue['runMonthlyPayroll'] = (input) => {
    const res = txRunMonthlyPayroll(state, scope, input);
    setState(res.nextState);
    pushNotification({
      category: 'governance',
      title: `Payroll Posted (${res.payrollRun.periodKey})`,
      body: `Posted balanced payroll journal for ${res.payrollRun.employeeCount} active employees.`,
    });
    return res.payrollRun;
  };

  const addProjectTask: ErpDataContextValue['addProjectTask'] = (input) => {
    const created: ProjectTask = {
      ...input,
      id: createUuid(),
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
      projectTasks: prev.projectTasks.map((t) =>
        t.id === id && t.companyId === companyId ? { ...t, status } : t,
      ),
    }));
  };

  const deleteProjectTask = (id: string) => {
    setState((prev) => ({
      ...prev,
      projectTasks: prev.projectTasks.filter((t) => !(t.id === id && t.companyId === companyId)),
    }));
  };

  const addSupportTicket: ErpDataContextValue['addSupportTicket'] = (input) => {
    const seq = data.supportTickets.length + 1;
    const created: SupportTicket = {
      ...input,
      id: createUuid(),
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
        t.id === id && t.companyId === companyId ? { ...t, status } : t,
      ),
    }));
  };

  const deleteSupportTicket = (id: string) => {
    setState((prev) => ({
      ...prev,
      supportTickets: prev.supportTickets.filter((t) => !(t.id === id && t.companyId === companyId)),
    }));
  };

  const addDocument: ErpDataContextValue['addDocument'] = (input) => {
    const created: DocumentRecord = {
      ...input,
      id: createUuid(),
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
      documents: prev.documents.filter((d) => !(d.id === id && d.companyId === companyId)),
    }));
  };

  const addCampaign: ErpDataContextValue['addCampaign'] = (input) => {
    const created: MarketingCampaign = {
      ...input,
      id: createUuid(),
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
      campaigns: prev.campaigns.filter((c) => !(c.id === id && c.companyId === companyId)),
    }));
  };

  const addIndustryRecord: ErpDataContextValue['addIndustryRecord'] = (input) => {
    const created: IndustryOperationRecord = {
      ...input,
      id: createUuid(),
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
        r.id === id && r.companyId === companyId ? { ...r, status } : r,
      ),
    }));
  };

  const deleteIndustryRecord = (id: string) => {
    setState((prev) => ({
      ...prev,
      industryRecords: prev.industryRecords.filter((r) => !(r.id === id && r.companyId === companyId)),
    }));
  };

  const exportCompanyBackupJson = () =>
    txExportCompanyBackup(state, {
      companyId,
      companyCode: activeCompany.companyCode,
      companyName: activeCompany.companyName,
    });

  const importCompanyBackupJson = (jsonText: string) => {
    const res = txImportCompanyBackup(state, scope, jsonText);
    setState(res.nextState);
    return { importedCount: res.importedCount };
  };

  const clearActiveCompanyData = () => {
    setState((prev) => {
      const cleaned: ErpDatabaseState = {
        ...prev,
        catalogue: prev.catalogue.filter((x) => x.companyId !== companyId),
        contacts: prev.contacts.filter((x) => x.companyId !== companyId),
        salesOrders: prev.salesOrders.filter((x) => x.companyId !== companyId),
        purchaseOrders: prev.purchaseOrders.filter((x) => x.companyId !== companyId),
        stockMovements: prev.stockMovements.filter((x) => x.companyId !== companyId),
        inventoryLots: prev.inventoryLots.filter((x) => x.companyId !== companyId),
        stockReservations: prev.stockReservations.filter((x) => x.companyId !== companyId),
        accounts: prev.accounts.filter((x) => x.companyId !== companyId),
        fiscalPeriods: prev.fiscalPeriods.filter((x) => x.companyId !== companyId),
        journals: prev.journals.filter((x) => x.companyId !== companyId),
        paymentAllocations: prev.paymentAllocations.filter((x) => x.companyId !== companyId),
        ledgerEntries: prev.ledgerEntries.filter((x) => x.companyId !== companyId),
        employees: prev.employees.filter((x) => x.companyId !== companyId),
        payrollRuns: prev.payrollRuns.filter((x) => x.companyId !== companyId),
        projectTasks: prev.projectTasks.filter((x) => x.companyId !== companyId),
        supportTickets: prev.supportTickets.filter((x) => x.companyId !== companyId),
        documents: prev.documents.filter((x) => x.companyId !== companyId),
        campaigns: prev.campaigns.filter((x) => x.companyId !== companyId),
        industryRecords: prev.industryRecords.filter((x) => x.companyId !== companyId),
        auditLogs: prev.auditLogs.filter((x) => x.companyId !== companyId),
      };
      return ensureCompanyAccounts(cleaned, companyId).nextState;
    });
  };

  return (
    <ErpDataContext.Provider
      value={{
        storageMode: defaultDevStorageAdapter.mode,
        data,
        trialBalance,
        metrics,
        addCatalogueItem,
        deleteCatalogueItem,
        addContact,
        updateContactStage,
        deleteContact,
        createSalesOrder,
        updateSalesStatus,
        dispatchSalesOrder,
        recordSalesPayment,
        deleteSalesOrder,
        createPurchaseOrder,
        receivePurchaseOrder,
        recordPurchasePayment,
        deletePurchaseOrder,
        adjustStock,
        postBalancedJournal,
        reverseJournal,
        toggleFiscalPeriod,
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
