import { sql } from 'drizzle-orm';

export interface TenantDbScope {
  tenantId: string;
  companyId: string;
  userId: string;
  branchId?: string | null;
}

export interface TransactionCapableDb {
  transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T>;
}

export interface SqlExecutor {
  execute(query: ReturnType<typeof sql>): Promise<unknown>;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertValidUuid(value: string, label: string): string {
  if (!UUID_REGEX.test(value)) {
    throw new Error(`Invalid UUID provided for ${label}`);
  }
  return value;
}

/**
 * Executes a callback inside a PostgreSQL transaction with transaction-local
 * tenant and company context variables (`SET LOCAL`, i.e., `set_config(..., true)`).
 *
 * Safe for pooled connections (Cloudflare Hyperdrive / PgBouncer transaction mode)
 * because settings automatically clear when the transaction commits or rolls back.
 */
export async function withTenantContext<TTx extends SqlExecutor, TResult>(
  db: { transaction: <R>(fn: (tx: TTx) => Promise<R>) => Promise<R> },
  scope: TenantDbScope,
  callback: (tx: TTx) => Promise<TResult>,
): Promise<TResult> {
  const tenantId = assertValidUuid(scope.tenantId, 'tenantId');
  const companyId = assertValidUuid(scope.companyId, 'companyId');
  const userId = assertValidUuid(scope.userId, 'userId');

  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`);
    await tx.execute(sql`SELECT set_config('app.current_company_id', ${companyId}, true)`);
    await tx.execute(sql`SELECT set_config('app.current_user_id', ${userId}, true)`);

    if (scope.branchId) {
      const branchId = assertValidUuid(scope.branchId, 'branchId');
      await tx.execute(sql`SELECT set_config('app.current_branch_id', ${branchId}, true)`);
    }

    return callback(tx);
  });
}
