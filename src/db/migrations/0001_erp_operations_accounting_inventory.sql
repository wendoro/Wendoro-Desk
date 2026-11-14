-- WENDORO ERP Migration 0001: Operational ERP, Double-Entry Accounting, Inventory & Credentials
-- Target: PostgreSQL 15+ (Neon / Hyperdrive / Cloud SQL / Self-Hosted)

CREATE SCHEMA IF NOT EXISTS catalogue;
CREATE SCHEMA IF NOT EXISTS crm;
CREATE SCHEMA IF NOT EXISTS finance;
CREATE SCHEMA IF NOT EXISTS inventory;
CREATE SCHEMA IF NOT EXISTS sales;
CREATE SCHEMA IF NOT EXISTS purchase;
CREATE SCHEMA IF NOT EXISTS hr;
CREATE SCHEMA IF NOT EXISTS operations;
CREATE SCHEMA IF NOT EXISTS integrations;

-- 1. Universal Catalogue
CREATE TABLE IF NOT EXISTS catalogue.items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organization.tenants(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES organization.companies(id) ON DELETE CASCADE,
  sku text NOT NULL,
  name text NOT NULL,
  item_type text NOT NULL DEFAULT 'physical',
  category text NOT NULL DEFAULT 'General',
  unit text NOT NULL DEFAULT 'Nos',
  cost_price numeric(18, 4) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  selling_price numeric(18, 4) NOT NULL DEFAULT 0 CHECK (selling_price >= 0),
  tax_rate numeric(7, 4) NOT NULL DEFAULT 0 CHECK (tax_rate >= 0),
  track_stock boolean NOT NULL DEFAULT true,
  reorder_level numeric(18, 4) NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS cat_items_company_sku_uidx ON catalogue.items (company_id, sku);
CREATE INDEX IF NOT EXISTS cat_items_tenant_company_idx ON catalogue.items (tenant_id, company_id);

-- 2. CRM Contacts
CREATE TABLE IF NOT EXISTS crm.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organization.tenants(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES organization.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  organization_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  contact_type text NOT NULL DEFAULT 'customer',
  stage text NOT NULL DEFAULT 'lead',
  estimated_value numeric(18, 2) NOT NULL DEFAULT 0,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_contacts_tenant_company_idx ON crm.contacts (tenant_id, company_id);

-- 3. Double-Entry Finance & Fiscal Periods
CREATE TABLE IF NOT EXISTS finance.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organization.tenants(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES organization.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
  sub_type text NOT NULL,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS fin_accounts_company_code_uidx ON finance.accounts (company_id, code);
CREATE INDEX IF NOT EXISTS fin_accounts_tenant_company_idx ON finance.accounts (tenant_id, company_id);

CREATE TABLE IF NOT EXISTS finance.fiscal_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organization.tenants(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES organization.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  closed_at timestamptz,
  closed_by uuid REFERENCES identity.users(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS fin_fiscal_periods_company_code_uidx ON finance.fiscal_periods (company_id, code);

CREATE TABLE IF NOT EXISTS finance.journals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organization.tenants(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES organization.companies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES organization.branches(id) ON DELETE SET NULL,
  journal_number text NOT NULL,
  entry_date date NOT NULL,
  fiscal_period_id uuid NOT NULL REFERENCES finance.fiscal_periods(id) ON DELETE RESTRICT,
  reference text NOT NULL,
  description text NOT NULL,
  source_module text NOT NULL,
  source_id uuid,
  idempotency_key text NOT NULL,
  status text NOT NULL DEFAULT 'posted' CHECK (status IN ('posted', 'reversed')),
  reverses_journal_id uuid REFERENCES finance.journals(id) ON DELETE RESTRICT,
  reversed_by_journal_id uuid REFERENCES finance.journals(id) ON DELETE RESTRICT,
  created_by uuid REFERENCES identity.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS fin_journals_company_number_uidx ON finance.journals (company_id, journal_number);
CREATE UNIQUE INDEX IF NOT EXISTS fin_journals_company_idemp_uidx ON finance.journals (company_id, idempotency_key);
CREATE INDEX IF NOT EXISTS fin_journals_tenant_company_date_idx ON finance.journals (tenant_id, company_id, entry_date);

CREATE TABLE IF NOT EXISTS finance.journal_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organization.tenants(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES organization.companies(id) ON DELETE CASCADE,
  journal_id uuid NOT NULL REFERENCES finance.journals(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES finance.accounts(id) ON DELETE RESTRICT,
  debit numeric(18, 2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit numeric(18, 2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  memo text,
  CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0))
);
CREATE INDEX IF NOT EXISTS fin_journal_lines_journal_idx ON finance.journal_lines (journal_id);
CREATE INDEX IF NOT EXISTS fin_journal_lines_company_acc_idx ON finance.journal_lines (company_id, account_id);

-- Enforce double-entry balance at commit time (Deferrable Constraint Trigger)
CREATE OR REPLACE FUNCTION finance.enforce_balanced_journal()
RETURNS trigger AS $$
DECLARE
  v_debit numeric(18, 2);
  v_credit numeric(18, 2);
  v_count integer;
  v_journal_id uuid;
BEGIN
  v_journal_id := COALESCE(NEW.journal_id, OLD.journal_id);
  SELECT COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0), COUNT(*)
    INTO v_debit, v_credit, v_count
    FROM finance.journal_lines
   WHERE journal_id = v_journal_id;

  IF v_count < 2 OR v_debit <> v_credit OR v_debit <= 0 THEN
    RAISE EXCEPTION 'Unbalanced journal % (lines=%, debits=%, credits=%)',
      v_journal_id, v_count, v_debit, v_credit;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_balanced_journal ON finance.journal_lines;
CREATE CONSTRAINT TRIGGER trg_enforce_balanced_journal
AFTER INSERT OR UPDATE OR DELETE ON finance.journal_lines
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION finance.enforce_balanced_journal();

-- 4. Inventory Balances, Lots, Reservations & Immutable Movements
CREATE TABLE IF NOT EXISTS inventory.stock_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organization.tenants(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES organization.companies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES organization.branches(id) ON DELETE SET NULL,
  item_id uuid NOT NULL REFERENCES catalogue.items(id) ON DELETE RESTRICT,
  qty_on_hand numeric(18, 4) NOT NULL DEFAULT 0 CHECK (qty_on_hand >= 0),
  qty_reserved numeric(18, 4) NOT NULL DEFAULT 0 CHECK (qty_reserved >= 0),
  asset_value numeric(18, 2) NOT NULL DEFAULT 0 CHECK (asset_value >= 0),
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (qty_reserved <= qty_on_hand)
);
CREATE UNIQUE INDEX IF NOT EXISTS inv_balances_company_item_branch_uidx
  ON inventory.stock_balances (company_id, item_id, COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE TABLE IF NOT EXISTS inventory.stock_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organization.tenants(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES organization.companies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES organization.branches(id) ON DELETE SET NULL,
  item_id uuid NOT NULL REFERENCES catalogue.items(id) ON DELETE RESTRICT,
  batch_number text NOT NULL,
  serial_numbers jsonb NOT NULL DEFAULT '[]'::jsonb,
  expiry_date date,
  qty_received numeric(18, 4) NOT NULL CHECK (qty_received >= 0),
  qty_remaining numeric(18, 4) NOT NULL CHECK (qty_remaining >= 0),
  unit_cost numeric(18, 4) NOT NULL CHECK (unit_cost >= 0),
  receipt_reference text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inv_batches_company_item_idx ON inventory.stock_batches (company_id, item_id);

CREATE TABLE IF NOT EXISTS inventory.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organization.tenants(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES organization.companies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES organization.branches(id) ON DELETE SET NULL,
  item_id uuid NOT NULL REFERENCES catalogue.items(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('in', 'out', 'adjustment')),
  movement_type text NOT NULL,
  quantity numeric(18, 4) NOT NULL CHECK (quantity >= 0),
  unit_cost numeric(18, 4) NOT NULL DEFAULT 0,
  total_value numeric(18, 2) NOT NULL DEFAULT 0,
  balance_after numeric(18, 4) NOT NULL,
  reserved_after numeric(18, 4) NOT NULL DEFAULT 0,
  batch_number text,
  serial_numbers jsonb NOT NULL DEFAULT '[]'::jsonb,
  reference text NOT NULL,
  idempotency_key text NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS inv_movements_company_idemp_uidx ON inventory.stock_movements (company_id, idempotency_key);
CREATE INDEX IF NOT EXISTS inv_movements_company_item_idx ON inventory.stock_movements (company_id, item_id);

-- 5. Sales, Purchase, HR & Payment Allocations
CREATE TABLE IF NOT EXISTS sales.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organization.tenants(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES organization.companies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES organization.branches(id) ON DELETE SET NULL,
  document_number text NOT NULL,
  document_type text NOT NULL CHECK (document_type IN ('invoice', 'quote')),
  customer_id uuid REFERENCES crm.contacts(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  issue_date date NOT NULL,
  due_date date NOT NULL,
  status text NOT NULL CHECK (status IN ('draft', 'sent', 'paid', 'cancelled')),
  fulfillment_status text NOT NULL DEFAULT 'pending' CHECK (fulfillment_status IN ('pending', 'reserved', 'dispatched')),
  subtotal numeric(18, 2) NOT NULL CHECK (subtotal >= 0),
  tax_total numeric(18, 2) NOT NULL CHECK (tax_total >= 0),
  grand_total numeric(18, 2) NOT NULL CHECK (grand_total >= 0),
  amount_paid numeric(18, 2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  invoice_journal_id uuid REFERENCES finance.journals(id) ON DELETE RESTRICT,
  cogs_journal_id uuid REFERENCES finance.journals(id) ON DELETE RESTRICT,
  dispatch_ref text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sales_orders_company_doc_uidx ON sales.orders (company_id, document_number);

CREATE TABLE IF NOT EXISTS purchase.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organization.tenants(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES organization.companies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES organization.branches(id) ON DELETE SET NULL,
  document_number text NOT NULL,
  vendor_id uuid REFERENCES crm.contacts(id) ON DELETE SET NULL,
  vendor_name text NOT NULL,
  order_date date NOT NULL,
  expected_date date NOT NULL,
  status text NOT NULL CHECK (status IN ('draft', 'ordered', 'received', 'cancelled')),
  subtotal numeric(18, 2) NOT NULL CHECK (subtotal >= 0),
  tax_total numeric(18, 2) NOT NULL CHECK (tax_total >= 0),
  grand_total numeric(18, 2) NOT NULL CHECK (grand_total >= 0),
  amount_paid numeric(18, 2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  receipt_journal_id uuid REFERENCES finance.journals(id) ON DELETE RESTRICT,
  receipt_ref text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS pur_orders_company_doc_uidx ON purchase.orders (company_id, document_number);

CREATE TABLE IF NOT EXISTS finance.payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organization.tenants(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES organization.companies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES organization.branches(id) ON DELETE SET NULL,
  payment_date date NOT NULL,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  order_id uuid NOT NULL,
  document_number text NOT NULL,
  counterparty_name text NOT NULL,
  amount numeric(18, 2) NOT NULL CHECK (amount > 0),
  method text NOT NULL,
  journal_id uuid NOT NULL REFERENCES finance.journals(id) ON DELETE RESTRICT,
  reference text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS fin_pay_alloc_company_ref_uidx ON finance.payment_allocations (company_id, reference);

CREATE TABLE IF NOT EXISTS hr.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organization.tenants(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES organization.companies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES organization.branches(id) ON DELETE SET NULL,
  employee_code text NOT NULL,
  full_name text NOT NULL,
  email text NOT NULL DEFAULT '',
  department text NOT NULL,
  designation text NOT NULL,
  monthly_salary numeric(18, 2) NOT NULL CHECK (monthly_salary >= 0),
  status text NOT NULL DEFAULT 'active',
  joined_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS hr_emp_company_code_uidx ON hr.employees (company_id, employee_code);

CREATE TABLE IF NOT EXISTS hr.payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organization.tenants(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES organization.companies(id) ON DELETE CASCADE,
  period_key text NOT NULL,
  employee_count integer NOT NULL CHECK (employee_count > 0),
  total_gross numeric(18, 2) NOT NULL CHECK (total_gross > 0),
  journal_id uuid NOT NULL REFERENCES finance.journals(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'posted' CHECK (status IN ('posted', 'reversed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS hr_payroll_company_period_uidx ON hr.payroll_runs (company_id, period_key)
  WHERE status = 'posted';

-- 6. Encrypted Integration Credentials Vault
CREATE TABLE IF NOT EXISTS integrations.encrypted_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organization.tenants(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES organization.companies(id) ON DELETE CASCADE,
  provider text NOT NULL,
  key_version integer NOT NULL DEFAULT 1,
  ciphertext text NOT NULL,
  created_by uuid REFERENCES identity.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS int_creds_company_provider_uidx ON integrations.encrypted_credentials (company_id, provider);

-- 7. Row-Level Security (RLS) Tenant & Company Isolation Policies
DO $$
DECLARE
  tbl text;
  rls_tables text[] := ARRAY[
    'catalogue.items',
    'crm.contacts',
    'finance.accounts',
    'finance.fiscal_periods',
    'finance.journals',
    'finance.journal_lines',
    'finance.payment_allocations',
    'inventory.stock_balances',
    'inventory.stock_batches',
    'inventory.stock_movements',
    'sales.orders',
    'purchase.orders',
    'hr.employees',
    'hr.payroll_runs',
    'integrations.encrypted_credentials'
  ];
BEGIN
  FOREACH tbl IN ARRAY rls_tables LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS wendoro_tenant_company_isolation ON %s', tbl);
    EXECUTE format(
      'CREATE POLICY wendoro_tenant_company_isolation ON %s
       USING (
         tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid
         AND company_id = NULLIF(current_setting(''app.current_company_id'', true), '''')::uuid
       )
       WITH CHECK (
         tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid
         AND company_id = NULLIF(current_setting(''app.current_company_id'', true), '''')::uuid
       )',
      tbl
    );
  END LOOP;
END $$;
