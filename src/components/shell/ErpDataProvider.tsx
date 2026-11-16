import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  ApprovalRule,
  AttendanceLog,
  AuditLogRecord,
  BankTransaction,
  BiSavedReport,
  BomDefinition,
  BudgetAllocation,
  Candidate,
  CatalogueItem,
  ChartAccount,
  CreditNote,
  CrmActivity,
  CrmContact,
  CrmStage,
  CustomFieldDefinition,
  DocumentRecord,
  EmployeeRecord,
  ErpDatabaseState,
  ExpenseClaim,
  FiscalPeriod,
  FixedAsset,
  IndustryOperationRecord,
  InventoryLot,
  JobOpening,
  JournalEntry,
  KbArticle,
  LeaveRequest,
  LedgerEntry,
  MaintenanceSchedule,
  MarketingCampaign,
  OrderLineItem,
  PaymentAllocation,
  PayrollRun,
  PerformanceGoal,
  PosShift,
  ProjectTask,
  ProjectTaskStatus,
  PurchaseOrder,
  PurchaseRequisition,
  PurchaseStatus,
  QualityInspection,
  SalesOrder,
  SalesStatus,
  ShipmentRecord,
  StockMovement,
  StockReservation,
  StockTransfer,
  SupportTicket,
  TicketStatus,
  TimesheetEntry,
  Warehouse,
  WorkOrder,
} from '@/src/core/store/erpTypes';
import {
  AgingReport,
  DraftJournalLine,
  FinancialStatementsReport,
  TrialBalanceRow,
  computeAgingReport,
  computeFinancialStatements,
  computeTrialBalance,
  createUuid,
  ensureCompanyAccounts,
  nextSequenceNumber,
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
  txApproveExpenseClaim,
  txClosePosShift,
  txCompleteWorkOrder,
  txConvertRequisitionToPo,
  txCreateCreditNote,
  txHireCandidateToEmployee,
  txRegisterFixedAsset,
  txRunMonthlyDepreciation,
  txTransferStockBetweenWarehouses,
} from '@/src/core/engine/erpModuleTransactions';
import {
  PersistenceAdapterMode,
  defaultDevStorageAdapter,
} from '@/src/core/engine/storageAdapter';
import {
  SyncStatusMode,
  createHttpSyncTransport,
  getDefaultDexieRepository,
  isNavigatorOnline,
} from '@/src/core/engine/dexieStorage';
import { useToast } from '@/src/components/ui/ToastProvider';
import { useTenant } from './TenantProvider';

