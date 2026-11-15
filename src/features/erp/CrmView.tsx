import React, { useState } from 'react';
import {
  Kanban,
  List,
  MessageSquarePlus,
  Plus,
  Receipt,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { DataColumn, DataTable } from '@/src/components/ui/DataTable';
import { Surface } from '@/src/components/ui/Surface';
import { DonutChart, GroupedBarChart } from '@/src/components/charts/ErpCharts';
import { useErpData } from '@/src/components/shell/ErpDataProvider';
import { useTenant } from '@/src/components/shell/TenantProvider';
import { CrmActivity, CrmContact, CrmStage } from '@/src/core/store/erpTypes';
import { formatNumericCurrency } from '@/src/lib/utils';

const STAGES: CrmStage[] = ['lead', 'qualified', 'proposal', 'customer', 'lost'];

export function CrmView({ onNavigate }: { onNavigate: (routeId: string) => void }) {
  const { activeCompany } = useTenant();
  const {
    data,
    addContact,
    updateContactStage,
    addContactActivity,
    updateContactScore,
    deleteContact,
  } = useErpData();

  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [showForm, setShowForm] = useState(false);
  const [stageFilter, setStageFilter] = useState<'all' | CrmStage>('all');
  const [name, setName] = useState('');
  const [organization, setOrganization] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState<CrmContact['type']>('customer');
  const [stage, setStage] = useState<CrmStage>('lead');
  const [estimatedValue, setEstimatedValue] = useState('0');
  const [leadScore, setLeadScore] = useState('60');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Activity Drawer State
  const [activeContactId, setActiveContactId] = useState<string | null>(null);
  const [actType, setActType] = useState<CrmActivity['type']>('call');
  const [actSummary, setActSummary] = useState('');

  const currency = activeCompany.baseCurrency;
  const activeContact = data.contacts.find((c) => c.id === activeContactId) ?? null;

  const filtered =
    stageFilter === 'all'
      ? data.contacts
      : data.contacts.filter((c) => c.stage === stageFilter);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Contact name is required.');
      return;
    }
    addContact({
      name: name.trim(),
      organization: organization.trim() || name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      type,
      stage,
      estimatedValue: Math.max(0, Number(estimatedValue) || 0),
      leadScore: Math.max(0, Math.min(100, Number(leadScore) || 50)),
      loyaltyPoints: 0,
      activities: [],
      notes: notes.trim(),
    });
    setName('');
    setOrganization('');
    setEmail('');
    setPhone('');
    setEstimatedValue('0');
    setLeadScore('60');
    setNotes('');
    setShowForm(false);
  };

  const handleAddActivity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeContact || !actSummary.trim()) return;
    addContactActivity(activeContact.id, {
      date: new Date().toISOString().slice(0, 10),
      type: actType,
      summary: actSummary.trim(),
    });
    setActSummary('');
  };

  const columns: DataColumn<CrmContact>[] = [
    {
      key: 'name',
      header: 'Contact & Company',
      sortable: true,
      sortValue: (r) => r.name,
      render: (r) => (
        <div>
          <div className="font-semibold text-[#1C1917] dark:text-slate-100">{r.name}</div>
          <div className="text-[11px] text-[#718096] dark:text-slate-400">
            {r.organization} · <span className="capitalize">{r.type}</span>
            {(r.loyaltyPoints ?? 0) > 0 ? ` · ${r.loyaltyPoints} pts` : ''}
          </div>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Email / Phone',
      render: (r) => (
        <div className="text-xs">
          <div>{r.email || '—'}</div>
          <div className="text-[11px] text-[#718096] dark:text-slate-400 font-mono">
            {r.phone || '—'}
          </div>
        </div>
      ),
    },
    {
      key: 'score',
      header: 'Lead Score',
      align: 'right',
      numeric: true,
      sortable: true,
      sortValue: (r) => r.leadScore ?? 50,
      render: (r) => {
        const sc = r.leadScore ?? 50;
        return (
          <div className="inline-flex items-center gap-1.5 font-mono text-xs tabular-nums">
            <span
              className={`font-semibold ${
                sc >= 75
                  ? 'text-[#16B8A6]'
                  : sc >= 45
                    ? 'text-[#DC2626]'
                    : 'text-[#718096] dark:text-slate-400'
              }`}
            >
              {sc}/100
            </span>
            <button
              type="button"
              onClick={() => updateContactScore(r.id, sc + 10)}
              className="px-1 rounded text-[10px] border border-slate-200 dark:border-[#32242A] hover:bg-slate-100 dark:hover:bg-[#251B20] cursor-pointer"
              title="Increase lead score by 10"
            >
              +
            </button>
          </div>
        );
      },
    },
    {
      key: 'stage',
      header: 'Pipeline Stage',
      render: (r) => (
        <select
          value={r.stage}
          onChange={(e) => updateContactStage(r.id, e.target.value as CrmStage)}
          aria-label={`Stage for ${r.name}`}
          className="h-7 px-2 rounded-md text-xs bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A] capitalize cursor-pointer"
        >
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      ),
    },
    {
      key: 'value',
      header: 'Deal Value',
      align: 'right',
      numeric: true,
      sortable: true,
      sortValue: (r) => r.estimatedValue,
      render: (r) => <span>{formatNumericCurrency(r.estimatedValue, currency, 2)}</span>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => (
        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveContactId(r.id)}
            title="Open communication & activity timeline"
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-[#718096] dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#251B20] cursor-pointer whitespace-nowrap"
          >
            <MessageSquarePlus className="h-3 w-3" />
            Log ({r.activities?.length ?? 0})
          </button>
          <button
            type="button"
            onClick={() => onNavigate('module:sales')}
            title="Create quote or invoice"
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-[#DC2626] hover:bg-[#DC2626]/10 cursor-pointer whitespace-nowrap"
          >
            <Receipt className="h-3 w-3" />
            Bill
          </button>
          <button
            type="button"
            onClick={() => deleteContact(r.id)}
            aria-label={`Delete ${r.name}`}
            className="p-1.5 rounded-md text-[#718096] hover:text-red-600 cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1C1917] dark:text-slate-100">
            CRM & Pipeline
          </h1>
          <p className="mt-1 text-xs text-[#718096] dark:text-slate-400">
            Track leads, lead scores, Kanban deal stages, communication history, and loyalty points for {activeCompany.companyName}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-[#251B20]">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-[#1B1417] text-[#1C1917] dark:text-slate-100 shadow-xs'
                  : 'text-[#718096] dark:text-slate-400'
              }`}
            >
              <List className="h-3.5 w-3.5" />
              List
            </button>
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer ${
                viewMode === 'kanban'
                  ? 'bg-white dark:bg-[#1B1417] text-[#1C1917] dark:text-slate-100 shadow-xs'
                  : 'text-[#718096] dark:text-slate-400'
              }`}
            >
              <Kanban className="h-3.5 w-3.5" />
              Pipeline
            </button>
          </div>
          <Button variant="primary" size="sm" onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-4 w-4" />
            {showForm ? 'Close Form' : 'Add Contact / Lead'}
          </Button>
        </div>
      </div>

      {/* Live CRM Pipeline Charts */}
      {data.contacts.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Surface padding="lg" className="lg:col-span-2 space-y-3">
            <h2 className="text-sm font-semibold text-[#1C1917] dark:text-slate-100">
              Pipeline Deal Value by Stage
            </h2>
            <GroupedBarChart
              data={STAGES.map((st) => {
                const items = data.contacts.filter((c) => c.stage === st);
                return {
                  label: st.charAt(0).toUpperCase() + st.slice(1),
                  primary: items.reduce((s, c) => s + (c.estimatedValue || 0), 0),
                };
              })}
              primaryLabel={`Deal Value (${currency})`}
              primaryColor="#DC2626"
              formatValue={(v) => formatNumericCurrency(v, currency, 0)}
              height={190}
            />
          </Surface>

          <Surface padding="lg" className="space-y-3">
            <h2 className="text-sm font-semibold text-[#1C1917] dark:text-slate-100">
              Pipeline Count by Stage
            </h2>
            <DonutChart
              slices={[
                { label: 'Lead', value: data.contacts.filter((c) => c.stage === 'lead').length, color: '#F59E0B' },
                { label: 'Qualified', value: data.contacts.filter((c) => c.stage === 'qualified').length, color: '#EA580C' },
                { label: 'Proposal', value: data.contacts.filter((c) => c.stage === 'proposal').length, color: '#DC2626' },
                { label: 'Customer', value: data.contacts.filter((c) => c.stage === 'customer').length, color: '#16B8A6' },
                { label: 'Lost', value: data.contacts.filter((c) => c.stage === 'lost').length, color: '#94A3B8' },
              ]}
              centerLabel="Contacts"
              centerValue={String(data.contacts.length)}
              formatValue={(v) => `${v}`}
            />
          </Surface>
        </div>
      )}

      {/* Stage Filter (List mode) */}
      {viewMode === 'list' && (
        <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-[#251B20]">
          {(['all', ...STAGES] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStageFilter(tab)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize cursor-pointer whitespace-nowrap ${
                stageFilter === tab
                  ? 'bg-white dark:bg-[#1B1417] text-[#1C1917] dark:text-slate-100 shadow-xs'
                  : 'text-[#718096] dark:text-slate-400'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      )}

      {showForm && (
        <Surface padding="lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            <h2 className="text-sm font-semibold text-[#1C1917] dark:text-slate-100">
              New Contact / Lead
            </h2>
            {error && <p className="text-xs font-medium text-red-600">{error}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1">Full Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contact person name"
                  className="w-full h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Organization</label>
                <input
                  type="text"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="Company or business name"
                  className="w-full h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@company.com"
                  className="w-full h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Phone</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98..."
                  className="w-full h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Relationship Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as CrmContact['type'])}
                  className="w-full h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                >
                  <option value="customer">Customer</option>
                  <option value="vendor">Vendor / Supplier</option>
                  <option value="both">Both Customer & Vendor</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Pipeline Stage</label>
                <select
                  value={stage}
                  onChange={(e) => setStage(e.target.value as CrmStage)}
                  className="w-full h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A] capitalize"
                >
                  {STAGES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">
                  Estimated Value ({currency})
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={estimatedValue}
                  onChange={(e) => setEstimatedValue(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Lead Score (0–100)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={leadScore}
                  onChange={(e) => setLeadScore(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-4">
                <label className="block text-xs font-medium mb-1">Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional context or qualification summary"
                  className="w-full h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm">
                Save Contact
              </Button>
            </div>
          </form>
        </Surface>
      )}

      {viewMode === 'list' ? (
        <DataTable
          data={filtered}
          columns={columns}
          getRowKey={(r) => r.id}
          searchPlaceholder="Search contact name, company, or email..."
          searchPredicate={(r, q) =>
            `${r.name} ${r.organization} ${r.email} ${r.phone}`.toLowerCase().includes(q)
          }
          emptyTitle="No contacts in this view"
          emptyDescription="Add your customers, leads, or suppliers to use them in Sales Invoices and Purchase Orders."
          emptyActionLabel="Add Contact / Lead"
          onEmptyAction={() => setShowForm(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
          {STAGES.map((st) => {
            const items = data.contacts.filter((c) => c.stage === st);
            const stageTotal = items.reduce((s, c) => s + (c.estimatedValue || 0), 0);
            return (
              <Surface key={st} padding="sm" className="space-y-3 bg-[#FAF9F7]/60 dark:bg-[#141013]">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#32242A] pb-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#1C1917] dark:text-slate-100">
                    {st} ({items.length})
                  </span>
                  <span className="text-[11px] font-mono tabular-nums text-[#718096] dark:text-slate-400">
                    {formatNumericCurrency(stageTotal, currency, 0)}
                  </span>
                </div>
                <div className="space-y-2">
                  {items.length === 0 ? (
                    <div className="py-6 text-center text-[11px] text-[#718096] dark:text-slate-500">
                      Empty stage
                    </div>
                  ) : (
                    items.map((c) => (
                      <div
                        key={c.id}
                        className="p-3 rounded-lg bg-white dark:bg-[#1B1417] border border-slate-200 dark:border-[#32242A] space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-xs font-semibold truncate">{c.name}</div>
                            <div className="text-[11px] text-[#718096] dark:text-slate-400 truncate">
                              {c.organization}
                            </div>
                          </div>
                          <span className="text-[11px] font-mono tabular-nums font-semibold text-[#DC2626]">
                            {c.leadScore ?? 50}
                          </span>
                        </div>
                        <div className="text-xs font-mono tabular-nums font-semibold text-[#16B8A6]">
                          {formatNumericCurrency(c.estimatedValue, currency, 0)}
                        </div>
                        <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-200/70 dark:border-[#32242A]">
                          <select
                            value={c.stage}
                            onChange={(e) => updateContactStage(c.id, e.target.value as CrmStage)}
                            aria-label={`Move ${c.name}`}
                            className="h-6 px-1.5 rounded text-[11px] bg-[#FAF9F7] dark:bg-[#141013] border border-slate-200 dark:border-[#32242A] capitalize cursor-pointer"
                          >
                            {STAGES.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => setActiveContactId(c.id)}
                            className="text-[11px] text-[#DC2626] hover:underline cursor-pointer"
                          >
                            Activity ({c.activities?.length ?? 0})
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Surface>
            );
          })}
        </div>
      )}

      {/* Activity & Communication Timeline Drawer */}
      {activeContact && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-[#1B1417]/50"
          role="dialog"
          aria-modal="true"
          onClick={() => setActiveContactId(null)}
        >
          <div
            className="w-full max-w-md h-full bg-white dark:bg-[#1B1417] border-l border-slate-200 dark:border-[#32242A] p-5 flex flex-col gap-4 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-[#32242A] pb-3">
              <div>
                <h2 className="text-base font-bold text-[#1C1917] dark:text-slate-100">
                  {activeContact.name}
                </h2>
                <p className="text-xs text-[#718096] dark:text-slate-400">
                  {activeContact.organization} · Score {activeContact.leadScore ?? 50}/100 ·{' '}
                  {activeContact.loyaltyPoints ?? 0} loyalty pts
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveContactId(null)}
                aria-label="Close timeline"
                className="p-1.5 text-[#718096] hover:text-[#1C1917] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddActivity} className="space-y-2.5 border-b border-slate-200 dark:border-[#32242A] pb-4">
              <div className="flex gap-2">
                <select
                  value={actType}
                  onChange={(e) => setActType(e.target.value as CrmActivity['type'])}
                  className="h-8 px-2 rounded-md text-xs bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                >
                  <option value="call">Phone Call</option>
                  <option value="email">Email</option>
                  <option value="meeting">Meeting</option>
                  <option value="note">Internal Note</option>
                </select>
                <input
                  type="text"
                  required
                  value={actSummary}
                  onChange={(e) => setActSummary(e.target.value)}
                  placeholder="Summary of interaction..."
                  className="flex-1 h-8 px-2.5 rounded-md text-xs bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit" variant="primary" size="sm">
                  Log Interaction
                </Button>
              </div>
            </form>

            <div className="space-y-3 flex-1">
              <div className="text-xs font-semibold text-[#1C1917] dark:text-slate-100">
                Communication Timeline
              </div>
              {(activeContact.activities ?? []).length === 0 ? (
                <p className="text-xs text-[#718096] dark:text-slate-400">
                  No calls, emails, or meetings logged yet.
                </p>
              ) : (
                <div className="divide-y divide-slate-200/70 dark:divide-[#32242A]">
                  {(activeContact.activities ?? []).map((act) => (
                    <div key={act.id} className="py-2.5 space-y-0.5">
                      <div className="flex items-center justify-between text-[11px] text-[#718096] dark:text-slate-400">
                        <span className="uppercase font-semibold text-[#DC2626]">{act.type}</span>
                        <span className="font-mono">{act.date}</span>
                      </div>
                      <div className="text-xs text-[#1C1917] dark:text-slate-200">{act.summary}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
