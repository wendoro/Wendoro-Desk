import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
import { BackupPayloadSchema } from '@/src/core/engine/backupSchema';
import { ErpDomainError } from '@/src/core/engine/accountingEngine';

let cachedPool: Pool | null = null;

export function isPostgresConfigured(): boolean {
  const url = process.env.DATABASE_URL;
  return Boolean(url && url.trim().length > 0 && !url.includes('password@host'));
}

export function getPostgresPool(): Pool | null {
  if (!isPostgresConfigured()) return null;
  if (!cachedPool) {
    cachedPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return cachedPool;
}

export function getDrizzleDb() {
  const pool = getPostgresPool();
  if (!pool) return null;
  return drizzle(pool, { schema });
}

export interface PostgresMigrationSummary {
  migratedAt: string;
  companyId: string;
  counts: {
    catalogue: number;
    contacts: number;
    accounts: number;
    fiscalPeriods: number;
    journals: number;
    salesOrders: number;
    purchaseOrders: number;
    stockMovements: number;
    employees: number;
    payrollRuns: number;
  };
}

/**
 * Validates a localStorage JSON backup payload with Zod and migrates it
 * inside an atomic PostgreSQL transaction (`BEGIN` ... `COMMIT`) scoped to
 * `app.current_tenant_id` and `app.current_company_id`.
 * Any failure triggers an automatic `ROLLBACK` leaving zero partial rows.
 */
export interface SqlQueryable {
  query: (text: string, values?: unknown[]) => Promise<unknown>;
}

export async function migrateBackupJsonToPostgres(
  client: SqlQueryable,
  scope: { tenantId: string; companyId: string; userId: string },
  backupJson: string,
): Promise<PostgresMigrationSummary> {
  let raw: unknown;
  try {
    raw = JSON.parse(backupJson);
  } catch {
    throw new ErpDomainError('INVALID_MIGRATION_JSON', 'Migration payload is not valid JSON.');
  }

  const parsed = BackupPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ErpDomainError(
      'MIGRATION_VALIDATION_FAILED',
      `Migration validation failed at ${issue?.path.join('.') || 'root'}: ${issue?.message}`,
    );
  }

  const records = parsed.data.records;

  await client.query('BEGIN');
  try {
    await client.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [scope.tenantId]);
    await client.query(`SELECT set_config('app.current_company_id', $1, true)`, [scope.companyId]);
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [scope.userId]);

    for (const item of records.catalogue) {
      await client.query(
        `INSERT INTO catalogue.items (id, tenant_id, company_id, sku, name, item_type, category, unit, cost_price, selling_price, tax_rate, track_stock, reorder_level, version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (company_id, sku) DO UPDATE SET name = EXCLUDED.name, version = catalogue.items.version + 1`,
        [
          item.id,
          scope.tenantId,
          scope.companyId,
          item.sku,
          item.name,
          item.type,
          item.category,
          item.unit,
          item.costPrice,
          item.sellingPrice,
          item.taxRate,
          item.trackStock,
          item.reorderLevel,
          item.version,
        ],
      );
    }

    for (const acc of records.accounts) {
      await client.query(
        `INSERT INTO finance.accounts (id, tenant_id, company_id, code, name, category, sub_type, is_system)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (company_id, code) DO NOTHING`,
        [
          acc.id,
          scope.tenantId,
          scope.companyId,
          acc.code,
          acc.name,
          acc.category,
          acc.subType,
          Boolean(acc.isSystem),
        ],
      );
    }

    for (const fp of records.fiscalPeriods) {
      await client.query(
        `INSERT INTO finance.fiscal_periods (id, tenant_id, company_id, code, name, start_date, end_date, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (company_id, code) DO NOTHING`,
        [
          fp.id,
          scope.tenantId,
          scope.companyId,
          fp.code,
          fp.name,
          fp.startDate,
          fp.endDate,
          fp.status,
        ],
      );
    }

    for (const j of records.journals) {
      await client.query(
        `INSERT INTO finance.journals (id, tenant_id, company_id, branch_id, journal_number, entry_date, fiscal_period_id, reference, description, source_module, source_id, idempotency_key, status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (company_id, idempotency_key) DO NOTHING`,
        [
          j.id,
          scope.tenantId,
          scope.companyId,
          j.branchId,
          j.journalNumber,
          j.date,
          j.fiscalPeriodId,
          j.reference,
          j.description,
          j.sourceModule,
          j.sourceId ?? null,
          j.idempotencyKey,
          j.status,
          scope.userId,
        ],
      );
      for (const line of j.lines) {
        await client.query(
          `INSERT INTO finance.journal_lines (id, tenant_id, company_id, journal_id, account_id, debit, credit, memo)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT DO NOTHING`,
          [
            line.id,
            scope.tenantId,
            scope.companyId,
            j.id,
            line.accountId,
            line.debit,
            line.credit,
            line.memo ?? null,
          ],
        );
      }
    }

    await client.query('COMMIT');
    return {
      migratedAt: new Date().toISOString(),
      companyId: scope.companyId,
      counts: {
        catalogue: records.catalogue.length,
        contacts: records.contacts.length,
        accounts: records.accounts.length,
        fiscalPeriods: records.fiscalPeriods.length,
        journals: records.journals.length,
        salesOrders: records.salesOrders.length,
        purchaseOrders: records.purchaseOrders.length,
        stockMovements: records.stockMovements.length,
        employees: records.employees.length,
        payrollRuns: records.payrollRuns.length,
      },
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}