export interface ErpCompanyScopedData {
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

export interface ErpSyncState {
  status: SyncStatusMode;
  isOnline: boolean;
  pendingCount: number;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  hydratedFromIndexedDb: boolean;
  triggerSync: () => Promise<void>;
}

interface ErpDataContextValue {
  storageMode: PersistenceAdapterMode;
  syncState: ErpSyncState;
  data: ErpCompanyScopedData;
  trialBalance: {
    rows: TrialBalanceRow[];
    totalDebits: number;
    totalCredits: number;
    isBalanced: boolean;
  };
  financialStatements: FinancialStatementsReport;
  agingReport: AgingReport;
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
  addContactActivity: (contactId: string, activity: Omit<CrmActivity, 'id'>) => void;
  updateContactScore: (contactId: string, leadScore: number) => void;
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
    paymentMethod?: PaymentAllocation['method'];
    salesperson?: string;
    commissionRate?: number;
    isRecurring?: boolean;
    recurringInterval?: 'monthly' | 'quarterly' | 'annual';
    isDropShip?: boolean;
    channel?: 'direct' | 'pos' | 'ecommerce';
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
  createCreditNote: (input: {
    salesOrderId: string;
    issueDate: string;
    reason: string;
    restoreStock: boolean;
  }) => CreditNote;
  deleteSalesOrder: (id: string) => void;
  openPosShift: (input: { registerName: string; cashierName: string; openingCash: number }) => PosShift;
  closePosShift: (shiftId: string, countedCash: number) => PosShift;
  createPurchaseOrder: (input: {
    vendorId?: string;
    vendorName: string;
    orderDate: string;
    expectedDate: string;
    status: PurchaseStatus;
    lines: Omit<OrderLineItem, 'id' | 'lineTotal'>[];
    notes: string;
    approvedBy?: string;
  }) => PurchaseOrder;
  approvePurchaseOrder: (orderId: string, approverName: string) => void;
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
  addPurchaseRequisition: (
    req: Omit<PurchaseRequisition, 'id' | 'companyId' | 'reqNumber' | 'status' | 'createdAt'>,
  ) => PurchaseRequisition;
  updateRequisitionStatus: (reqId: string, status: PurchaseRequisition['status']) => void;
  convertRequisitionToPo: (reqId: string, vendorName: string, expectedDate: string) => PurchaseOrder;
  addWarehouse: (wh: Omit<Warehouse, 'id' | 'companyId' | 'createdAt'>) => Warehouse;
  transferStock: (input: {
    itemId: string;
    fromWarehouse: string;
    toWarehouse: string;
    quantity: number;
    notes: string;
  }) => StockTransfer;
  addShipment: (
    shipment: Omit<ShipmentRecord, 'id' | 'companyId' | 'trackingNumber' | 'createdAt'>,
  ) => ShipmentRecord;
  updateShipmentStatus: (id: string, status: ShipmentRecord['status']) => void;
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
  registerFixedAsset: (input: {
    name: string;
    category: string;
    purchaseDate: string;
    purchaseCost: number;
    salvageValue: number;
    usefulLifeMonths: number;
    postAcquisitionJournal: boolean;
    paymentAccountCode?: '1000' | '2100';
  }) => FixedAsset;
  runMonthlyDepreciation: (periodKey: string, postingDate: string) => { totalDepreciation: number; assetsCount: number };
  addBudget: (budget: Omit<BudgetAllocation, 'id' | 'companyId' | 'createdAt'>) => BudgetAllocation;
  deleteBudget: (id: string) => void;
  addExpenseClaim: (
    claim: Omit<ExpenseClaim, 'id' | 'companyId' | 'claimNumber' | 'status' | 'createdAt'>,
  ) => ExpenseClaim;
  approveExpenseClaim: (claimId: string, payImmediately: boolean, postingDate: string) => ExpenseClaim;
  addBankTransaction: (
    tx: Omit<BankTransaction, 'id' | 'companyId' | 'status' | 'createdAt'>,
  ) => BankTransaction;
  reconcileBankTransaction: (txId: string, journalId: string) => void;
  addBom: (bom: Omit<BomDefinition, 'id' | 'companyId' | 'bomCode' | 'createdAt'>) => BomDefinition;
  createWorkOrder: (
    wo: Omit<WorkOrder, 'id' | 'companyId' | 'woNumber' | 'completedQty' | 'status' | 'totalMaterialCost' | 'totalConversionCost' | 'createdAt'>,
  ) => WorkOrder;
  completeWorkOrder: (workOrderId: string, completionDate: string) => WorkOrder;
  addQualityInspection: (
    qi: Omit<QualityInspection, 'id' | 'companyId' | 'inspectionNumber' | 'createdAt'>,
  ) => QualityInspection;
  addMaintenanceSchedule: (
    ms: Omit<MaintenanceSchedule, 'id' | 'companyId' | 'createdAt'>,
  ) => MaintenanceSchedule;
  completeMaintenanceSchedule: (id: string) => void;
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
  addLeaveRequest: (
    req: Omit<LeaveRequest, 'id' | 'companyId' | 'status' | 'createdAt'>,
  ) => LeaveRequest;
  updateLeaveStatus: (id: string, status: LeaveRequest['status']) => void;
  addAttendanceLog: (
    log: Omit<AttendanceLog, 'id' | 'companyId' | 'createdAt'>,
  ) => AttendanceLog;
  addJobOpening: (
    job: Omit<JobOpening, 'id' | 'companyId' | 'createdAt'>,
  ) => JobOpening;
  addCandidate: (
    cand: Omit<Candidate, 'id' | 'companyId' | 'createdAt'>,
  ) => Candidate;
  updateCandidateStage: (id: string, stage: Candidate['stage']) => void;
  hireCandidate: (candidateId: string, joinedDate: string, monthlySalary: number) => EmployeeRecord;
  addPerformanceGoal: (
    goal: Omit<PerformanceGoal, 'id' | 'companyId' | 'createdAt'>,
  ) => PerformanceGoal;
  updatePerformanceProgress: (id: string, progressPct: number) => void;
  addProjectTask: (task: Omit<ProjectTask, 'id' | 'companyId' | 'createdAt'>) => ProjectTask;
  updateProjectTaskStatus: (id: string, status: ProjectTaskStatus) => void;
  deleteProjectTask: (id: string) => void;
  addTimesheet: (
    ts: Omit<TimesheetEntry, 'id' | 'companyId' | 'billed' | 'createdAt'>,
  ) => TimesheetEntry;
  markTimesheetBilled: (id: string) => void;
  addSupportTicket: (
    ticket: Omit<SupportTicket, 'id' | 'companyId' | 'ticketNumber' | 'createdAt'>,
  ) => SupportTicket;
  updateSupportTicketStatus: (id: string, status: TicketStatus) => void;
  deleteSupportTicket: (id: string) => void;
  addKbArticle: (
    article: Omit<KbArticle, 'id' | 'companyId' | 'createdAt'>,
  ) => KbArticle;
  addDocument: (doc: Omit<DocumentRecord, 'id' | 'companyId' | 'createdAt'>) => DocumentRecord;
  signDocument: (id: string, signerName: string) => void;
  bumpDocumentVersion: (id: string) => void;
  deleteDocument: (id: string) => void;
  addCampaign: (
    campaign: Omit<MarketingCampaign, 'id' | 'companyId' | 'createdAt'>,
  ) => MarketingCampaign;
  deleteCampaign: (id: string) => void;
  addApprovalRule: (
    rule: Omit<ApprovalRule, 'id' | 'companyId' | 'createdAt'>,
  ) => ApprovalRule;
  toggleApprovalRule: (id: string) => void;
  addCustomField: (
    field: Omit<CustomFieldDefinition, 'id' | 'companyId' | 'createdAt'>,
  ) => CustomFieldDefinition;
  deleteCustomField: (id: string) => void;
  addBiReport: (
    report: Omit<BiSavedReport, 'id' | 'companyId' | 'createdAt'>,
  ) => BiSavedReport;
  deleteBiReport: (id: string) => void;
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
  const { principal, activeCompany, activeBranchId, licenseActivation, pushNotification } =
    useTenant();
  const { pushToast } = useToast();
  const dexieRepo = useMemo(() => getDefaultDexieRepository(), []);
  const [state, setRawState] = useState<ErpDatabaseState>(() => {
    const loaded = defaultDevStorageAdapter.loadState();
    return ensureCompanyAccounts(loaded, activeCompany.companyId).nextState;
  });

  const companyId = activeCompany.companyId;

  const [isOnline, setIsOnline] = useState<boolean>(() => isNavigatorOnline());
  const [syncStatus, setSyncStatus] = useState<SyncStatusMode>(() =>
    isNavigatorOnline() ? 'synced' : 'offline_queued',
  );
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);
  const [hydratedFromIndexedDb, setHydratedFromIndexedDb] = useState<boolean>(false);

  const hasHydratedRef = useRef<boolean>(false);
  const userMutatedBeforeHydrationRef = useRef<boolean>(false);
  const skipNextPersistRef = useRef<boolean>(true);
  const queueNextPersistRef = useRef<boolean>(false);
  const isOnlineRef = useRef<boolean>(isOnline);
  const offlineNoticeShownRef = useRef<boolean>(false);
  const licenseServerRef = useRef<string | undefined>(licenseActivation?.serverUrl);
  const licenseKeyRef = useRef<string | null>(licenseActivation?.licenseKey ?? null);

  isOnlineRef.current = isOnline;
  licenseServerRef.current = licenseActivation?.serverUrl;
  licenseKeyRef.current = licenseActivation?.licenseKey ?? null;

  const syncTransport = useMemo(
    () =>
      createHttpSyncTransport({
        getServerBaseUrl: () => licenseServerRef.current ?? '',
        getLicenseKey: () => licenseKeyRef.current,
      }),
    [],
  );

