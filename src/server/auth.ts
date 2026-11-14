import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { organization } from 'better-auth/plugins';
import { getDrizzleDb, isPostgresConfigured } from '@/src/db/client';
import * as schema from '@/src/db/schema';

export function isAuthSecretConfigured(): boolean {
  const secret = process.env.BETTER_AUTH_SECRET;
  return Boolean(secret && secret.trim().length >= 16 && !secret.includes('REPLACE_WITH'));
}

function createBetterAuthInstance(db: NonNullable<ReturnType<typeof getDrizzleDb>>) {
  return betterAuth({
    secret: process.env.BETTER_AUTH_SECRET!,
    baseURL: process.env.APP_URL || 'http://localhost:3000',
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: {
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verifications,
      },
    }),
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
    },
    plugins: [
      organization({
        allowUserToCreateOrganization: true,
      }),
    ],
  });
}

let cachedAuth: ReturnType<typeof createBetterAuthInstance> | null = null;

/**
 * Returns the Better Auth server instance backed by Drizzle + PostgreSQL (`identity`
 * & `organization` schemas) when `DATABASE_URL` and `BETTER_AUTH_SECRET` are set.
 */
export function getBetterAuth() {
  if (cachedAuth) return cachedAuth;
  const db = getDrizzleDb();
  if (!db || !isAuthSecretConfigured()) {
    return null;
  }

  cachedAuth = createBetterAuthInstance(db);
  return cachedAuth;
}

export function getAuthReadiness() {
  return {
    databaseConfigured: isPostgresConfigured(),
    authSecretConfigured: isAuthSecretConfigured(),
    betterAuthReady: Boolean(isPostgresConfigured() && isAuthSecretConfigured()),
  };
}
