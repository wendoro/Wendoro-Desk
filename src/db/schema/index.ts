export * from './enums';
export * from './identity';
export * from './organization';
export * from './core';

export const SCHEMA_NAMESPACES = [
  { namespace: 'identity', status: 'defined', phase: 'Phase 0/1', description: 'Users, sessions, OAuth accounts, passkeys, MFA & login history' },
  { namespace: 'organization', status: 'defined', phase: 'Phase 0/1', description: 'Tenants, companies, branches, departments, memberships, RBAC & module toggles' },
  { namespace: 'core', status: 'defined', phase: 'Phase 0/2', description: 'Custom fields, notifications, API keys & shared system primitives' },
  { namespace: 'subscriptions', status: 'defined', phase: 'Phase 0/1', description: 'Plans, backend quotas & tenant entitlement bindings' },
  { namespace: 'audit', status: 'defined', phase: 'Phase 0/1', description: 'Immutable security, financial & AI action audit logs' },
  { namespace: 'catalogue', status: 'planned', phase: 'Phase 3', description: 'Universal products, services, subscriptions, rentals & assets' },
  { namespace: 'crm', status: 'planned', phase: 'Phase 4', description: 'Leads, contacts, opportunities, pipelines & customer lifecycle' },
  { namespace: 'sales', status: 'planned', phase: 'Phase 4', description: 'Quotations, orders, invoices, credit notes & customer payments' },
  { namespace: 'purchase', status: 'planned', phase: 'Phase 4', description: 'Suppliers, RFQs, purchase orders, bills & vendor ratings' },
  { namespace: 'inventory', status: 'planned', phase: 'Phase 5', description: 'Warehouses, immutable stock ledger, batches, serials & transfers' },
  { namespace: 'finance', status: 'planned', phase: 'Phase 6', description: 'Double-entry GL, COA, journals, AP/AR, bank reconciliation & tax' },
  { namespace: 'hr', status: 'planned', phase: 'Phase 7', description: 'Employees, attendance, leave, shifts, payroll & payslips' },
  { namespace: 'integrations', status: 'planned', phase: 'Phase 9', description: 'WENDORO Connect OAuth tokens, webhooks & sync logs' },
  { namespace: 'automation', status: 'planned', phase: 'Phase 10', description: 'Workflow definitions, triggers, approval gates & run logs' },
  { namespace: 'ai', status: 'planned', phase: 'Phase 10', description: 'AI provider configs, token usage tracking & tool approvals' },
] as const;