  // Wrapper used by all business mutations so they immediately persist to IndexedDB & queue sync
  const setState = useCallback(
    (updater: React.SetStateAction<ErpDatabaseState>) => {
      if (!hasHydratedRef.current) {
        userMutatedBeforeHydrationRef.current = true;
      }
      queueNextPersistRef.current = true;
      setRawState(updater);
    },
    [],
  );

  const runSyncFlush = useCallback(async () => {
    if (!dexieRepo) return;
    if (!isOnlineRef.current) {
      const summary = await dexieRepo.getSyncSummary();
      setPendingCount(summary.pendingCount);
      setLastSyncedAt(summary.lastSyncedAt);
      setSyncStatus(summary.pendingCount > 0 ? 'offline_queued' : 'synced');
      return;
    }

    const preSummary = await dexieRepo.getSyncSummary();
    if (preSummary.pendingCount === 0) {
      setPendingCount(0);
      setLastSyncedAt(preSummary.lastSyncedAt);
      setSyncStatus('synced');
      return;
    }

    setSyncStatus('syncing');
    const result = await dexieRepo.syncPendingChanges(syncTransport, () => isOnlineRef.current);
    setPendingCount(result.remainingCount);
    if (result.lastSyncedAt) {
      setLastSyncedAt(result.lastSyncedAt);
    }

    if (result.skippedOffline) {
      setSyncStatus(result.remainingCount > 0 ? 'offline_queued' : 'synced');
      return;
    }

    if (result.error) {
      setLastSyncError(result.error);
      setSyncStatus(result.remainingCount > 0 ? 'error' : 'synced');
      pushToast({
        variant: 'error',
        category: 'sync',
        title: 'Background Sync Failed',
        description: result.error,
        actionLabel: 'Retry',
        onAction: () => {
          void runSyncFlush();
        },
      });
    } else {
      setLastSyncError(null);
      setSyncStatus(result.remainingCount > 0 ? 'pending' : 'synced');
      if (result.syncedCount > 0) {
        offlineNoticeShownRef.current = false;
        pushToast({
          variant: 'success',
          category: 'sync',
          title: 'Background Sync Complete',
          description: `Synchronized ${result.syncedCount} queued IndexedDB batch(es) to local server.`,
        });
      }
    }
  }, [dexieRepo, syncTransport, pushToast]);

  // Boot hydration from local Dexie.js IndexedDB (with one-time legacy localStorage migration)
  useEffect(() => {
    if (!dexieRepo) return;
    let active = true;

    void dexieRepo.hydrateState().then((hydrated) => {
      if (!active) return;
      hasHydratedRef.current = true;
      setHydratedFromIndexedDb(true);
      setPendingCount(hydrated.pendingOutboxCount);
      setLastSyncedAt(hydrated.lastSyncedAt);

      if (!userMutatedBeforeHydrationRef.current) {
        skipNextPersistRef.current = true;
        setRawState(ensureCompanyAccounts(hydrated.state, companyId).nextState);
      }

      if (hydrated.pendingOutboxCount > 0) {
        if (isOnlineRef.current) {
          void runSyncFlush();
        } else {
          setSyncStatus('offline_queued');
        }
      } else {
        setSyncStatus('synced');
      }
    });

    return () => {
      active = false;
    };
  }, [dexieRepo]);

