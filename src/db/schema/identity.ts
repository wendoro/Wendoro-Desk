import {
  boolean,
  index,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const identitySchema = pgSchema('identity');

/**
 * Global authenticated human/service identities (Better Auth compatible).
 * Separated from business authorization (organization.memberships).
 */
export const users = identitySchema.table(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').notNull(),
    emailVerified: boolean('email_verified').notNull().default(false),
    fullName: text('full_name').notNull(),
    avatarUrl: text('avatar_url'),
    phone: text('phone'),
    mfaEnabled: boolean('mfa_enabled').notNull().default(false),
    isPlatformAdmin: boolean('is_platform_admin').notNull().default(false),
    status: text('status').notNull().default('active'),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('identity_users_email_uidx').on(table.email)],
);

export const sessions = identitySchema.table(
  'sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull(),
    activeTenantId: uuid('active_tenant_id'),
    activeCompanyId: uuid('active_company_id'),
    activeBranchId: uuid('active_branch_id'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    deviceLabel: text('device_label'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('identity_sessions_token_uidx').on(table.token),
    index('identity_sessions_user_idx').on(table.userId),
  ],
);

export const accounts = identitySchema.table(
  'accounts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    providerId: text('provider_id').notNull(), // credential | google | microsoft
    accountId: text('account_id').notNull(),
    passwordHash: text('password_hash'),
    accessTokenEncrypted: text('access_token_encrypted'),
    refreshTokenEncrypted: text('refresh_token_encrypted'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('identity_accounts_provider_account_uidx').on(
      table.providerId,
      table.accountId,
    ),
    index('identity_accounts_user_idx').on(table.userId),
  ],
);

export const verifications = identitySchema.table(
  'verifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    purpose: text('purpose').notNull(), // email_verification | magic_link | otp | password_reset
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('identity_verifications_identifier_idx').on(table.identifier)],
);

export const passkeys = identitySchema.table(
  'passkeys',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    credentialId: text('credential_id').notNull(),
    publicKey: text('public_key').notNull(),
    counter: text('counter').notNull().default('0'),
    deviceType: text('device_type'),
    backedUp: boolean('backed_up').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('identity_passkeys_credential_uidx').on(table.credentialId),
    index('identity_passkeys_user_idx').on(table.userId),
  ],
);

export const loginHistory = identitySchema.table(
  'login_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    emailAttempted: text('email_attempted').notNull(),
    authMethod: text('auth_method').notNull(), // password | google | microsoft | passkey | magic_link | otp
    outcome: text('outcome').notNull(), // success | failed | mfa_required | blocked
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    failureReason: text('failure_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('identity_login_history_user_idx').on(table.userId),
    index('identity_login_history_created_idx').on(table.createdAt),
  ],
);
