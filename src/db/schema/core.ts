import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  auditSeverityEnum,
  notificationChannelEnum,
  subscriptionStatusEnum,
  subscriptionTierEnum,
} from './enums';
import { users } from './identity';
import { companies, tenants } from './organization';

export const coreSchema = pgSchema('core');
export const subscriptionsSchema = pgSchema('subscriptions');
export const auditSchema = pgSchema('audit');

/**
 * Subscription plans & hard backend entitlement quotas.
 * Prices use NUMERIC(19, 4) — never floating point.
 */
export const subscriptionPlans = subscriptionsSchema.table(
  'plans',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tier: subscriptionTierEnum('tier').notNull(),
    name: text('name').notNull(),
    monthlyPrice: numeric('monthly_price', { precision: 19, scale: 4 }).notNull().default('0.0000'),
    currency: text('currency').notNull().default('USD'),
    maxUsers: integer('max_users').notNull(),
    maxCompanies: integer('max_companies').notNull(),
    maxBranches: integer('max_branches').notNull(),
    storageLimitMb: integer('storage_limit_mb').notNull(),
    monthlyAiTokens: integer('monthly_ai_tokens').notNull(),
    monthlyApiRequests: integer('monthly_api_requests').notNull(),
    allowedModules: jsonb('allowed_modules').$type<string[]>().notNull().default([]),
    features: jsonb('features')
      .$type<{
        sso: boolean;
        customDomain: boolean;
        customBranding: boolean;
        advancedReports: boolean;
        auditRetentionDays: number;
      }>()
      .notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('subs_plans_tier_uidx').on(table.tier)],
);

export const tenantSubscriptions = subscriptionsSchema.table(
  'tenant_subscriptions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    planId: uuid('plan_id')
      .notNull()
      .references(() => subscriptionPlans.id),
    status: subscriptionStatusEnum('status').notNull().default('active'),
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true }).notNull(),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }).notNull(),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('subs_tenant_active_uidx').on(table.tenantId),
    index('subs_tenant_status_idx').on(table.status),
  ],
);

/**
 * Controlled custom field extensions without altering core relational tables.
 */
export const customFieldDefinitions = coreSchema.table(
  'custom_field_definitions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    entityNamespace: text('entity_namespace').notNull(), // e.g., crm.leads, catalogue.items
    fieldKey: text('field_key').notNull(),
    label: text('label').notNull(),
    dataType: text('data_type').notNull(), // text | number | decimal | boolean | date | select
    isRequired: boolean('is_required').notNull().default(false),
    validationSchema: jsonb('validation_schema').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('core_custom_fields_uidx').on(
      table.companyId,
      table.entityNamespace,
      table.fieldKey,
    ),
    index('core_custom_fields_tenant_idx').on(table.tenantId, table.companyId),
  ],
);

export const notifications = coreSchema.table(
  'notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    recipientUserId: uuid('recipient_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    channel: notificationChannelEnum('channel').notNull().default('in_app'),
    category: text('category').notNull(), // approval | alert | security | workflow | system
    title: text('title').notNull(),
    body: text('body').notNull(),
    actionUrl: text('action_url'),
    isRead: boolean('is_read').notNull().default(false),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('core_notifications_recipient_idx').on(
      table.tenantId,
      table.recipientUserId,
      table.isRead,
    ),
  ],
);

export const apiKeys = coreSchema.table(
  'api_keys',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    keyPrefix: text('key_prefix').notNull(),
    keyHash: text('key_hash').notNull(),
    scopes: jsonb('scopes').$type<string[]>().notNull().default([]),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('core_api_keys_hash_uidx').on(table.keyHash),
    index('core_api_keys_tenant_company_idx').on(table.tenantId, table.companyId),
  ],
);

/**
 * Append-only immutable audit log for security, RBAC, financial & AI actions.
 */
export const auditLogs = auditSchema.table(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id').references(() => companies.id, { onDelete: 'set null' }),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    actorType: text('actor_type').notNull().default('user'), // user | system | ai_gateway | api_key
    action: text('action').notNull(), // e.g. role.assigned, journal.posted, support.impersonated
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id'),
    severity: auditSeverityEnum('severity').notNull().default('info'),
    requestId: text('request_id'),
    ipAddress: text('ip_address'),
    beforeState: jsonb('before_state').$type<Record<string, unknown> | null>(),
    afterState: jsonb('after_state').$type<Record<string, unknown> | null>(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('audit_logs_tenant_created_idx').on(table.tenantId, table.createdAt),
    index('audit_logs_resource_idx').on(table.resourceType, table.resourceId),
  ],
);
