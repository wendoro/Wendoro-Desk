import React, { useState } from 'react';
import { History, Plus, ShieldCheck, Sliders, Trash2 } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { DataColumn, DataTable } from '@/src/components/ui/DataTable';
import { Surface } from '@/src/components/ui/Surface';
import { useErpData } from '@/src/components/shell/ErpDataProvider';
import { useTenant } from '@/src/components/shell/TenantProvider';
import { ApprovalRule, AuditLogRecord, CustomFieldDefinition } from '@/src/core/store/erpTypes';
import { formatNumericCurrency } from '@/src/lib/utils';

export function WorkflowStudioView() {
  const { activeCompany } = useTenant();
  const {
    data,
    addApprovalRule,
    toggleApprovalRule,
    addCustomField,
    deleteCustomField,
  } = useErpData();
  const currency = activeCompany.baseCurrency;

  const [tab, setTab] = useState<'approvals' | 'fields' | 'audit'>('approvals');

  // Approval Rule Form
  const [ruleName, setRuleName] = useState('');
  const [ruleModule, setRuleModule] = useState<ApprovalRule['module']>('purchase');
  const [minAmount, setMinAmount] = useState('5000');
  const [approverRole, setApproverRole] = useState('Finance Controller');

  // Custom Field Form
  const [fieldModule, setFieldModule] = useState<CustomFieldDefinition['module']>('crm');
  const [fieldLabel, setFieldLabel] = useState('');
  const [fieldType, setFieldType] = useState<CustomFieldDefinition['fieldType']>('text');
  const [fieldRequired, setFieldRequired] = useState(false);
  const [optionsCsv, setOptionsCsv] = useState('');

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim()) return;
    addApprovalRule({
      name: ruleName.trim(),
      module: ruleModule,
      minAmount: Math.max(0, Number(minAmount) || 0),
      approverRole: approverRole.trim() || 'Finance Controller',
      active: true,
    });
    setRuleName('');
    setMinAmount('5000');
  };

  const handleAddField = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fieldLabel.trim()) return;
    addCustomField({
      module: fieldModule,
      fieldLabel: fieldLabel.trim(),
      fieldType,
      required: fieldRequired,
      optionsCsv: fieldType === 'select' ? optionsCsv.trim() : undefined,
    });
    setFieldLabel('');
    setOptionsCsv('');
    setFieldRequired(false);
  };

  const auditColumns: DataColumn<AuditLogRecord>[] = [
    {
      key: 'time',
      header: 'Timestamp',
      sortable: true,
      sortValue: (r) => r.createdAt,
      render: (r) => (
        <span className="font-mono text-[11px] text-[#718096] dark:text-slate-400">
          {new Date(r.createdAt).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'action',
      header: 'Event & Resource',
      render: (r) => (
        <div>
          <div className="font-mono text-xs font-semibold">{r.action}</div>
          <div className="text-[11px] text-[#718096] dark:text-slate-400">
            {r.resourceType} · Role: {r.actorRole}
          </div>
        </div>
      ),
    },
    {
      key: 'outcome',
      header: 'Outcome',
      render: (r) => (
        <span
          className={`text-xs font-semibold capitalize ${
            r.outcome === 'success' ? 'text-[#16B8A6]' : 'text-red-600 dark:text-red-400'
          }`}
        >
          {r.outcome}
        </span>
      ),
    },
    {
      key: 'details',
      header: 'Details',
      render: (r) => <span className="text-xs text-[#718096] dark:text-slate-300">{r.details}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#1C1917] dark:text-slate-100">
          Workflow Studio & Low-Code Customization
        </h1>
        <p className="mt-1 text-xs text-[#718096] dark:text-slate-400">
          Enforce multi-level procurement approval thresholds, define custom entity fields across modules, and inspect the immutable company audit trail.
        </p>
      </div>

      {/* Tabs */}
      <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-[#251B20]">
        <button
          type="button"
          onClick={() => setTab('approvals')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer inline-flex items-center gap-1.5 ${
            tab === 'approvals'
              ? 'bg-white dark:bg-[#1B1417] text-[#1C1917] dark:text-slate-100 shadow-xs'
              : 'text-[#718096] dark:text-slate-400'
          }`}
        >
          <ShieldCheck className="h-3.5 w-3.5 text-[#DC2626]" />
          Approval Rules ({data.approvalRules.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('fields')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer inline-flex items-center gap-1.5 ${
            tab === 'fields'
              ? 'bg-white dark:bg-[#1B1417] text-[#1C1917] dark:text-slate-100 shadow-xs'
              : 'text-[#718096] dark:text-slate-400'
          }`}
        >
          <Sliders className="h-3.5 w-3.5 text-[#16B8A6]" />
          Custom Fields ({data.customFields.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('audit')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer inline-flex items-center gap-1.5 ${
            tab === 'audit'
              ? 'bg-white dark:bg-[#1B1417] text-[#1C1917] dark:text-slate-100 shadow-xs'
              : 'text-[#718096] dark:text-slate-400'
          }`}
        >
          <History className="h-3.5 w-3.5 text-[#F59E0B]" />
          Audit Trail ({data.auditLogs.length})
        </button>
      </div>

      {tab === 'approvals' && (
        <div className="space-y-4">
          <Surface padding="lg">
            <form onSubmit={handleAddRule} className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-[#1C1917] dark:text-slate-100">
                  Create Dynamic Approval Rule
                </h2>
                <p className="text-xs text-[#718096] dark:text-slate-400 mt-0.5">
                  Active Purchase rules automatically hold new Purchase Orders above the threshold in Draft until approved in Purchase & Procurement.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <input
                  type="text"
                  required
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder="Rule Name (e.g. High-Value PO Lock) *"
                  className="lg:col-span-2 h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
                <select
                  value={ruleModule}
                  onChange={(e) => setRuleModule(e.target.value as ApprovalRule['module'])}
                  className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                >
                  <option value="purchase">Purchase Orders</option>
                  <option value="expense">Expense Claims</option>
                  <option value="leave">Leave Requests</option>
                </select>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  placeholder={`Threshold (${currency})`}
                  className="h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
                <input
                  type="text"
                  value={approverRole}
                  onChange={(e) => setApproverRole(e.target.value)}
                  placeholder="Approver Role"
                  className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit" variant="primary" size="sm">
                  <Plus className="h-3.5 w-3.5" />
                  Add Approval Rule
                </Button>
              </div>
            </form>
          </Surface>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.approvalRules.length === 0 ? (
              <Surface className="md:col-span-2 text-xs text-[#718096] dark:text-slate-400">
                No approval rules configured yet. Add a Purchase rule above to enforce automated approval gates on large orders.
              </Surface>
            ) : (
              data.approvalRules.map((rule) => (
                <Surface key={rule.id} className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-[#1C1917] dark:text-slate-100">
                      {rule.name}
                    </div>
                    <div className="text-xs text-[#718096] dark:text-slate-400 mt-0.5">
                      Module: <span className="uppercase font-mono">{rule.module}</span> · Min:{' '}
                      <span className="font-mono font-semibold text-[#1C1917] dark:text-slate-200">
                        {formatNumericCurrency(rule.minAmount, currency, 2)}
                      </span>{' '}
                      · Approver: {rule.approverRole}
                    </div>
                  </div>
                  <Button
                    variant={rule.active ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => toggleApprovalRule(rule.id)}
                  >
                    {rule.active ? 'Active' : 'Paused'}
                  </Button>
                </Surface>
              ))
            )}
          </div>
        </div>
      )}

      {tab === 'fields' && (
        <div className="space-y-4">
          <Surface padding="lg">
            <form onSubmit={handleAddField} className="space-y-4">
              <h2 className="text-sm font-semibold text-[#1C1917] dark:text-slate-100">
                Custom Schema Field Builder
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-center">
                <select
                  value={fieldModule}
                  onChange={(e) => setFieldModule(e.target.value as CustomFieldDefinition['module'])}
                  className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                >
                  <option value="crm">CRM Contacts</option>
                  <option value="catalogue">Catalogue SKUs</option>
                  <option value="sales">Sales Invoices</option>
                  <option value="hrms">Employee Directory</option>
                </select>
                <input
                  type="text"
                  required
                  value={fieldLabel}
                  onChange={(e) => setFieldLabel(e.target.value)}
                  placeholder="Field Label (e.g. GSTIN / Tax ID) *"
                  className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
                <select
                  value={fieldType}
                  onChange={(e) => setFieldType(e.target.value as CustomFieldDefinition['fieldType'])}
                  className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                >
                  <option value="text">Text</option>
                  <option value="number">Numeric</option>
                  <option value="date">Date</option>
                  <option value="select">Dropdown Options</option>
                </select>
                {fieldType === 'select' ? (
                  <input
                    type="text"
                    value={optionsCsv}
                    onChange={(e) => setOptionsCsv(e.target.value)}
                    placeholder="Comma-separated options"
                    className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                  />
                ) : (
                  <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer px-2">
                    <input
                      type="checkbox"
                      checked={fieldRequired}
                      onChange={(e) => setFieldRequired(e.target.checked)}
                    />
                    Required Field
                  </label>
                )}
                <Button type="submit" variant="primary" size="sm" className="h-9">
                  <Plus className="h-3.5 w-3.5" />
                  Add Field
                </Button>
              </div>
            </form>
          </Surface>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.customFields.length === 0 ? (
              <Surface className="sm:col-span-2 lg:col-span-3 text-xs text-[#718096] dark:text-slate-400">
                No custom schema fields created yet.
              </Surface>
            ) : (
              data.customFields.map((f) => (
                <Surface key={f.id} className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-[#1C1917] dark:text-slate-100">
                      {f.fieldLabel}
                    </div>
                    <div className="text-[11px] font-mono text-[#718096] dark:text-slate-400 mt-0.5 uppercase">
                      {f.module} · {f.fieldType} {f.required ? '· required' : ''}
                    </div>
                    {f.optionsCsv && (
                      <div className="text-[11px] text-[#718096] mt-1">Options: {f.optionsCsv}</div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteCustomField(f.id)}
                    aria-label={`Delete ${f.fieldLabel}`}
                    className="p-1.5 text-[#718096] hover:text-red-600 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </Surface>
              ))
            )}
          </div>
        </div>
      )}

      {tab === 'audit' && (
        <DataTable
          data={data.auditLogs}
          columns={auditColumns}
          getRowKey={(r) => r.id}
          searchPlaceholder="Search action, resource, or actor role..."
          searchPredicate={(r, q) =>
            `${r.action} ${r.resourceType} ${r.actorRole} ${r.details}`.toLowerCase().includes(q)
          }
          emptyTitle="No audit events logged yet"
          emptyDescription="Transactions across Sales, Procurement, Inventory, Accounting, and Payroll automatically append immutable audit logs here."
        />
      )}
    </div>
  );
}
