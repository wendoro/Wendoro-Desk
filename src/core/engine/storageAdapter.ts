import { ErpDatabaseState } from '@/src/core/store/erpTypes';
import { EMPTY_ERP_DATABASE_STATE } from './erpTransactions';

export type PersistenceAdapterMode = 'indexeddb-dexie' | 'localstorage-dev' | 'postgresql-api';

export interface ErpStorageAdapter {
  readonly mode: PersistenceAdapterMode;
  readonly isProductionSourceOfTruth: boolean;
  loadState(): ErpDatabaseState;
  saveState(state: ErpDatabaseState): void;
}

const ERP_STORAGE_KEY = 'wendoro.erp.data.v2';
const LEGACY_STORAGE_KEY = 'wendoro.erp.data.v1';

export function normalizeLoadedState(parsed: Partial<ErpDatabaseState>): ErpDatabaseState {
  return {
    schemaVersion: typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : 3,
    sequences: parsed.sequences && typeof parsed.sequences === 'object' ? parsed.sequences : {},
    catalogue: Array.isArray(parsed.catalogue)
      ? parsed.catalogue.map((i) => ({
          ...i,
          reservedQty: typeof i.reservedQty === 'number' ? i.reservedQty : 0,
          inventoryAssetValue:
            typeof i.inventoryAssetValue === 'number'
              ? i.inventoryAssetValue
              : Number(((i.stockOnHand ?? 0) * (i.costPrice ?? 0)).toFixed(2)),
          version: typeof i.version === 'number' ? i.version : 1,
        }))
      : [],
    contacts: Array.isArray(parsed.contacts) ? parsed.contacts : [],
    salesOrders: Array.isArray(parsed.salesOrders)
      ? parsed.salesOrders.map((o) => ({
          ...o,
          fulfillmentStatus: o.fulfillmentStatus ?? (o.stockPosted ? 'dispatched' : 'pending'),
          amountPaid:
            typeof o.amountPaid === 'number'
              ? o.amountPaid
              : o.status === 'paid'
                ? o.grandTotal
                : 0,
        }))
      : [],
    creditNotes: Array.isArray(parsed.creditNotes) ? parsed.creditNotes : [],
    posShifts: Array.isArray(parsed.posShifts) ? parsed.posShifts : [],
    purchaseOrders: Array.isArray(parsed.purchaseOrders)
      ? parsed.purchaseOrders.map((p) => ({
          ...p,
          amountPaid: typeof p.amountPaid === 'number' ? p.amountPaid : 0,
        }))
      : [],
    purchaseRequisitions: Array.isArray(parsed.purchaseRequisitions) ? parsed.purchaseRequisitions : [],
    warehouses: Array.isArray(parsed.warehouses) ? parsed.warehouses : [],
    stockTransfers: Array.isArray(parsed.stockTransfers) ? parsed.stockTransfers : [],
    shipments: Array.isArray(parsed.shipments) ? parsed.shipments : [],
    stockMovements: Array.isArray(parsed.stockMovements) ? parsed.stockMovements : [],
    inventoryLots: Array.isArray(parsed.inventoryLots) ? parsed.inventoryLots : [],
    stockReservations: Array.isArray(parsed.stockReservations) ? parsed.stockReservations : [],
    accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
    fiscalPeriods: Array.isArray(parsed.fiscalPeriods) ? parsed.fiscalPeriods : [],
    journals: Array.isArray(parsed.journals) ? parsed.journals : [],
    paymentAllocations: Array.isArray(parsed.paymentAllocations) ? parsed.paymentAllocations : [],
    ledgerEntries: Array.isArray(parsed.ledgerEntries) ? parsed.ledgerEntries : [],
    fixedAssets: Array.isArray(parsed.fixedAssets) ? parsed.fixedAssets : [],
    budgets: Array.isArray(parsed.budgets) ? parsed.budgets : [],
    expenseClaims: Array.isArray(parsed.expenseClaims) ? parsed.expenseClaims : [],
    bankTransactions: Array.isArray(parsed.bankTransactions) ? parsed.bankTransactions : [],
    boms: Array.isArray(parsed.boms) ? parsed.boms : [],
    workOrders: Array.isArray(parsed.workOrders) ? parsed.workOrders : [],
    qualityInspections: Array.isArray(parsed.qualityInspections) ? parsed.qualityInspections : [],
    maintenanceSchedules: Array.isArray(parsed.maintenanceSchedules) ? parsed.maintenanceSchedules : [],
    employees: Array.isArray(parsed.employees) ? parsed.employees : [],
    payrollRuns: Array.isArray(parsed.payrollRuns) ? parsed.payrollRuns : [],
    leaveRequests: Array.isArray(parsed.leaveRequests) ? parsed.leaveRequests : [],
    attendanceLogs: Array.isArray(parsed.attendanceLogs) ? parsed.attendanceLogs : [],
    jobOpenings: Array.isArray(parsed.jobOpenings) ? parsed.jobOpenings : [],
    candidates: Array.isArray(parsed.candidates) ? parsed.candidates : [],
    performanceGoals: Array.isArray(parsed.performanceGoals) ? parsed.performanceGoals : [],
    projectTasks: Array.isArray(parsed.projectTasks) ? parsed.projectTasks : [],
    timesheets: Array.isArray(parsed.timesheets) ? parsed.timesheets : [],
    supportTickets: Array.isArray(parsed.supportTickets) ? parsed.supportTickets : [],
    kbArticles: Array.isArray(parsed.kbArticles) ? parsed.kbArticles : [],
    documents: Array.isArray(parsed.documents) ? parsed.documents : [],
    campaigns: Array.isArray(parsed.campaigns) ? parsed.campaigns : [],
    approvalRules: Array.isArray(parsed.approvalRules) ? parsed.approvalRules : [],
    customFields: Array.isArray(parsed.customFields) ? parsed.customFields : [],
    biReports: Array.isArray(parsed.biReports) ? parsed.biReports : [],
    industryRecords: Array.isArray(parsed.industryRecords) ? parsed.industryRecords : [],
    auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
  };
}

/**
 * Optional browser-local development & offline evaluation adapter.
 * PostgreSQL (`0000_core_foundation_rls.sql` + `0001_erp_operations_accounting_inventory.sql`)
 * is the authoritative production source of truth.
 */
export class LocalStorageDevAdapter implements ErpStorageAdapter {
  readonly mode = 'localstorage-dev' as const;
  readonly isProductionSourceOfTruth = false;

  loadState(): ErpDatabaseState {
    if (typeof window === 'undefined') return EMPTY_ERP_DATABASE_STATE;
    try {
      const raw =
        window.localStorage.getItem(ERP_STORAGE_KEY) ??
        window.localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!raw) return EMPTY_ERP_DATABASE_STATE;
      const parsed = JSON.parse(raw) as Partial<ErpDatabaseState>;
      return normalizeLoadedState(parsed);
    } catch {
      return EMPTY_ERP_DATABASE_STATE;
    }
  }

  saveState(state: ErpDatabaseState): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(ERP_STORAGE_KEY, JSON.stringify(state));
  }
}

export const defaultDevStorageAdapter = new LocalStorageDevAdapter();
