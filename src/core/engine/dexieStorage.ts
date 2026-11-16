import Dexie, { type Table } from 'dexie';
import type {
  CatalogueItem,
  ChartAccount,
  CrmContact,
  ErpDatabaseState,
  FiscalPeriod,
  JournalEntry,
  LedgerEntry,
  PaymentAllocation,
  PurchaseOrder,
  SalesOrder,
  StockMovement,
} from '@/src/core/store/erpTypes';
import { EMPTY_ERP_DATABASE_STATE } from './erpTransactions';
import { defaultDevStorageAdapter, normalizeLoadedState } from './storageAdapter';

export interface DexieMetaRecord {
  key: 'state_meta';
  schemaVersion: number;
  sequences: Record<string, number>;
  updatedAt: string;
  lastSyncedAt: string | null;
}

export interface CompanyCollectionRecord {
  id: string; // `${companyId}:${collectionName}`
  companyId: string;
  collectionName: string;
  records: Array<{ companyId: string } & Record<string, unknown>>;
  updatedAt: string;
}

export type OutboxItemStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export interface SyncOutboxRecord {
  seq?: number;
  id: string;
  companyId: string;
  changeSummary: string;
  recordCount: number;
  checksum: string;
  stateSnapshotJson: string;
  status: OutboxItemStatus;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  syncedAt: string | null;
}

export type SyncStatusMode = 'synced' | 'syncing' | 'offline_queued' | 'pending' | 'error';

export interface SyncTransportPayload {
  outboxId: string;
  companyId: string;
  changeSummary: string;
  recordCount: number;
  checksum: string;
  stateSnapshotJson: string;
  createdAt: string;
}

export interface SyncTransport {
  checkReachable(): Promise<boolean>;
  pushCompanySync(
    payload: SyncTransportPayload,
  ): Promise<{ ok: true; serverTimestamp: string } | { ok: false; retryable: boolean; error: string }>;
}

export interface SyncFlushResult {
  attempted: boolean;
  skippedOffline: boolean;
  syncedCount: number;
  remainingCount: number;
  lastSyncedAt: string | null;
  error: string | null;
}

const SECONDARY_COLLECTION_KEYS = [
  'creditNotes',
  'posShifts',
  'purchaseRequisitions',
  'warehouses',
  'stockTransfers',
  'shipments',
  'inventoryLots',
  'stockReservations',
  'fixedAssets',
  'budgets',
  'expenseClaims',
  'bankTransactions',
  'boms',
  'workOrders',
  'qualityInspections',
  'maintenanceSchedules',
  'employees',
  'payrollRuns',
  'leaveRequests',
  'attendanceLogs',
  'jobOpenings',
  'candidates',
  'performanceGoals',
  'projectTasks',
  'timesheets',
  'supportTickets',
  'kbArticles',
  'documents',
  'campaigns',
  'approvalRules',
  'customFields',
  'biReports',
  'industryRecords',
  'auditLogs',
] as const;

type SecondaryCollectionKey = (typeof SECONDARY_COLLECTION_KEYS)[number];

export class WendoroErpDexieDb extends Dexie {
  meta!: Table<DexieMetaRecord, string>;
  catalogue!: Table<CatalogueItem, string>;
  contacts!: Table<CrmContact, string>;
  salesOrders!: Table<SalesOrder, string>;
  purchaseOrders!: Table<PurchaseOrder, string>;
  stockMovements!: Table<StockMovement, string>;
  accounts!: Table<ChartAccount, string>;
  fiscalPeriods!: Table<FiscalPeriod, string>;
  journals!: Table<JournalEntry, string>;
  ledgerEntries!: Table<LedgerEntry, string>;
  paymentAllocations!: Table<PaymentAllocation, string>;
  companyCollections!: Table<CompanyCollectionRecord, string>;
  syncOutbox!: Table<SyncOutboxRecord, number>;

