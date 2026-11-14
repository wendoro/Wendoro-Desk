-- WENDORO ERP Migration 0000: Core Foundation, Identity, Multi-Tenancy & RLS
-- Target: PostgreSQL 15+ (Neon / Hyperdrive / Self-Hosted)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Domain Schema Namespaces
CREATE SCHEMA IF NOT EXISTS identity;
CREATE SCHEMA IF NOT EXISTS organization;
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS subscriptions;
CREATE SCHEMA IF NOT EXISTS audit;

-- 2. Shared Enums
DO $$ BEGIN
  CREATE TYPE tenant_status AS ENUM ('active', 'trial', 'suspended', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE company_status AS ENUM ('active', 'inactive', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE membership_status AS ENUM ('active', 'invited', 'suspended', 'revoked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'expired', 'revoked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE role_scope AS ENUM ('tenant', 'company', 'branch');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE subscription_tier AS ENUM (
    'free', 'starter', 'business', 'professional', 'enterprise', 'white_label', 'self_hosted'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM ('active', 'trialing', 'past_due', 'canceled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE module_layer AS ENUM ('core', 'business', 'industry');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE audit_severity AS ENUM ('info', 'warning', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Identity Tables (Better Auth Compatible)
CREATE TABLE IF NOT EXISTS identity.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  email_verified boolean NOT NULL DEFAULT false,
  full_name text NOT NULL,
  avatar_url text,
  phone text,
  mfa_enabled boolean NOT NULL DEFAULT false,
  is_platform_admin boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS identity_users_email_uidx ON identity.users (email);

CREATE TABLE IF NOT EXISTS identity.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  token text NOT NULL,
  active_tenant_id uuid,
  active_company_id uuid,
  active_branch_id uuid,
  ip_address text,
  user_agent text,
  device_label text,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS identity_sessions_token_uidx ON identity.sessions (token);
CREATE INDEX IF NOT EXISTS identity_sessions_user_idx ON identity.sessions (user_id);

-- 4. Organization & Multi-Tenancy Tables
CREATE TABLE IF NOT EXISTS organization.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  name text NOT NULL,
  status tenant_status NOT NULL DEFAULT 'active',
  primary_domain text,
  data_region text NOT NULL DEFAULT 'global',
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS org_tenants_slug_uidx ON organization.tenants (slug);

CREATE TABLE IF NOT EXISTS organization.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organization.tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  legal_name text NOT NULL,
  industry_classification text NOT NULL DEFAULT 'universal',
  base_currency text NOT NULL DEFAULT 'USD',
  country_code text NOT NULL DEFAULT 'US',
  timezone text NOT NULL DEFAULT 'UTC',
  fiscal_year_start_month text NOT NULL DEFAULT '01',
  tax_registration_number text,
  status company_status NOT NULL DEFAULT 'active',
  branding jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS org_companies_tenant_code_uidx ON organization.companies (tenant_id, code);

CREATE TABLE IF NOT EXISTS organization.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organization.tenants(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES organization.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  is_headquarters boolean NOT NULL DEFAULT false,
  address_line_1 text,
  city text,
  state text,
  country_code text,
  postal_code text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS org_branches_company_code_uidx ON organization.branches (company_id, code);

CREATE TABLE IF NOT EXISTS organization.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organization.tenants(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES organization.companies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES organization.branches(id) ON DELETE SET NULL,
  parent_department_id uuid,
  code text NOT NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS org_departments_company_code_uidx ON organization.departments (company_id, code);

CREATE TABLE IF NOT EXISTS organization.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organization.tenants(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES organization.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  default_branch_id uuid REFERENCES organization.branches(id) ON DELETE SET NULL,
  department_id uuid REFERENCES organization.departments(id) ON DELETE SET NULL,
  job_title text,
  status membership_status NOT NULL DEFAULT 'active',
  is_default_company boolean NOT NULL DEFAULT false,
  joined_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS org_memberships_company_user_uidx ON organization.memberships (company_id, user_id);

CREATE TABLE IF NOT EXISTS organization.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organization.tenants(id) ON DELETE CASCADE,
  company_id uuid REFERENCES organization.companies(id) ON DELETE CASCADE,
  slug text NOT NULL,
  name text NOT NULL,
  description text,
  scope role_scope NOT NULL DEFAULT 'company',
  is_system_role boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS org_roles_tenant_company_slug_uidx
  ON organization.roles (tenant_id, company_id, slug);

CREATE TABLE IF NOT EXISTS organization.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  module_slug text NOT NULL,
  resource text NOT NULL,
  action text NOT NULL,
  description text NOT NULL,
  is_sensitive boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS org_permissions_key_uidx ON organization.permissions (key);

CREATE TABLE IF NOT EXISTS organization.role_permissions (
  role_id uuid NOT NULL REFERENCES organization.roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES organization.permissions(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES organization.tenants(id) ON DELETE CASCADE,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS organization.user_role_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organization.tenants(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES organization.companies(id) ON DELETE CASCADE,
  membership_id uuid NOT NULL REFERENCES organization.memberships(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES organization.roles(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES organization.branches(id) ON DELETE CASCADE,
  assigned_by_user_id uuid REFERENCES identity.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS org_user_role_assignment_uidx
  ON organization.user_role_assignments (membership_id, role_id, branch_id);

CREATE TABLE IF NOT EXISTS organization.company_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organization.tenants(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES organization.companies(id) ON DELETE CASCADE,
  module_slug text NOT NULL,
  layer module_layer NOT NULL,
  is_enabled boolean NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  activated_by_user_id uuid REFERENCES identity.users(id) ON DELETE SET NULL,
  activated_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS org_company_modules_uidx
  ON organization.company_modules (company_id, module_slug);

-- 5. Immutable Audit Log Table
CREATE TABLE IF NOT EXISTS audit.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organization.tenants(id) ON DELETE CASCADE,
  company_id uuid REFERENCES organization.companies(id) ON DELETE SET NULL,
  actor_user_id uuid REFERENCES identity.users(id) ON DELETE SET NULL,
  actor_type text NOT NULL DEFAULT 'user',
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  severity audit_severity NOT NULL DEFAULT 'info',
  request_id text,
  ip_address text,
  before_state jsonb,
  after_state jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_tenant_created_idx ON audit.audit_logs (tenant_id, created_at DESC);

-- Prevent UPDATE or DELETE on audit.audit_logs
CREATE OR REPLACE FUNCTION audit.prevent_audit_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit.audit_logs is immutable and cannot be modified or deleted';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON audit.audit_logs;
CREATE TRIGGER trg_audit_logs_immutable
  BEFORE UPDATE OR DELETE ON audit.audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit.prevent_audit_mutation();

-- 6. Transaction-Scoped Row-Level Security (RLS)
-- Helpers read transaction-local settings set by withTenantContext():
--   SET LOCAL app.current_tenant_id = '<uuid>';
--   SET LOCAL app.current_company_id = '<uuid>';

CREATE OR REPLACE FUNCTION core.current_tenant_id()
RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION core.current_company_id()
RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.current_company_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;

ALTER TABLE organization.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization.user_role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization.company_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_companies ON organization.companies
  USING (tenant_id = core.current_tenant_id())
  WITH CHECK (tenant_id = core.current_tenant_id());

CREATE POLICY company_isolation_branches ON organization.branches
  USING (tenant_id = core.current_tenant_id() AND company_id = core.current_company_id())
  WITH CHECK (tenant_id = core.current_tenant_id() AND company_id = core.current_company_id());

CREATE POLICY company_isolation_departments ON organization.departments
  USING (tenant_id = core.current_tenant_id() AND company_id = core.current_company_id())
  WITH CHECK (tenant_id = core.current_tenant_id() AND company_id = core.current_company_id());

CREATE POLICY tenant_isolation_memberships ON organization.memberships
  USING (tenant_id = core.current_tenant_id())
  WITH CHECK (tenant_id = core.current_tenant_id());

CREATE POLICY tenant_isolation_roles ON organization.roles
  USING (tenant_id = core.current_tenant_id())
  WITH CHECK (tenant_id = core.current_tenant_id());

CREATE POLICY tenant_isolation_role_permissions ON organization.role_permissions
  USING (tenant_id = core.current_tenant_id())
  WITH CHECK (tenant_id = core.current_tenant_id());

CREATE POLICY company_isolation_user_role_assignments ON organization.user_role_assignments
  USING (tenant_id = core.current_tenant_id() AND company_id = core.current_company_id())
  WITH CHECK (tenant_id = core.current_tenant_id() AND company_id = core.current_company_id());

CREATE POLICY company_isolation_company_modules ON organization.company_modules
  USING (tenant_id = core.current_tenant_id() AND company_id = core.current_company_id())
  WITH CHECK (tenant_id = core.current_tenant_id() AND company_id = core.current_company_id());

CREATE POLICY tenant_isolation_audit_logs ON audit.audit_logs
  FOR SELECT USING (tenant_id = core.current_tenant_id());

CREATE POLICY tenant_insert_audit_logs ON audit.audit_logs
  FOR INSERT WITH CHECK (tenant_id = core.current_tenant_id());
