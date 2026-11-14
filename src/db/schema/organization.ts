import {
  boolean,
  index,
  jsonb,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  companyStatusEnum,
  invitationStatusEnum,
  membershipStatusEnum,
  moduleLayerEnum,
  roleScopeEnum,
  tenantStatusEnum,
} from './enums';
import { users } from './identity';

export const organizationSchema = pgSchema('organization');

/**
 * Top-level billing & isolation boundary. A tenant owns one or more companies.
 */
export const tenants = organizationSchema.table(
  'tenants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    status: tenantStatusEnum('status').notNull().default('active'),
    primaryDomain: text('primary_domain'),
    dataRegion: text('data_region').notNull().default('global'),
    settings: jsonb('settings').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('org_tenants_slug_uidx').on(table.slug)],
);

/**
 * Legal / operational business entity within a tenant.
 * Every business record belongs to a tenant_id and company_id.
 */
export const companies = organizationSchema.table(
  'companies',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    name: text('name').notNull(),
    legalName: text('legal_name').notNull(),
    industryClassification: text('industry_classification').notNull().default('universal'),
    baseCurrency: text('base_currency').notNull().default('USD'),
    countryCode: text('country_code').notNull().default('US'),
    timezone: text('timezone').notNull().default('UTC'),
    fiscalYearStartMonth: text('fiscal_year_start_month').notNull().default('01'),
    taxRegistrationNumber: text('tax_registration_number'),
    status: companyStatusEnum('status').notNull().default('active'),
    branding: jsonb('branding')
      .$type<{ primaryColor?: string; logoUrl?: string }>()
      .notNull()
      .default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('org_companies_tenant_code_uidx').on(table.tenantId, table.code),
    index('org_companies_tenant_idx').on(table.tenantId),
  ],
);

export const branches = organizationSchema.table(
  'branches',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    name: text('name').notNull(),
    isHeadquarters: boolean('is_headquarters').notNull().default(false),
    addressLine1: text('address_line_1'),
    city: text('city'),
    state: text('state'),
    countryCode: text('country_code'),
    postalCode: text('postal_code'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('org_branches_company_code_uidx').on(table.companyId, table.code),
    index('org_branches_tenant_company_idx').on(table.tenantId, table.companyId),
  ],
);

export const departments = organizationSchema.table(
  'departments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'set null' }),
    parentDepartmentId: uuid('parent_department_id'),
    code: text('code').notNull(),
    name: text('name').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('org_departments_company_code_uidx').on(table.companyId, table.code),
    index('org_departments_tenant_company_idx').on(table.tenantId, table.companyId),
  ],
);

/**
 * Links an identity user to a specific tenant & company.
 * Users can hold memberships across multiple companies.
 */
export const memberships = organizationSchema.table(
  'memberships',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    defaultBranchId: uuid('default_branch_id').references(() => branches.id, {
      onDelete: 'set null',
    }),
    departmentId: uuid('department_id').references(() => departments.id, {
      onDelete: 'set null',
    }),
    jobTitle: text('job_title'),
    status: membershipStatusEnum('status').notNull().default('active'),
    isDefaultCompany: boolean('is_default_company').notNull().default(false),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('org_memberships_company_user_uidx').on(table.companyId, table.userId),
    index('org_memberships_tenant_user_idx').on(table.tenantId, table.userId),
  ],
);

export const roles = organizationSchema.table(
  'roles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id').references(() => companies.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    scope: roleScopeEnum('scope').notNull().default('company'),
    isSystemRole: boolean('is_system_role').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('org_roles_tenant_company_slug_uidx').on(
      table.tenantId,
      table.companyId,
      table.slug,
    ),
    index('org_roles_tenant_idx').on(table.tenantId),
  ],
);

/**
 * Global catalog of granular capabilities (e.g., finance.journal.post, crm.lead.read).
 */
export const permissions = organizationSchema.table(
  'permissions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    key: text('key').notNull(),
    moduleSlug: text('module_slug').notNull(),
    resource: text('resource').notNull(),
    action: text('action').notNull(),
    description: text('description').notNull(),
    isSensitive: boolean('is_sensitive').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('org_permissions_key_uidx').on(table.key)],
);

export const rolePermissions = organizationSchema.table(
  'role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.roleId, table.permissionId] }),
    index('org_role_permissions_tenant_idx').on(table.tenantId),
  ],
);

export const userRoleAssignments = organizationSchema.table(
  'user_role_assignments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    membershipId: uuid('membership_id')
      .notNull()
      .references(() => memberships.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'cascade' }),
    assignedByUserId: uuid('assigned_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('org_user_role_assignment_uidx').on(
      table.membershipId,
      table.roleId,
      table.branchId,
    ),
    index('org_user_role_tenant_company_idx').on(table.tenantId, table.companyId),
  ],
);

export const invitations = organizationSchema.table(
  'invitations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'set null' }),
    tokenHash: text('token_hash').notNull(),
    status: invitationStatusEnum('status').notNull().default('pending'),
    invitedByUserId: uuid('invited_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('org_invitations_token_uidx').on(table.tokenHash),
    index('org_invitations_company_email_idx').on(table.companyId, table.email),
  ],
);

/**
 * Tracks independently activated Layer B & Layer C modules per company.
 */
export const companyModules = organizationSchema.table(
  'company_modules',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    moduleSlug: text('module_slug').notNull(),
    layer: moduleLayerEnum('layer').notNull(),
    isEnabled: boolean('is_enabled').notNull().default(false),
    config: jsonb('config').$type<Record<string, unknown>>().notNull().default({}),
    activatedByUserId: uuid('activated_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    activatedAt: timestamp('activated_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('org_company_modules_uidx').on(table.companyId, table.moduleSlug),
    index('org_company_modules_tenant_idx').on(table.tenantId, table.companyId),
  ],
);