  // Track device network connectivity and automatically sync when returning online
  useEffect(() => {
    const handleOnline = () => {
      isOnlineRef.current = true;
      offlineNoticeShownRef.current = false;
      setIsOnline(true);
      void runSyncFlush();
    };
    const handleOffline = () => {
      isOnlineRef.current = false;
      setIsOnline(false);
      setSyncStatus((prev) => (pendingCount > 0 || prev === 'pending' ? 'offline_queued' : prev));
      if (!offlineNoticeShownRef.current) {
        offlineNoticeShownRef.current = true;
        pushToast({
          variant: 'warning',
          category: 'sync',
          title: 'Offline Mode Active',
          description:
            'Changes are persisted locally in IndexedDB (Dexie.js) and will sync automatically when online.',
        });
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [pendingCount, runSyncFlush, pushToast]);

  // Periodic background flush while online if any queued items remain
  useEffect(() => {
    if (!isOnline || pendingCount === 0) return;
    const interval = window.setInterval(() => {
      void runSyncFlush();
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [isOnline, pendingCount, runSyncFlush]);

  // Ensure default chart of accounts exists when switching active company
  useEffect(() => {
    setRawState((prev) => {
      const res = ensureCompanyAccounts(prev, companyId);
      if (res.nextState.accounts.length > prev.accounts.length) {
        queueNextPersistRef.current = true;
      }
      return res.nextState;
    });
  }, [companyId]);

  // Persist every state change atomically to Dexie.js IndexedDB and sync only when online
  useEffect(() => {
    try {
      defaultDevStorageAdapter.saveState(state);
    } catch {
      // Ignore localStorage quota limits when IndexedDB handles full dataset
    }

    if (!dexieRepo) return;

    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      return;
    }

    const shouldQueue = queueNextPersistRef.current;
    queueNextPersistRef.current = false;

    let cancelled = false;
    const persistTimer = window.setTimeout(() => {
      void dexieRepo
        .persistState(state, {
          queueSync: shouldQueue,
          activeCompanyId: companyId,
          changeSummary: `Updated ${activeCompany.companyCode} business records`,
        })
        .then(({ pendingCount: nextPending }) => {
          if (cancelled) return;
          setPendingCount(nextPending);
          if (nextPending > 0) {
            if (isOnlineRef.current) {
              void runSyncFlush();
            } else {
              setSyncStatus('offline_queued');
              if (!offlineNoticeShownRef.current) {
                offlineNoticeShownRef.current = true;
                pushToast({
                  variant: 'warning',
                  category: 'sync',
                  title: 'Saved Offline to IndexedDB',
                  description:
                    'Business records stored locally via Dexie.js and queued for sync until connection returns.',
                });
              }
            }
          } else {
            setSyncStatus('synced');
          }
        });
    }, 40);

    return () => {
      cancelled = true;
      window.clearTimeout(persistTimer);
    };
  }, [state, companyId, activeCompany.companyCode, dexieRepo, runSyncFlush, pushToast]);

  const scope: TransactionScope = useMemo(
    () => ({
      companyId,
      branchId: activeBranchId,
      actorUserId: principal.userId,
      actorRole: activeCompany.roleSlug,
    }),
    [companyId, activeBranchId, principal.userId, activeCompany.roleSlug],
  );

  const data: ErpCompanyScopedData = useMemo(() => {
    const byCo = <T extends { companyId: string }>(arr: T[]) =>
      arr.filter((r) => r.companyId === companyId);
    return {
      catalogue: byCo(state.catalogue),
      contacts: byCo(state.contacts),
      salesOrders: byCo(state.salesOrders),
      creditNotes: byCo(state.creditNotes),
      posShifts: byCo(state.posShifts),
      purchaseOrders: byCo(state.purchaseOrders),
      purchaseRequisitions: byCo(state.purchaseRequisitions),
      warehouses: byCo(state.warehouses),
      stockTransfers: byCo(state.stockTransfers),
      shipments: byCo(state.shipments),
      stockMovements: byCo(state.stockMovements),
      inventoryLots: byCo(state.inventoryLots),
      stockReservations: byCo(state.stockReservations),
      accounts: byCo(state.accounts),
      fiscalPeriods: byCo(state.fiscalPeriods),
      journals: byCo(state.journals),
      paymentAllocations: byCo(state.paymentAllocations),
      ledgerEntries: byCo(state.ledgerEntries),
      fixedAssets: byCo(state.fixedAssets),
      budgets: byCo(state.budgets),
      expenseClaims: byCo(state.expenseClaims),
      bankTransactions: byCo(state.bankTransactions),
      boms: byCo(state.boms),
      workOrders: byCo(state.workOrders),
      qualityInspections: byCo(state.qualityInspections),
      maintenanceSchedules: byCo(state.maintenanceSchedules),
      employees: byCo(state.employees),
      payrollRuns: byCo(state.payrollRuns),
      leaveRequests: byCo(state.leaveRequests),
      attendanceLogs: byCo(state.attendanceLogs),
      jobOpenings: byCo(state.jobOpenings),
      candidates: byCo(state.candidates),
      performanceGoals: byCo(state.performanceGoals),
      projectTasks: byCo(state.projectTasks),
      timesheets: byCo(state.timesheets),
      supportTickets: byCo(state.supportTickets),
      kbArticles: byCo(state.kbArticles),
      documents: byCo(state.documents),
      campaigns: byCo(state.campaigns),
      approvalRules: byCo(state.approvalRules),
      customFields: byCo(state.customFields),
      biReports: byCo(state.biReports),
      industryRecords: byCo(state.industryRecords),
      auditLogs: byCo(state.auditLogs),
    };
  }, [state, companyId]);

  const trialBalance = useMemo(() => computeTrialBalance(state, companyId), [state, companyId]);
  const financialStatements = useMemo(() => computeFinancialStatements(state, companyId), [state, companyId]);
  const agingReport = useMemo(() => computeAgingReport(state, companyId), [state, companyId]);

  const metrics = useMemo(() => {
    const byCode = new Map(trialBalance.rows.map((r) => [r.code, r.netBalance]));
    const totalRevenue = financialStatements.totalRevenue;
    const totalExpenses = financialStatements.totalExpenses;
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
      netIncome: financialStatements.netIncome,
      openReceivables,
      openPayables,
      inventoryAssetValue,
      taxLiabilityNet,
      lowStockCount,
      openTasksCount,
      openTicketsCount,
    };
  }, [trialBalance, financialStatements, data]);

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
      leadScore: input.leadScore ?? 50,
      loyaltyPoints: input.loyaltyPoints ?? 0,
      activities: input.activities ?? [],
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

  const addContactActivity = (contactId: string, activity: Omit<CrmActivity, 'id'>) => {
    const entry: CrmActivity = { ...activity, id: createUuid() };
    setState((prev) => ({
      ...prev,
      contacts: prev.contacts.map((c) =>
        c.id === contactId && c.companyId === companyId
          ? { ...c, activities: [entry, ...(c.activities ?? [])] }
          : c,
      ),
    }));
  };

  const updateContactScore = (contactId: string, leadScore: number) => {
    setState((prev) => ({
      ...prev,
      contacts: prev.contacts.map((c) =>
        c.id === contactId && c.companyId === companyId
          ? { ...c, leadScore: Math.max(0, Math.min(100, leadScore)) }
          : c,
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
    pushToast({
      variant: 'success',
      category: 'alert',
      title: `${res.order.documentNumber} Created`,
      description: `${res.order.customerName} · ${res.order.status.toUpperCase()}`,
    });
    return res.order;
  };

  const updateSalesStatus = (id: string, status: SalesStatus) => {
    const next = txUpdateSalesStatus(state, scope, id, status);
    setState(next);
  };

  const dispatchSalesOrder: ErpDataContextValue['dispatchSalesOrder'] = (orderId, dispatchDate) => {
    const res = txDispatchSalesOrder(state, scope, { orderId, dispatchDate });
    setState(res.nextState);
    pushNotification({
      category: 'governance',
      title: `${res.order.documentNumber} Dispatched`,
      body: `Delivery note ${res.order.dispatchRef} posted stock deduction & COGS.`,
    });
    pushToast({
      variant: 'success',
      category: 'alert',
      title: `${res.order.documentNumber} Dispatched`,
      description: `Delivery note ${res.order.dispatchRef} posted stock deduction & COGS.`,
    });

    const dispatchedIds = new Set(res.order.lines.map((l) => l.itemId).filter(Boolean));
    const lowStockHit = res.nextState.catalogue.find(
      (item) =>
        item.companyId === companyId &&
        dispatchedIds.has(item.id) &&
        item.trackStock &&
        item.stockOnHand - item.reservedQty <= item.reorderLevel,
    );
    if (lowStockHit) {
      const available = lowStockHit.stockOnHand - lowStockHit.reservedQty;
      pushToast({
        variant: 'warning',
        category: 'alert',
        title: `Low Stock Alert: ${lowStockHit.sku}`,
        description: `${lowStockHit.name} has ${available} ${lowStockHit.unit} available (reorder threshold: ${lowStockHit.reorderLevel}).`,
      });
    }

    return res.order;
  };

  const recordSalesPayment: ErpDataContextValue['recordSalesPayment'] = (input) => {
    const res = txRecordSalesPayment(state, scope, input);
    setState(res.nextState);
    return res.allocation;
  };

  const createCreditNote: ErpDataContextValue['createCreditNote'] = (input) => {
    const res = txCreateCreditNote(state, scope, input);
    setState(res.nextState);
    pushNotification({
      category: 'governance',
      title: `${res.creditNote.creditNumber} Issued`,
      body: `Credit note issued against ${res.creditNote.invoiceNumber}`,
    });
    pushToast({
      variant: 'info',
      category: 'alert',
      title: `${res.creditNote.creditNumber} Issued`,
      description: `Credit note issued against ${res.creditNote.invoiceNumber}.`,
    });
    return res.creditNote;
  };

  const deleteSalesOrder = (id: string) => {
    setState((prev) => {
      const target = prev.salesOrders.find((o) => o.id === id && o.companyId === companyId);
      if (target && (target.ledgerPosted || target.stockPosted)) {
        throw new Error(
          `Cannot delete ${target.documentNumber} after financial or stock posting. Issue a Credit Note or cancel instead.`,
        );
      }
      return {
        ...prev,
        salesOrders: prev.salesOrders.filter((o) => o.id !== id),
      };
    });
  };

  const openPosShift: ErpDataContextValue['openPosShift'] = (input) => {
    const existingOpen = data.posShifts.find((s) => s.status === 'open');
    if (existingOpen) {
      throw new Error(`Register shift ${existingOpen.shiftNumber} is already open. Close it first.`);
    }
    const seqRes = nextSequenceNumber(state, companyId, 'SHIFT', 3);
    const shift: PosShift = {
      id: createUuid(),
      companyId,
      shiftNumber: seqRes.formatted,
      registerName: input.registerName.trim() || 'Main Register',
      cashierName: input.cashierName.trim() || principal.fullName,
      openedAt: nowIso(),
      openingCash: roundMoney(Math.max(0, input.openingCash)),
      cashSalesTotal: 0,
      cardUpiSalesTotal: 0,
      expectedCash: roundMoney(Math.max(0, input.openingCash)),
      status: 'open',
    };
    setState({
      ...seqRes.nextState,
      posShifts: [shift, ...seqRes.nextState.posShifts],
    });
    return shift;
  };

  const closePosShift: ErpDataContextValue['closePosShift'] = (shiftId, countedCash) => {
    const res = txClosePosShift(state, scope, { shiftId, countedCash });
    setState(res.nextState);
    return res.shift;
  };

  const createPurchaseOrder: ErpDataContextValue['createPurchaseOrder'] = (input) => {
    const res = txCreatePurchaseOrder(state, scope, input);
    setState(res.nextState);
    return res.order;
  };

  const approvePurchaseOrder = (orderId: string, approverName: string) => {
    setState((prev) => ({
      ...prev,
      purchaseOrders: prev.purchaseOrders.map((po) =>
        po.id === orderId && po.companyId === companyId
          ? { ...po, status: 'ordered', requiresApproval: false, approvedBy: approverName }
          : po,
      ),
    }));
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

  const addPurchaseRequisition: ErpDataContextValue['addPurchaseRequisition'] = (input) => {
    const seqRes = nextSequenceNumber(state, companyId, 'REQ', 4);
    const created: PurchaseRequisition = {
      ...input,
      id: createUuid(),
      companyId,
      reqNumber: seqRes.formatted,
      status: 'pending',
      createdAt: nowIso(),
    };
    setState({
      ...seqRes.nextState,
      purchaseRequisitions: [created, ...seqRes.nextState.purchaseRequisitions],
    });
    return created;
  };

  const updateRequisitionStatus = (reqId: string, status: PurchaseRequisition['status']) => {
    setState((prev) => ({
      ...prev,
      purchaseRequisitions: prev.purchaseRequisitions.map((r) =>
        r.id === reqId && r.companyId === companyId ? { ...r, status } : r,
      ),
    }));
  };

  const convertRequisitionToPo: ErpDataContextValue['convertRequisitionToPo'] = (
    reqId,
    vendorName,
    expectedDate,
  ) => {
    const res = txConvertRequisitionToPo(state, scope, { reqId, vendorName, expectedDate });
    setState(res.nextState);
    return res.order;
  };

  const addWarehouse: ErpDataContextValue['addWarehouse'] = (input) => {
    const created: Warehouse = {
      ...input,
      id: createUuid(),
      companyId,
      createdAt: nowIso(),
    };
    setState((prev) => ({
      ...prev,
      warehouses: [created, ...prev.warehouses],
    }));
    return created;
  };

  const transferStock: ErpDataContextValue['transferStock'] = (input) => {
    const res = txTransferStockBetweenWarehouses(state, scope, input);
    setState(res.nextState);
    return res.transfer;
  };

  const addShipment: ErpDataContextValue['addShipment'] = (input) => {
    const seqRes = nextSequenceNumber(state, companyId, 'SHP', 4);
    const created: ShipmentRecord = {
      ...input,
      id: createUuid(),
      companyId,
      trackingNumber: seqRes.formatted,
      createdAt: nowIso(),
    };
    setState({
      ...seqRes.nextState,
      shipments: [created, ...seqRes.nextState.shipments],
    });
    return created;
  };

  const updateShipmentStatus = (id: string, status: ShipmentRecord['status']) => {
    setState((prev) => ({
      ...prev,
      shipments: prev.shipments.map((s) =>
        s.id === id && s.companyId === companyId ? { ...s, status } : s,
      ),
    }));
  };

  const adjustStock: ErpDataContextValue['adjustStock'] = (input) => {
    const res = txAdjustStock(state, scope, input);
    setState(res.nextState);
    if (res.item.trackStock && res.item.stockOnHand - res.item.reservedQty <= res.item.reorderLevel) {
      const available = res.item.stockOnHand - res.item.reservedQty;
      pushToast({
        variant: 'warning',
        category: 'alert',
        title: `Low Stock Alert: ${res.item.sku}`,
        description: `${res.item.name} is at ${available} ${res.item.unit} available (reorder level: ${res.item.reorderLevel}).`,
      });
    }
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

  const toggleFiscalPeriod: ErpDataContextValue['toggleFiscalPeriod'] = (periodCode, status) => {
    setState((prev) => setFiscalPeriodStatus(prev, companyId, periodCode, status));
  };

  const registerFixedAsset: ErpDataContextValue['registerFixedAsset'] = (input) => {
    const res = txRegisterFixedAsset(state, scope, input);
    setState(res.nextState);
    return res.asset;
  };

  const runMonthlyDepreciation: ErpDataContextValue['runMonthlyDepreciation'] = (
    periodKey,
    postingDate,
  ) => {
    const res = txRunMonthlyDepreciation(state, scope, { periodKey, postingDate });
    setState(res.nextState);
    return { totalDepreciation: res.totalDepreciation, assetsCount: res.assetsCount };
  };

  const addBudget: ErpDataContextValue['addBudget'] = (input) => {
    const created: BudgetAllocation = {
      ...input,
      id: createUuid(),
      companyId,
      createdAt: nowIso(),
    };
    setState((prev) => ({
      ...prev,
      budgets: [created, ...prev.budgets],
    }));
    return created;
  };

  const deleteBudget = (id: string) => {
    setState((prev) => ({
      ...prev,
      budgets: prev.budgets.filter((b) => !(b.id === id && b.companyId === companyId)),
    }));
  };

  const addExpenseClaim: ErpDataContextValue['addExpenseClaim'] = (input) => {
    const seqRes = nextSequenceNumber(state, companyId, 'EXP', 4);
    const created: ExpenseClaim = {
      ...input,
      id: createUuid(),
      companyId,
      claimNumber: seqRes.formatted,
      status: 'pending',
      createdAt: nowIso(),
    };
    setState({
      ...seqRes.nextState,
      expenseClaims: [created, ...seqRes.nextState.expenseClaims],
    });
    return created;
  };

  const approveExpenseClaim: ErpDataContextValue['approveExpenseClaim'] = (
    claimId,
    payImmediately,
    postingDate,
  ) => {
    const res = txApproveExpenseClaim(state, scope, { claimId, payImmediately, postingDate });
    setState(res.nextState);
    return res.claim;
  };

  const addBankTransaction: ErpDataContextValue['addBankTransaction'] = (input) => {
    const created: BankTransaction = {
      ...input,
      id: createUuid(),
      companyId,
      status: 'unmatched',
      createdAt: nowIso(),
    };
    setState((prev) => ({
      ...prev,
      bankTransactions: [created, ...prev.bankTransactions],
    }));
    return created;
  };

  const reconcileBankTransaction = (txId: string, journalId: string) => {
    setState((prev) => ({
      ...prev,
      bankTransactions: prev.bankTransactions.map((t) =>
        t.id === txId && t.companyId === companyId
          ? { ...t, matchedJournalId: journalId, status: 'reconciled' }
          : t,
      ),
    }));
  };

  const addBom: ErpDataContextValue['addBom'] = (input) => {
    const seqRes = nextSequenceNumber(state, companyId, 'BOM', 4);
    const created: BomDefinition = {
      ...input,
      id: createUuid(),
      companyId,
      bomCode: seqRes.formatted,
      createdAt: nowIso(),
    };
    setState({
      ...seqRes.nextState,
      boms: [created, ...seqRes.nextState.boms],
    });
    return created;
  };

  const createWorkOrder: ErpDataContextValue['createWorkOrder'] = (input) => {
    const seqRes = nextSequenceNumber(state, companyId, 'WO', 4);
    const created: WorkOrder = {
      ...input,
      id: createUuid(),
      companyId,
      woNumber: seqRes.formatted,
      completedQty: 0,
      status: 'planned',
      totalMaterialCost: 0,
      totalConversionCost: 0,
      createdAt: nowIso(),
    };
    setState({
      ...seqRes.nextState,
      workOrders: [created, ...seqRes.nextState.workOrders],
    });
    return created;
  };

  const completeWorkOrder: ErpDataContextValue['completeWorkOrder'] = (
    workOrderId,
    completionDate,
  ) => {
    const res = txCompleteWorkOrder(state, scope, { workOrderId, completionDate });
    setState(res.nextState);
    pushNotification({
      category: 'governance',
      title: `${res.workOrder.woNumber} Completed`,
      body: `Produced ${res.workOrder.targetQty} x ${res.workOrder.finishedSku} and consumed BOM components.`,
    });
    pushToast({
      variant: 'success',
      category: 'alert',
      title: `${res.workOrder.woNumber} Completed`,
      description: `Produced ${res.workOrder.targetQty} x ${res.workOrder.finishedSku}.`,
    });
    return res.workOrder;
  };

  const addQualityInspection: ErpDataContextValue['addQualityInspection'] = (input) => {
    const seqRes = nextSequenceNumber(state, companyId, 'QC', 4);
    const created: QualityInspection = {
      ...input,
      id: createUuid(),
      companyId,
      inspectionNumber: seqRes.formatted,
      createdAt: nowIso(),
    };
    setState({
      ...seqRes.nextState,
      qualityInspections: [created, ...seqRes.nextState.qualityInspections],
    });
    return created;
  };

  const addMaintenanceSchedule: ErpDataContextValue['addMaintenanceSchedule'] = (input) => {
    const created: MaintenanceSchedule = {
      ...input,
      id: createUuid(),
      companyId,
      createdAt: nowIso(),
    };
    setState((prev) => ({
      ...prev,
      maintenanceSchedules: [created, ...prev.maintenanceSchedules],
    }));
    return created;
  };

  const completeMaintenanceSchedule = (id: string) => {
    setState((prev) => ({
      ...prev,
      maintenanceSchedules: prev.maintenanceSchedules.map((m) =>
        m.id === id && m.companyId === companyId ? { ...m, status: 'completed' } : m,
      ),
    }));
  };

  const addEmployee: ErpDataContextValue['addEmployee'] = (input) => {
    const created: EmployeeRecord = {
      ...input,
      id: createUuid(),
      companyId,
      branchId: activeBranchId,
      basicSalary: input.basicSalary ?? roundMoney(input.monthlySalary * 0.7),
      allowances: input.allowances ?? roundMoney(input.monthlySalary * 0.3),
      deductions: input.deductions ?? 0,
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
    pushToast({
      variant: 'success',
      category: 'alert',
      title: `Payroll Posted (${res.payrollRun.periodKey})`,
      description: `Balanced journal posted for ${res.payrollRun.employeeCount} active employee(s).`,
    });
    return res.payrollRun;
  };

  const addLeaveRequest: ErpDataContextValue['addLeaveRequest'] = (input) => {
    const created: LeaveRequest = {
      ...input,
      id: createUuid(),
      companyId,
      status: 'pending',
      createdAt: nowIso(),
    };
    setState((prev) => ({
      ...prev,
      leaveRequests: [created, ...prev.leaveRequests],
    }));
    return created;
  };

  const updateLeaveStatus = (id: string, status: LeaveRequest['status']) => {
    setState((prev) => ({
      ...prev,
      leaveRequests: prev.leaveRequests.map((l) =>
        l.id === id && l.companyId === companyId ? { ...l, status } : l,
      ),
    }));
  };

  const addAttendanceLog: ErpDataContextValue['addAttendanceLog'] = (input) => {
    const created: AttendanceLog = {
      ...input,
      id: createUuid(),
      companyId,
      createdAt: nowIso(),
    };
    setState((prev) => ({
      ...prev,
      attendanceLogs: [created, ...prev.attendanceLogs],
    }));
    return created;
  };

  const addJobOpening: ErpDataContextValue['addJobOpening'] = (input) => {
    const created: JobOpening = {
      ...input,
      id: createUuid(),
      companyId,
      createdAt: nowIso(),
    };
    setState((prev) => ({
      ...prev,
      jobOpenings: [created, ...prev.jobOpenings],
    }));
    return created;
  };

  const addCandidate: ErpDataContextValue['addCandidate'] = (input) => {
    const created: Candidate = {
      ...input,
      id: createUuid(),
      companyId,
      createdAt: nowIso(),
    };
    setState((prev) => ({
      ...prev,
      candidates: [created, ...prev.candidates],
    }));
    return created;
  };

  const updateCandidateStage = (id: string, stage: Candidate['stage']) => {
    setState((prev) => ({
      ...prev,
      candidates: prev.candidates.map((c) =>
        c.id === id && c.companyId === companyId ? { ...c, stage } : c,
      ),
    }));
  };

  const hireCandidate: ErpDataContextValue['hireCandidate'] = (
    candidateId,
    joinedDate,
    monthlySalary,
  ) => {
    const res = txHireCandidateToEmployee(state, scope, {
      candidateId,
      joinedDate,
      monthlySalary,
    });
    setState(res.nextState);
    return res.employee;
  };

  const addPerformanceGoal: ErpDataContextValue['addPerformanceGoal'] = (input) => {
    const created: PerformanceGoal = {
      ...input,
      id: createUuid(),
      companyId,
      createdAt: nowIso(),
    };
    setState((prev) => ({
      ...prev,
      performanceGoals: [created, ...prev.performanceGoals],
    }));
    return created;
  };

  const updatePerformanceProgress = (id: string, progressPct: number) => {
    const clamped = Math.max(0, Math.min(100, progressPct));
    setState((prev) => ({
      ...prev,
      performanceGoals: prev.performanceGoals.map((g) =>
        g.id === id && g.companyId === companyId
          ? { ...g, progressPct: clamped, status: clamped >= 100 ? 'completed' : g.status }
          : g,
      ),
    }));
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

  const addTimesheet: ErpDataContextValue['addTimesheet'] = (input) => {
    const created: TimesheetEntry = {
      ...input,
      id: createUuid(),
      companyId,
      billed: false,
      createdAt: nowIso(),
    };
    setState((prev) => ({
      ...prev,
      timesheets: [created, ...prev.timesheets],
    }));
    return created;
  };

  const markTimesheetBilled = (id: string) => {
    setState((prev) => ({
      ...prev,
      timesheets: prev.timesheets.map((t) =>
        t.id === id && t.companyId === companyId ? { ...t, billed: true } : t,
      ),
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

  const addKbArticle: ErpDataContextValue['addKbArticle'] = (input) => {
    const created: KbArticle = {
      ...input,
      id: createUuid(),
      companyId,
      createdAt: nowIso(),
    };
    setState((prev) => ({
      ...prev,
      kbArticles: [created, ...prev.kbArticles],
    }));
    return created;
  };

  const addDocument: ErpDataContextValue['addDocument'] = (input) => {
    const created: DocumentRecord = {
      ...input,
      id: createUuid(),
      companyId,
      version: input.version ?? 1,
      createdAt: nowIso(),
    };
    setState((prev) => ({
      ...prev,
      documents: [created, ...prev.documents],
    }));
    return created;
  };

  const signDocument = (id: string, signerName: string) => {
    setState((prev) => ({
      ...prev,
      documents: prev.documents.map((d) =>
        d.id === id && d.companyId === companyId
          ? { ...d, signedBy: signerName.trim() || principal.fullName, signedAt: nowIso() }
          : d,
      ),
    }));
  };

  const bumpDocumentVersion = (id: string) => {
    setState((prev) => ({
      ...prev,
      documents: prev.documents.map((d) =>
        d.id === id && d.companyId === companyId
          ? { ...d, version: (d.version ?? 1) + 1 }
          : d,
      ),
    }));
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

  const addApprovalRule: ErpDataContextValue['addApprovalRule'] = (input) => {
    const created: ApprovalRule = {
      ...input,
      id: createUuid(),
      companyId,
      createdAt: nowIso(),
    };
    setState((prev) => ({
      ...prev,
      approvalRules: [created, ...prev.approvalRules],
    }));
    return created;
  };

  const toggleApprovalRule = (id: string) => {
    setState((prev) => ({
      ...prev,
      approvalRules: prev.approvalRules.map((r) =>
        r.id === id && r.companyId === companyId ? { ...r, active: !r.active } : r,
      ),
    }));
  };

  const addCustomField: ErpDataContextValue['addCustomField'] = (input) => {
    const created: CustomFieldDefinition = {
      ...input,
      id: createUuid(),
      companyId,
      createdAt: nowIso(),
    };
    setState((prev) => ({
      ...prev,
      customFields: [created, ...prev.customFields],
    }));
    return created;
  };

  const deleteCustomField = (id: string) => {
    setState((prev) => ({
      ...prev,
      customFields: prev.customFields.filter((f) => !(f.id === id && f.companyId === companyId)),
    }));
  };

  const addBiReport: ErpDataContextValue['addBiReport'] = (input) => {
    const created: BiSavedReport = {
      ...input,
      id: createUuid(),
      companyId,
      createdAt: nowIso(),
    };
    setState((prev) => ({
      ...prev,
      biReports: [created, ...prev.biReports],
    }));
    return created;
  };

  const deleteBiReport = (id: string) => {
    setState((prev) => ({
      ...prev,
      biReports: prev.biReports.filter((r) => !(r.id === id && r.companyId === companyId)),
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
      const keepOther = <T extends { companyId: string }>(arr: T[]) =>
        arr.filter((x) => x.companyId !== companyId);
      const cleaned: ErpDatabaseState = {
        ...prev,
        catalogue: keepOther(prev.catalogue),
        contacts: keepOther(prev.contacts),
        salesOrders: keepOther(prev.salesOrders),
        creditNotes: keepOther(prev.creditNotes),
        posShifts: keepOther(prev.posShifts),
        purchaseOrders: keepOther(prev.purchaseOrders),
        purchaseRequisitions: keepOther(prev.purchaseRequisitions),
        warehouses: keepOther(prev.warehouses),
        stockTransfers: keepOther(prev.stockTransfers),
        shipments: keepOther(prev.shipments),
        stockMovements: keepOther(prev.stockMovements),
        inventoryLots: keepOther(prev.inventoryLots),
        stockReservations: keepOther(prev.stockReservations),
        accounts: keepOther(prev.accounts),
        fiscalPeriods: keepOther(prev.fiscalPeriods),
        journals: keepOther(prev.journals),
        paymentAllocations: keepOther(prev.paymentAllocations),
        ledgerEntries: keepOther(prev.ledgerEntries),
        fixedAssets: keepOther(prev.fixedAssets),
        budgets: keepOther(prev.budgets),
        expenseClaims: keepOther(prev.expenseClaims),
        bankTransactions: keepOther(prev.bankTransactions),
        boms: keepOther(prev.boms),
        workOrders: keepOther(prev.workOrders),
        qualityInspections: keepOther(prev.qualityInspections),
        maintenanceSchedules: keepOther(prev.maintenanceSchedules),
        employees: keepOther(prev.employees),
        payrollRuns: keepOther(prev.payrollRuns),
        leaveRequests: keepOther(prev.leaveRequests),
        attendanceLogs: keepOther(prev.attendanceLogs),
        jobOpenings: keepOther(prev.jobOpenings),
        candidates: keepOther(prev.candidates),
        performanceGoals: keepOther(prev.performanceGoals),
        projectTasks: keepOther(prev.projectTasks),
        timesheets: keepOther(prev.timesheets),
        supportTickets: keepOther(prev.supportTickets),
        kbArticles: keepOther(prev.kbArticles),
        documents: keepOther(prev.documents),
        campaigns: keepOther(prev.campaigns),
        approvalRules: keepOther(prev.approvalRules),
        customFields: keepOther(prev.customFields),
        biReports: keepOther(prev.biReports),
        industryRecords: keepOther(prev.industryRecords),
        auditLogs: keepOther(prev.auditLogs),
      };
      return ensureCompanyAccounts(cleaned, companyId).nextState;
    });
  };

  const syncState: ErpSyncState = useMemo(
    () => ({
      status: syncStatus,
      isOnline,
      pendingCount,
      lastSyncedAt,
      lastSyncError,
      hydratedFromIndexedDb,
      triggerSync: runSyncFlush,
    }),
    [
      syncStatus,
      isOnline,
      pendingCount,
      lastSyncedAt,
      lastSyncError,
      hydratedFromIndexedDb,
      runSyncFlush,
    ],
  );

  return (
    <ErpDataContext.Provider
      value={{
        storageMode: dexieRepo ? 'indexeddb-dexie' : defaultDevStorageAdapter.mode,
        syncState,
        data,
        trialBalance,
        financialStatements,
        agingReport,
        metrics,
        addCatalogueItem,
        deleteCatalogueItem,
        addContact,
        updateContactStage,
        addContactActivity,
        updateContactScore,
        deleteContact,
        createSalesOrder,
        updateSalesStatus,
        dispatchSalesOrder,
        recordSalesPayment,
        createCreditNote,
        deleteSalesOrder,
        openPosShift,
        closePosShift,
        createPurchaseOrder,
        approvePurchaseOrder,
        receivePurchaseOrder,
        recordPurchasePayment,
        deletePurchaseOrder,
        addPurchaseRequisition,
        updateRequisitionStatus,
        convertRequisitionToPo,
        addWarehouse,
        transferStock,
        addShipment,
        updateShipmentStatus,
        adjustStock,
        postBalancedJournal,
        reverseJournal,
        toggleFiscalPeriod,
        registerFixedAsset,
        runMonthlyDepreciation,
        addBudget,
        deleteBudget,
        addExpenseClaim,
        approveExpenseClaim,
        addBankTransaction,
        reconcileBankTransaction,
        addBom,
        createWorkOrder,
        completeWorkOrder,
        addQualityInspection,
        addMaintenanceSchedule,
        completeMaintenanceSchedule,
        addEmployee,
        toggleEmployeeStatus,
        deleteEmployee,
        runMonthlyPayroll,
        addLeaveRequest,
        updateLeaveStatus,
        addAttendanceLog,
        addJobOpening,
        addCandidate,
        updateCandidateStage,
        hireCandidate,
        addPerformanceGoal,
        updatePerformanceProgress,
        addProjectTask,
        updateProjectTaskStatus,
        deleteProjectTask,
        addTimesheet,
        markTimesheetBilled,
        addSupportTicket,
        updateSupportTicketStatus,
        deleteSupportTicket,
        addKbArticle,
        addDocument,
        signDocument,
        bumpDocumentVersion,
        deleteDocument,
        addCampaign,
        deleteCampaign,
        addApprovalRule,
        toggleApprovalRule,
        addCustomField,
        deleteCustomField,
        addBiReport,
        deleteBiReport,
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
