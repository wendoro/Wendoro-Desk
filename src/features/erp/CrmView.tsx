import React, { useState } from 'react';
import { Plus, Receipt, Trash2 } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { DataColumn, DataTable } from '@/src/components/ui/DataTable';
import { Surface } from '@/src/components/ui/Surface';
import { useErpData } from '@/src/components/shell/ErpDataProvider';
import { useTenant } from '@/src/components/shell/TenantProvider';
import { CrmContact, CrmStage } from '@/src/core/store/erpTypes';
import { formatNumericCurrency } from '@/src/lib/utils';

const STAGES: CrmStage[] = ['lead', 'qualified', 'proposal', 'customer', 'lost'];

export function CrmView({ onNavigate }: { onNavigate: (routeId: string) => void }) {
  const { activeCompany } = useTenant();
  const { data, addContact, updateContactStage, deleteContact } = useErpData();

  const [showForm, setShowForm] = useState(false);
  const [stageFilter, setStageFilter] = useState<'all' | CrmStage>('all');
  const [name, setName] = useState('');
  const [organization, setOrganization] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState<CrmContact['type']>('customer');
  const [stage, setStage] = useState<CrmStage>('lead');
  const [estimatedValue, setEstimatedValue] = useState('0');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const currency = activeCompany.baseCurrency;

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
      notes: notes.trim(),
    });
    setName('');
    setOrganization('');
    setEmail('');
    setPhone('');
    setEstimatedValue('0');
    setNotes('');
    setShowForm(false);
  };

  const columns: DataColumn<CrmContact>[] = [
    {
      key: 'name',
      header: 'Contact & Company',
      sortable: true,
      sortValue: (r) => r.name,
      render: (r) => (
        <div>
          <div className="font-semibold text-[#182238] dark:text-slate-100">{r.name}</div>
          <div className="text-[11px] text-[#718096] dark:text-slate-400">
            {r.organization} · <span className="capitalize">{r.type}</span>
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
      key: 'stage',
      header: 'Pipeline Stage',
      render: (r) => (
        <select
          value={r.stage}
          onChange={(e) => updateContactStage(r.id, e.target.value as CrmStage)}
          aria-label={`Stage for ${r.name}`}
          className="h-7 px-2 rounded-md text-xs bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257] capitalize cursor-pointer"
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
            onClick={() => onNavigate('module:sales')}
            title="Create quote or invoice"
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-[#4169F5] hover:bg-[#4169F5]/10 cursor-pointer whitespace-nowrap"
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
          <h1 className="text-2xl font-bold tracking-tight text-[#182238] dark:text-slate-100">
            CRM & Contacts
          </h1>
          <p className="mt-1 text-xs text-[#718096] dark:text-slate-400">
            Manage leads, customers, vendors, and pipeline deal values for {activeCompany.companyName}.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4" />
          {showForm ? 'Close Form' : 'Add Contact / Lead'}
        </Button>
      </div>

      {/* Stage Filter */}
      <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-[#162342]">
        {(['all', ...STAGES] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setStageFilter(tab)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize cursor-pointer whitespace-nowrap ${
              stageFilter === tab
                ? 'bg-white dark:bg-[#101B35] text-[#182238] dark:text-slate-100 shadow-xs'
                : 'text-[#718096] dark:text-slate-400'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {showForm && (
        <Surface padding="lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            <h2 className="text-sm font-semibold text-[#182238] dark:text-slate-100">
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
                  className="w-full h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Organization</label>
                <input
                  type="text"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="Company or business name"
                  className="w-full h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@company.com"
                  className="w-full h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Phone</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98..."
                  className="w-full h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Relationship Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as CrmContact['type'])}
                  className="w-full h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
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
                  className="w-full h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257] capitalize"
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
                  className="w-full h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional context"
                  className="w-full h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
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
    </div>
  );
}
