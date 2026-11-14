import React, { useState } from 'react';
import { Download, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { DataColumn, DataTable } from '@/src/components/ui/DataTable';
import { Surface } from '@/src/components/ui/Surface';
import { useErpData } from '@/src/components/shell/ErpDataProvider';
import { useTenant } from '@/src/components/shell/TenantProvider';
import { LedgerEntry, LedgerEntryType } from '@/src/core/store/erpTypes';
import { formatNumericCurrency } from '@/src/lib/utils';

export function AccountingView() {
  const { activeCompany } = useTenant();
  const { data, metrics, addLedgerEntry, deleteLedgerEntry } = useErpData();
  const currency = activeCompany.baseCurrency;
  const today = new Date().toISOString().slice(0, 10);

  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState<'all' | LedgerEntryType>('all');
  const [date, setDate] = useState(today);
  const [entryType, setEntryType] = useState<LedgerEntryType>('expense');
  const [accountName, setAccountName] = useState('Operating Expense');
  const [amount, setAmount] = useState('0');
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const filtered =
    filterType === 'all'
      ? data.ledgerEntries
      : data.ledgerEntries.filter((e) => e.entryType === filterType);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const numAmount = Number(amount);
    if (!accountName.trim() || !numAmount || numAmount <= 0) {
      setError('Account name and positive amount are required.');
      return;
    }
    addLedgerEntry({
      date,
      accountName: accountName.trim(),
      entryType,
      amount: numAmount,
      reference: reference.trim() || `JV-${String(data.ledgerEntries.length + 1).padStart(4, '0')}`,
      description: description.trim() || 'Manual ledger voucher',
    });
    setAmount('0');
    setReference('');
    setDescription('');
    setShowForm(false);
  };

  const exportCsv = () => {
    const header = ['Date', 'Reference', 'Account', 'Type', 'Amount', 'Source', 'Description'];
    const rows = data.ledgerEntries.map((e) => [
      e.date,
      e.reference,
      e.accountName,
      e.entryType,
      e.amount.toFixed(2),
      e.sourceModule,
      `"${e.description.replace(/"/g, '""')}"`,
    ]);
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeCompany.companyCode.toLowerCase()}-ledger.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns: DataColumn<LedgerEntry>[] = [
    {
      key: 'date',
      header: 'Date & Ref',
      sortable: true,
      sortValue: (r) => r.date,
      render: (r) => (
        <div>
          <div className="font-mono text-xs">{r.date}</div>
          <div className="font-mono text-[11px] text-[#718096] dark:text-slate-400">
            {r.reference}
          </div>
        </div>
      ),
    },
    {
      key: 'account',
      header: 'Account & Description',
      render: (r) => (
        <div>
          <div className="font-semibold text-[#182238] dark:text-slate-100">
            {r.accountName}
          </div>
          <div className="text-[11px] text-[#718096] dark:text-slate-400">
            {r.description} · <span className="capitalize">{r.sourceModule}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (r) => (
        <span
          className={`text-xs font-medium capitalize ${
            r.entryType === 'income' ? 'text-[#16B8A6]' : 'text-[#718096] dark:text-slate-300'
          }`}
        >
          {r.entryType}
        </span>
      ),
    },
    {
      key: 'amount',
      header: `Amount (${currency})`,
      align: 'right',
      numeric: true,
      sortable: true,
      sortValue: (r) => r.amount,
      render: (r) => (
        <span
          className={`font-semibold ${
            r.entryType === 'income' ? 'text-[#16B8A6]' : ''
          }`}
        >
          {r.entryType === 'income' ? '+' : '-'}
          {formatNumericCurrency(r.amount, currency, 2)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => (
        <button
          type="button"
          onClick={() => deleteLedgerEntry(r.id)}
          aria-label={`Delete ${r.reference}`}
          className="p-1.5 rounded-md text-[#718096] hover:text-red-600 cursor-pointer"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#182238] dark:text-slate-100">
            Accounting & Finance Ledger
          </h1>
          <p className="mt-1 text-xs text-[#718096] dark:text-slate-400">
            Track income, expenses, journal vouchers, and real-time profit & loss for {activeCompany.companyName}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data.ledgerEntries.length > 0 && (
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-4 w-4" />
            {showForm ? 'Close Voucher' : 'Record Voucher'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Surface>
          <div className="text-xs text-[#718096] dark:text-slate-400">Total Income</div>
          <div className="mt-1 text-xl font-bold font-mono tabular-nums text-[#16B8A6]">
            {formatNumericCurrency(metrics.totalRevenue, currency, 2)}
          </div>
        </Surface>
        <Surface>
          <div className="text-xs text-[#718096] dark:text-slate-400">Total Expenses</div>
          <div className="mt-1 text-xl font-bold font-mono tabular-nums text-[#182238] dark:text-slate-100">
            {formatNumericCurrency(metrics.totalExpenses, currency, 2)}
          </div>
        </Surface>
        <Surface>
          <div className="text-xs text-[#718096] dark:text-slate-400">Net Profit / Loss</div>
          <div
            className={`mt-1 text-xl font-bold font-mono tabular-nums ${
              metrics.netIncome >= 0 ? 'text-[#4169F5]' : 'text-red-600 dark:text-red-400'
            }`}
          >
            {formatNumericCurrency(metrics.netIncome, currency, 2)}
          </div>
        </Surface>
      </div>

      {showForm && (
        <Surface padding="lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            <h2 className="text-sm font-semibold">New Journal / Cash Voucher</h2>
            {error && <p className="text-xs font-medium text-red-600">{error}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1">Entry Type</label>
                <select
                  value={entryType}
                  onChange={(e) => {
                    const next = e.target.value as LedgerEntryType;
                    setEntryType(next);
                    setAccountName(next === 'income' ? 'Other Income' : 'Operating Expense');
                  }}
                  className="w-full h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                  <option value="asset">Asset</option>
                  <option value="liability">Liability</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Account Name *</label>
                <input
                  type="text"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Amount ({currency}) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Reference</label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Optional ref"
                  className="w-full h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Description / Narration</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Office rent, utilities, or bank transfer"
                className="w-full h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm">
                Post to Ledger
              </Button>
            </div>
          </form>
        </Surface>
      )}

      <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-[#162342]">
        {(['all', 'income', 'expense', 'asset', 'liability'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setFilterType(tab)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize cursor-pointer whitespace-nowrap ${
              filterType === tab
                ? 'bg-white dark:bg-[#101B35] text-[#182238] dark:text-slate-100 shadow-xs'
                : 'text-[#718096] dark:text-slate-400'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <DataTable
        data={filtered}
        columns={columns}
        getRowKey={(r) => r.id}
        searchPlaceholder="Search account, reference, or description..."
        searchPredicate={(r, q) =>
          `${r.accountName} ${r.reference} ${r.description}`.toLowerCase().includes(q)
        }
        emptyTitle="No ledger entries yet"
        emptyDescription="Record a manual income/expense voucher or mark a Sales Invoice Paid / Purchase Order Received to post entries."
        emptyActionLabel="Record Voucher"
        onEmptyAction={() => setShowForm(true)}
      />
    </div>
  );
}
