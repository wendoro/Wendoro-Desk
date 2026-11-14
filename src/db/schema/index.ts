export * from './enums';
export * from './identity';
export * from './organization';
export * from './core';
export * from './erp';

export const SCHEMA_NAMESPACES = [
  { namespace: 'identity', status: 'defined', phase: 'Phase 0/1', description: 'Users, sessions, OAuth accounts, passkeys, MFA & login history' },
  { namespace: 'organization', status: 'defined', phase: 'Phase 0/1', description: 'Tenants, companies, branches, departments, memberships, RBAC & module toggles' },
  { namespace: 'core', status: 'defined', phase: 'Phase 0/2', description: 'Custom fields, notifications, API keys & shared system primitives' },
  { namespace: 'subscriptions', status: 'defined', phase: 'Phase 0/1', description: 'Plans, backend quotas & tenant entitlement bindings' },
  { namespace: 'audit', status: 'defined', phase: 'Phase 0/1', description: 'Immutable security, financial & AI action audit logs' },
  { namespace: 'catalogue', status: 'defined', phase: 'Phase 3', description: 'Universal products, services, subscriptions, rentals & assets' },
  { namespace: 'crm', status: 'defined', phase: 'Phase 4', description: 'Leads, contacts, opportunities, pipelines & customer lifecycle' },
  { namespace: 'sales', status: 'defined', phase: 'Phase 4', description: 'Quotations, orders, invoices, dispatches & customer payments' },
  { namespace: 'purchase', status: 'defined', phase: 'Phase 4', description: 'Suppliers, RFQs, purchase orders, receipts & vendor bills' },
  { namespace: 'inventory', status: 'defined', phase: 'Phase 5', description: 'Warehouses, immutable stock ledger, batches, serials & reservations' },
  { namespace: 'finance', status: 'defined', phase: 'Phase 6', description: 'Double-entry GL, COA, journals, fiscal periods, AP/AR & tax liabilities' },
  { namespace: 'hr', status: 'defined', phase: 'Phase 7', description: 'Employees, payroll runs & payslips' },
  { namespace: 'integrations', status: 'defined', phase: 'Phase 9', description: 'Encrypted integration credentials, OAuth tokens & webhooks' },
  { namespace: 'automation', status: 'planned', phase: 'Phase 10', description: 'Workflow definitions, triggers, approval gates & run logs' },
  { namespace: 'ai', status: 'planned', phase: 'Phase 10', description: 'AI provider configs, token usage tracking & tool approvals' },
] as const;