  constructor(
    dbName = 'wendoro_erp_offline_db',
    idbOptions?: { indexedDB: IDBFactory; IDBKeyRange: typeof IDBKeyRange },
  ) {
    super(dbName, idbOptions);
    this.version(1).stores({
      meta: 'key',
      catalogue: 'id, companyId, sku, category, trackStock, createdAt',
      contacts: 'id, companyId, type, stage, email, createdAt',
      salesOrders: 'id, companyId, documentType, status, customerId, issueDate, createdAt',
      purchaseOrders: 'id, companyId, status, vendorId, orderDate, createdAt',
      stockMovements: 'id, companyId, itemId, movementType, createdAt',
      accounts: 'id, companyId, code, category',
      fiscalPeriods: 'id, companyId, code, status',
      journals: 'id, companyId, journalNumber, date, status, createdAt',
      ledgerEntries: 'id, companyId, entryType, date, accountName, journalId, createdAt',
      paymentAllocations: 'id, companyId, orderId, direction, paymentDate, createdAt',
      companyCollections: 'id, [companyId+collectionName], companyId, collectionName, updatedAt',
      syncOutbox: '++seq, id, companyId, status, createdAt, syncedAt',
    });
  }
}

function computeFastChecksum(text: string): string {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function countCompanyRecords(state: ErpDatabaseState, companyId: string): number {
  let total = 0;
  const countArr = (arr: Array<{ companyId: string }>) => {
    for (const item of arr) {
      if (item.companyId === companyId) total += 1;
    }
  };
  countArr(state.catalogue);
  countArr(state.contacts);
  countArr(state.salesOrders);
  countArr(state.purchaseOrders);
  countArr(state.stockMovements);
  countArr(state.accounts);
  countArr(state.fiscalPeriods);
  countArr(state.journals);
  countArr(state.ledgerEntries);
  countArr(state.paymentAllocations);
  for (const key of SECONDARY_COLLECTION_KEYS) {
    countArr(state[key] as Array<{ companyId: string }>);
  }
  return total;
}

function buildCompanySyncSnapshot(state: ErpDatabaseState, companyId: string): string {
  const byCo = <T extends { companyId: string }>(arr: T[]) =>
    arr.filter((item) => item.companyId === companyId);

  const scoped: Record<string, unknown> = {
    schemaVersion: state.schemaVersion,
    companyId,
    catalogue: byCo(state.catalogue),
    contacts: byCo(state.contacts),
    salesOrders: byCo(state.salesOrders),
    purchaseOrders: byCo(state.purchaseOrders),
    stockMovements: byCo(state.stockMovements),
    accounts: byCo(state.accounts),
    fiscalPeriods: byCo(state.fiscalPeriods),
    journals: byCo(state.journals),
    ledgerEntries: byCo(state.ledgerEntries),
    paymentAllocations: byCo(state.paymentAllocations),
  };

  for (const key of SECONDARY_COLLECTION_KEYS) {
    scoped[key] = byCo(state[key] as Array<{ companyId: string }>);
  }

  return JSON.stringify(scoped);
}

function createMutationId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `outbox_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export class DexieOfflineRepository {
  readonly db: WendoroErpDexieDb;
  private syncInFlight: Promise<SyncFlushResult> | null = null;

  constructor(
    dbName = 'wendoro_erp_offline_db',
    idbOptions?: { indexedDB: IDBFactory; IDBKeyRange: typeof IDBKeyRange },
  ) {
    this.db = new WendoroErpDexieDb(dbName, idbOptions);
  }

  private get allTables() {
    return [
      this.db.meta,
      this.db.catalogue,
      this.db.contacts,
      this.db.salesOrders,
      this.db.purchaseOrders,
      this.db.stockMovements,
      this.db.accounts,
      this.db.fiscalPeriods,
      this.db.journals,
      this.db.ledgerEntries,
      this.db.paymentAllocations,
      this.db.companyCollections,
      this.db.syncOutbox,
    ];
  }

  async hydrateState(options?: {
    fallbackLegacyState?: ErpDatabaseState;
  }): Promise<{
    state: ErpDatabaseState;
    migratedFromLegacy: boolean;
    pendingOutboxCount: number;
    lastSyncedAt: string | null;
  }> {
    const [
      metaRow,
      catalogue,
      contacts,
      salesOrders,
      purchaseOrders,
      stockMovements,
      accounts,
      fiscalPeriods,
      journals,
      ledgerEntries,
      paymentAllocations,
      collectionRows,
      outboxRows,
    ] = await this.db.transaction('r', this.allTables, async () => {
      return Promise.all([
        this.db.meta.get('state_meta'),
        this.db.catalogue.toArray(),
        this.db.contacts.toArray(),
        this.db.salesOrders.toArray(),
        this.db.purchaseOrders.toArray(),
        this.db.stockMovements.toArray(),
        this.db.accounts.toArray(),
        this.db.fiscalPeriods.toArray(),
        this.db.journals.toArray(),
        this.db.ledgerEntries.toArray(),
        this.db.paymentAllocations.toArray(),
        this.db.companyCollections.toArray(),
        this.db.syncOutbox.where('status').anyOf(['pending', 'syncing', 'failed']).toArray(),
      ]);
    });

    if (!metaRow) {
      const legacy = options?.fallbackLegacyState ?? defaultDevStorageAdapter.loadState();
      const hasLegacyRecords =
        legacy.catalogue.length > 0 ||
        legacy.contacts.length > 0 ||
        legacy.salesOrders.length > 0 ||
        legacy.journals.length > 0 ||
        legacy.accounts.length > 0;

      await this.persistState(legacy, { queueSync: false });
      return {
        state: legacy,
        migratedFromLegacy: hasLegacyRecords,
        pendingOutboxCount: outboxRows.length,
        lastSyncedAt: null,
      };
    }

    const partial: Partial<ErpDatabaseState> = {
      schemaVersion: metaRow.schemaVersion,
      sequences: metaRow.sequences,
      catalogue,
      contacts,
      salesOrders,
      purchaseOrders,
      stockMovements,
      accounts,
      fiscalPeriods,
      journals,
      ledgerEntries,
      paymentAllocations,
    };

    const groupedSecondary = new Map<SecondaryCollectionKey, unknown[]>();
    for (const key of SECONDARY_COLLECTION_KEYS) {
      groupedSecondary.set(key, []);
    }
    for (const row of collectionRows) {
      const key = row.collectionName as SecondaryCollectionKey;
      const bucket = groupedSecondary.get(key);
      if (bucket && Array.isArray(row.records)) {
        bucket.push(...row.records);
      }
    }
    for (const [key, list] of groupedSecondary.entries()) {
      (partial as Record<string, unknown>)[key] = list;
    }

    return {
      state: normalizeLoadedState(partial),
      migratedFromLegacy: false,
      pendingOutboxCount: outboxRows.length,
      lastSyncedAt: metaRow.lastSyncedAt ?? null,
    };
  }

  async persistState(
    state: ErpDatabaseState,
    options?: {
      queueSync?: boolean;
      activeCompanyId?: string;
      changeSummary?: string;
    },
  ): Promise<{ pendingCount: number }> {
    const now = new Date().toISOString();

    const secondaryRows: CompanyCollectionRecord[] = [];
    for (const key of SECONDARY_COLLECTION_KEYS) {
      const items = state[key] as unknown as Array<{ companyId: string } & Record<string, unknown>>;
      const byCompany = new Map<string, Array<{ companyId: string } & Record<string, unknown>>>();
      for (const item of items) {
        const list = byCompany.get(item.companyId) ?? [];
        list.push(item);
        byCompany.set(item.companyId, list);
      }
      for (const [companyId, records] of byCompany.entries()) {
        secondaryRows.push({
          id: `${companyId}:${key}`,
          companyId,
          collectionName: key,
          records,
          updatedAt: now,
        });
      }
    }

    const pendingCount = await this.db.transaction('rw', this.allTables, async () => {
      const existingMeta = await this.db.meta.get('state_meta');

      await Promise.all([
        this.db.catalogue.clear(),
        this.db.contacts.clear(),
        this.db.salesOrders.clear(),
        this.db.purchaseOrders.clear(),
        this.db.stockMovements.clear(),
        this.db.accounts.clear(),
        this.db.fiscalPeriods.clear(),
        this.db.journals.clear(),
        this.db.ledgerEntries.clear(),
        this.db.paymentAllocations.clear(),
        this.db.companyCollections.clear(),
      ]);

      await Promise.all([
        this.db.meta.put({
          key: 'state_meta',
          schemaVersion: state.schemaVersion,
          sequences: state.sequences,
          updatedAt: now,
          lastSyncedAt: existingMeta?.lastSyncedAt ?? null,
        }),
        state.catalogue.length > 0 ? this.db.catalogue.bulkPut(state.catalogue) : Promise.resolve(),
        state.contacts.length > 0 ? this.db.contacts.bulkPut(state.contacts) : Promise.resolve(),
        state.salesOrders.length > 0 ? this.db.salesOrders.bulkPut(state.salesOrders) : Promise.resolve(),
        state.purchaseOrders.length > 0
          ? this.db.purchaseOrders.bulkPut(state.purchaseOrders)
          : Promise.resolve(),
        state.stockMovements.length > 0
          ? this.db.stockMovements.bulkPut(state.stockMovements)
          : Promise.resolve(),
        state.accounts.length > 0 ? this.db.accounts.bulkPut(state.accounts) : Promise.resolve(),
        state.fiscalPeriods.length > 0
          ? this.db.fiscalPeriods.bulkPut(state.fiscalPeriods)
          : Promise.resolve(),
        state.journals.length > 0 ? this.db.journals.bulkPut(state.journals) : Promise.resolve(),
        state.ledgerEntries.length > 0
          ? this.db.ledgerEntries.bulkPut(state.ledgerEntries)
          : Promise.resolve(),
        state.paymentAllocations.length > 0
          ? this.db.paymentAllocations.bulkPut(state.paymentAllocations)
          : Promise.resolve(),
        secondaryRows.length > 0
          ? this.db.companyCollections.bulkPut(secondaryRows)
          : Promise.resolve(),
      ]);

      if (options?.queueSync && options.activeCompanyId) {
        const companyId = options.activeCompanyId;
        const snapshotJson = buildCompanySyncSnapshot(state, companyId);
        const checksum = computeFastChecksum(snapshotJson);
        const recordCount = countCompanyRecords(state, companyId);
        const summary = options.changeSummary || 'Local ERP mutation';

        const existingPending = await this.db.syncOutbox
          .where('companyId')
          .equals(companyId)
          .and((row) => row.status === 'pending' || row.status === 'failed')
          .first();

        if (existingPending && existingPending.seq !== undefined) {
          await this.db.syncOutbox.update(existingPending.seq, {
            changeSummary: summary,
            recordCount,
            checksum,
            stateSnapshotJson: snapshotJson,
            status: 'pending',
            lastError: null,
            updatedAt: now,
          });
        } else {
          await this.db.syncOutbox.add({
            id: createMutationId(),
            companyId,
            changeSummary: summary,
            recordCount,
            checksum,
            stateSnapshotJson: snapshotJson,
            status: 'pending',
            attempts: 0,
            lastError: null,
            createdAt: now,
            updatedAt: now,
            syncedAt: null,
          });
        }
      }

      return this.db.syncOutbox.where('status').anyOf(['pending', 'syncing', 'failed']).count();
    });

    return { pendingCount };
  }

  async getSyncSummary(): Promise<{
    pendingCount: number;
    lastSyncedAt: string | null;
    outbox: SyncOutboxRecord[];
  }> {
    const [meta, pendingCount, outbox] = await Promise.all([
      this.db.meta.get('state_meta'),
      this.db.syncOutbox.where('status').anyOf(['pending', 'syncing', 'failed']).count(),
      this.db.syncOutbox.orderBy('seq').reverse().limit(20).toArray(),
    ]);

    return {
      pendingCount,
      lastSyncedAt: meta?.lastSyncedAt ?? null,
      outbox,
    };
  }

  async syncPendingChanges(
    transport: SyncTransport,
    isOnline: () => boolean,
  ): Promise<SyncFlushResult> {
    if (this.syncInFlight) {
      return this.syncInFlight;
    }

    const runner = async (): Promise<SyncFlushResult> => {
      const pendingItems = await this.db.syncOutbox
        .where('status')
        .anyOf(['pending', 'failed'])
        .sortBy('seq');

      const meta = await this.db.meta.get('state_meta');
      const currentLastSynced = meta?.lastSyncedAt ?? null;

      if (pendingItems.length === 0) {
        return {
          attempted: false,
          skippedOffline: false,
          syncedCount: 0,
          remainingCount: 0,
          lastSyncedAt: currentLastSynced,
          error: null,
        };
      }

      // Strict offline gate: never attempt remote sync when connection is unavailable
      if (!isOnline()) {
        return {
          attempted: false,
          skippedOffline: true,
          syncedCount: 0,
          remainingCount: pendingItems.length,
          lastSyncedAt: currentLastSynced,
          error: null,
        };
      }

      let reachable = false;
      try {
        reachable = await transport.checkReachable();
      } catch {
        reachable = false;
      }

      if (!reachable || !isOnline()) {
        return {
          attempted: true,
          skippedOffline: true,
          syncedCount: 0,
          remainingCount: pendingItems.length,
          lastSyncedAt: currentLastSynced,
          error: null,
        };
      }

      let syncedCount = 0;
      let latestSyncedAt = currentLastSynced;
      let lastError: string | null = null;

      for (const item of pendingItems) {
        if (!isOnline()) {
          break;
        }
        if (item.seq === undefined) continue;

        await this.db.syncOutbox.update(item.seq, {
          status: 'syncing',
          updatedAt: new Date().toISOString(),
        });

        try {
          const res = await transport.pushCompanySync({
            outboxId: item.id,
            companyId: item.companyId,
            changeSummary: item.changeSummary,
            recordCount: item.recordCount,
            checksum: item.checksum,
            stateSnapshotJson: item.stateSnapshotJson,
            createdAt: item.createdAt,
          });

          if (res.ok) {
            latestSyncedAt = res.serverTimestamp;
            await this.db.transaction('rw', [this.db.syncOutbox, this.db.meta], async () => {
              await this.db.syncOutbox.update(item.seq!, {
                status: 'synced',
                lastError: null,
                syncedAt: res.serverTimestamp,
                updatedAt: res.serverTimestamp,
              });
              const curMeta = await this.db.meta.get('state_meta');
              if (curMeta) {
                await this.db.meta.update('state_meta', { lastSyncedAt: res.serverTimestamp });
              }
            });
            syncedCount += 1;
          } else {
            lastError = res.error;
            await this.db.syncOutbox.update(item.seq, {
              status: res.retryable ? 'pending' : 'failed',
              attempts: item.attempts + 1,
              lastError: res.error,
              updatedAt: new Date().toISOString(),
            });
            break;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Network error during sync';
          lastError = msg;
          await this.db.syncOutbox.update(item.seq, {
            status: 'pending',
            attempts: item.attempts + 1,
            lastError: msg,
            updatedAt: new Date().toISOString(),
          });
          break;
        }
      }

      // Prune older synced history so IndexedDB outbox remains compact
      const syncedRows = await this.db.syncOutbox.where('status').equals('synced').sortBy('seq');
      if (syncedRows.length > 25) {
        const toDelete = syncedRows.slice(0, syncedRows.length - 25).map((r) => r.seq!);
        await this.db.syncOutbox.bulkDelete(toDelete);
      }

      const remainingCount = await this.db.syncOutbox
        .where('status')
        .anyOf(['pending', 'syncing', 'failed'])
        .count();

      return {
        attempted: true,
        skippedOffline: false,
        syncedCount,
        remainingCount,
        lastSyncedAt: latestSyncedAt,
        error: lastError,
      };
    };

    this.syncInFlight = runner().finally(() => {
      this.syncInFlight = null;
    });
    return this.syncInFlight;
  }

  async close() {
    this.db.close();
  }
}

export function createHttpSyncTransport(options?: {
  getServerBaseUrl?: () => string;
  getLicenseKey?: () => string | null;
}): SyncTransport {
  const resolveBase = () => {
    const raw = options?.getServerBaseUrl?.() ?? '';
    return raw && !raw.startsWith('firebase://') ? raw.replace(/\/+$/, '') : '';
  };

  return {
    async checkReachable(): Promise<boolean> {
      if (typeof fetch !== 'function') return false;
      const base = resolveBase();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      try {
        const res = await fetch(`${base}/api/health`, {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal,
        });
        return res.ok;
      } catch {
        return false;
      } finally {
        clearTimeout(timer);
      }
    },

    async pushCompanySync(payload: SyncTransportPayload) {
      const base = resolveBase();
      const licenseKey = options?.getLicenseKey?.();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (licenseKey) {
        headers['X-Wendoro-License-Key'] = licenseKey;
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        const res = await fetch(`${base}/api/erp/${encodeURIComponent(payload.companyId)}/sync`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        const json = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          serverTimestamp?: string;
          message?: string;
        };

        if (res.ok && json.ok) {
          return {
            ok: true as const,
            serverTimestamp: json.serverTimestamp ?? new Date().toISOString(),
          };
        }

        const retryable = res.status >= 500 || res.status === 408 || res.status === 429;
        return {
          ok: false as const,
          retryable,
          error: json.message || `Sync endpoint returned HTTP ${res.status}`,
        };
      } catch (err) {
        return {
          ok: false as const,
          retryable: true,
          error: err instanceof Error ? err.message : 'Sync server unreachable',
        };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

let singletonRepo: DexieOfflineRepository | null = null;

export function getDefaultDexieRepository(): DexieOfflineRepository | null {
  if (typeof indexedDB === 'undefined') return null;
  if (!singletonRepo) {
    singletonRepo = new DexieOfflineRepository();
  }
  return singletonRepo;
}

export function isNavigatorOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

export { EMPTY_ERP_DATABASE_STATE };
