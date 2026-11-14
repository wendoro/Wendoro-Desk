import React, { useMemo, useState } from 'react';
import { Download, Lock, Plus, RotateCcw, Unlock } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { DataColumn, DataTable } from '@/src/components/ui/DataTable';
import { Surface } from '@/src/components/ui/Surface';
import { useErpData } from '@/src/components/shell/ErpDataProvider';
import { useTenant } from '@/src/components/shell/TenantProvider';
import { JournalEntry } from '@/src/core/store/erpTypes';
import { formatNumericCurrency } from '@/src/lib/utils';

type AccountingTab = 'journals' | 'trial_balance' | 'periods';

interface DraftLineRow {
  key: string;
  accountCode: string;
  debit: string;
  credit: string;
  memo: string;
}

function createDraftRow(accountCode = '5300'): DraftLineRow {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    accountCode,
    debit: '0',
    credit: '0',
    memo: '',
  };
}

export function AccountingView() {
  const { activeCompany } = useTenant();
  const {
    data,
    metrics,
    trialBalance,
    postBalancedJournal,
    reverseJournal,
    toggleFiscalPeriod,
  } = useErpData();
  const currency = activeCompany.baseCurrency;
  const today = new Date().toISOString().slice(0, 10);

  const [tab, setTab] = useState<AccountingTab>('journals');
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState(today);
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');
  const [draftLines, setDraftLines] = useState<DraftLineRow[]>([
    { ...createDraftRow('5300'), debit: '0', credit: '0', memo: 'Expense debit' },
    { ...createDraftRow('1000'), debit: '0', credit: '0', memo: 'Cash/Bank credit' },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const draftBalance = useMemo(() => {
    const totalDebit = draftLines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
    const totalCredit = draftLines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
    return {
      totalDebit,
      totalCredit,
      isBalanced: totalDebit > 0 && Math.abs(totalDebit - totalCredit) < 0.005,
    };
  }, [draftLines]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    try {
      const journal = postBalancedJournal({
        date,
        reference: reference.trim(),
        description: description.trim() || 'Manual double-entry journal',
        lines: draftLines.map((l) => ({
          accountCode: l.accountCode,
          debit: Math.max(0, Number(l.debit) || 0),
          credit: Math.max(0, Number(l.credit) || 0),
          memo: l.memo.trim() || undefined,
        })),
      });
      setReference('');
      setDescription('');
      setDraftLines([createDraftRow('5300'), createDraftRow('1000')]);
      setShowForm(false);
      setNotice(`Posted balanced journal ${journal.journalNumber} (${journal.reference}).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post journal.');
    }
  };

  const handleReverse = (journal: JournalEntry) => {
    setError(null);
    setNotice(null);
    try {
      const rev = reverseJournal(journal.id, `Operator reversal of ${journal.journalNumber}`);
      setNotice(`Posted reversal journal ${rev.journalNumber} offsetting ${journal.journalNumber}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reverse journal.');
    }
  };

  const exportCsv = () => {
    const header = [
      'JournalNo',
      'Date',
      'Period',
      'Reference',
      'Source',
      'AccountCode',
      'AccountName',
      'Debit',
      'Credit',
      'Status',
      'Description',
    ];
    const rows: string[][] = [];
    for (const j of data.journals) {
      const periodCode =
        data.fiscalPeriods.find((fp) => fp.id === j.fiscalPeriodId)?.code ?? j.date.slice(0, 7);
      for (const l of j.lines) {
        rows.push([
          j.journalNumber,
          j.date,
          periodCode,
          j.reference,
          j.sourceModule,
          l.accountCode,
          `"${l.accountName.replace(/"/g, '""')}"`,
          l.debit.toFixed(2),
          l.credit.toFixed(2),
          j.status,
          `"${j.description.replace(/"/g, '""')}"`,
        ]);
      }
    }
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeCompany.companyCode.toLowerCase()}-double-entry-ledger.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const journalColumns: DataColumn<JournalEntry>[] = [
    {
      key: 'num',
      header: 'Journal & Date',
      sortable: true,
      sortValue: (r) => r.date,
      render: (r) => (
        <div>
          <div className="font-mono text-xs font-semibold text-[#182238] dark:text-slate-100">
            {r.journalNumber} · {r.reference}
          </div>
          <div className="font-mono text-[11px] text-[#718096] dark:text-slate-400">
            {r.date} · Period{' '}
            {data.fiscalPeriods.find((fp) => fp.id === r.fiscalPeriodId)?.code ??
              r.date.slice(0, 7)}
          </div>
        </div>
      ),
    },
    {
      key: 'lines',
      header: 'Double-Entry Postings',
      render: (r) => (
        <div className="space-y-1">
          <div className="text-xs font-medium text-[#182238] dark:text-slate-100">
            {r.description}{' '}
            <span className="text-[11px] text-[#718096] dark:text-slate-400 capitalize">
              ({r.sourceModule})
            </span>
          </div>
          <div className="space-y-0.5">
            {r.lines.map((l) => (
              <div
                key={l.id}
                className="flex items-center justify-between gap-4 text-[11px] font-mono tabular-nums text-[#718096] dark:text-slate-300"
              >
                <span className="truncate">
                  {l.accountCode} {l.accountName}
                </span>
                <span className="shrink-0">
                  {l.debit > 0
                    ? `DR ${formatNumericCurrency(l.debit, currency, 2)}`
                    : `CR ${formatNumericCurrency(l.credit, currency, 2)}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      key: 'total',
      header: `Balanced (${currency})`,
      align: 'right',
      numeric: true,
      sortable: true,
      sortValue: (r) => r.totalDebit,
      render: (r) => (
        <div>
          <div className="font-semibold font-mono tabular-nums">
            {formatNumericCurrency(r.totalDebit, currency, 2)}
          </div>
          <div
            className={`text-[11px] capitalize ${
              r.status === 'reversed' ? 'text-amber-600 dark:text-amber-400' : 'text-[#16B8A6]'
            }`}
          >
            {r.status}
          </div>
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) =>
        r.status === 'posted' && !r.reversedByJournalId ? (
          <button
            type="button"
            onClick={() => handleReverse(r)}
            title="Post compensating reversal journal"
            aria-label={`Reverse ${r.journalNumber}`}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-[#718096] hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reverse
          </button>
        ) : (
          <span className="text-[11px] text-[#718096] dark:text-slate-400">Immutable</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#182238] dark:text-slate-100">
            Double-Entry General Ledger
          </h1>
          <p className="mt-1 text-xs text-[#718096] dark:text-slate-400">
            Balanced journals, separate AR/AP & tax control accounts, inventory asset valuation, fiscal period locks, and immutable reversals for {activeCompany.companyName}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data.journals.length > 0 && (
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-4 w-4" />
            {showForm ? 'Close Journal' : 'New Balanced Journal'}
          </Button>
        </div>
      </div>

      {error && (
        <Surface padding="sm" className="text-xs font-medium text-red-600 dark:text-red-400 border-red-300 dark:border-red-900">
          {error}
        </Surface>
      )}
      {notice && (
        <Surface padding="sm" className="text-xs font-medium text-[#16B8A6]">
          {notice}
        </Surface>
      )}

      {/* Financial Control KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Surface>
          <div className="text-xs text-[#718096] dark:text-slate-400">Sales & Revenue</div>
          <div className="mt-1 text-lg font-bold font-mono tabular-nums text-[#16B8A6]">
            {formatNumericCurrency(metrics.totalRevenue, currency, 2)}
          </div>
        </Surface>
        <Surface>
          <div className="text-xs text-[#718096] dark:text-slate-400">COGS & Expenses</div>
          <div className="mt-1 text-lg font-bold font-mono tabular-nums text-[#182238] dark:text-slate-100">
            {formatNumericCurrency(metrics.totalExpenses, currency, 2)}
          </div>
        </Surface>
        <Surface>
          <div className="text-xs text-[#718096] dark:text-slate-400">AR / AP Balance</div>
          <div className="mt-1 text-xs font-mono tabular-nums space-y-0.5">
            <div className="text-[#4169F5] font-semibold">
              AR: {formatNumericCurrency(metrics.openReceivables, currency, 2)}
            </div>
            <div className="text-[#718096] dark:text-slate-300">
              AP: {formatNumericCurrency(metrics.openPayables, currency, 2)}
            </div>
          </div>
        </Surface>
        <Surface>
          <div className="text-xs text-[#718096] dark:text-slate-400">Inventory Asset (1300)</div>
          <div className="mt-1 text-lg font-bold font-mono tabular-nums text-[#182238] dark:text-slate-100">
            {formatNumericCurrency(metrics.inventoryAssetValue, currency, 2)}
          </div>
        </Surface>
        <Surface>
          <div className="text-xs text-[#718096] dark:text-slate-400">Net Tax Liability</div>
          <div className="mt-1 text-lg font-bold font-mono tabular-nums text-[#182238] dark:text-slate-100">
            {formatNumericCurrency(metrics.taxLiabilityNet, currency, 2)}
          </div>
          <div className="text-[11px] text-[#718096] dark:text-slate-400">
            Trial Balance: {trialBalance.isBalanced ? 'Balanced' : 'Out of Balance'}
          </div>
        </Surface>
      </div>

      {/* Double-Entry Journal Builder */}
      {showForm && (
        <Surface padding="lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Balanced Double-Entry Journal</h2>
              <span
                className={`text-xs font-mono tabular-nums font-semibold ${
                  draftBalance.isBalanced ? 'text-[#16B8A6]' : 'text-amber-600 dark:text-amber-400'
                }`}
              >
                DR {formatNumericCurrency(draftBalance.totalDebit, currency, 2)} / CR{' '}
                {formatNumericCurrency(draftBalance.totalCredit, currency, 2)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1">Posting Date</label>
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
                  placeholder="Optional ref (auto if blank)"
                  className="w-full h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Description / Narration</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Office rent, equity capital, or accrual"
                  className="w-full h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">Journal Lines (Minimum 2)</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDraftLines((prev) => [...prev, createDraftRow('1000')])}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Line
                </Button>
              </div>
              {draftLines.map((row) => (
                <div
                  key={row.key}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-2 rounded-lg border border-slate-200 dark:border-[#223257] bg-[#F6F8FC]/60 dark:bg-[#0E172E]"
                >
                  <div className="sm:col-span-5">
                    <select
                      value={row.accountCode}
                      onChange={(e) =>
                        setDraftLines((prev) =>
                          prev.map((x) =>
                            x.key === row.key ? { ...x, accountCode: e.target.value } : x,
                          ),
                        )
                      }
                      className="w-full h-8 px-2 rounded-md text-xs bg-white dark:bg-[#101B35] border border-slate-200 dark:border-[#223257]"
                    >
                      {data.accounts.map((acc) => (
                        <option key={acc.id} value={acc.code}>
                          {acc.code} · {acc.name} ({acc.category})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={row.debit}
                      onChange={(e) =>
                        setDraftLines((prev) =>
                          prev.map((x) =>
                            x.key === row.key ? { ...x, debit: e.target.value, credit: '0' } : x,
                          ),
                        )
                      }
                      placeholder="Debit"
                      aria-label="Debit amount"
                      className="w-full h-8 px-2 rounded-md text-xs font-mono bg-white dark:bg-[#101B35] border border-slate-200 dark:border-[#223257]"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={row.credit}
                      onChange={(e) =>
                        setDraftLines((prev) =>
                          prev.map((x) =>
                            x.key === row.key ? { ...x, credit: e.target.value, debit: '0' } : x,
                          ),
                        )
                      }
                      placeholder="Credit"
                      aria-label="Credit amount"
                      className="w-full h-8 px-2 rounded-md text-xs font-mono bg-white dark:bg-[#101B35] border border-slate-200 dark:border-[#223257]"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <input
                      type="text"
                      value={row.memo}
                      onChange={(e) =>
                        setDraftLines((prev) =>
                          prev.map((x) =>
                            x.key === row.key ? { ...x, memo: e.target.value } : x,
                          ),
                        )
                      }
                      placeholder="Line memo"
                      className="w-full h-8 px-2 rounded-md text-xs bg-white dark:bg-[#101B35] border border-slate-200 dark:border-[#223257]"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm">
                Post Balanced Journal
              </Button>
            </div>
          </form>
        </Surface>
      )}

      {/* Tabs */}
      <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-[#162342]">
        {(
          [
            { id: 'journals', label: `Journals (${data.journals.length})` },
            { id: 'trial_balance', label: 'Trial Balance & COA' },
            { id: 'periods', label: `Fiscal Periods (${data.fiscalPeriods.length})` },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap ${
              tab === t.id
                ? 'bg-white dark:bg-[#101B35] text-[#182238] dark:text-slate-100 shadow-xs'
                : 'text-[#718096] dark:text-slate-400'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'journals' && (
        <DataTable
          data={data.journals}
          columns={journalColumns}
          getRowKey={(r) => r.id}
          searchPlaceholder="Search journal number, reference, or description..."
          searchPredicate={(r, q) =>
            `${r.journalNumber} ${r.reference} ${r.description} ${r.sourceModule}`
              .toLowerCase()
              .includes(q)
          }
          emptyTitle="No posted journals yet"
          emptyDescription="Post a balanced manual journal or process Sales invoices, Purchase GRNs, or Payroll runs to populate the double-entry ledger."
          emptyActionLabel="New Balanced Journal"
          onEmptyAction={() => setShowForm(true)}
        />
      )}

      {tab === 'trial_balance' && (
        <Surface padding="none" className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#EFF3FA]/70 dark:bg-[#162342] text-[#718096] dark:text-slate-300 border-b border-slate-200 dark:border-[#223257]">
              <tr>
                <th className="px-4 py-3 font-semibold">Code</th>
                <th className="px-4 py-3 font-semibold">Account</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold text-right">Debit</th>
                <th className="px-4 py-3 font-semibold text-right">Credit</th>
                <th className="px-4 py-3 font-semibold text-right">Net Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-[#223257]">
              {trialBalance.rows.map((row) => (
                <tr key={row.accountId}>
                  <td className="px-4 py-2.5 font-mono font-semibold">{row.code}</td>
                  <td className="px-4 py-2.5 font-medium">{row.name}</td>
                  <td className="px-4 py-2.5 capitalize text-[#718096] dark:text-slate-400">
                    {row.category}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                    {formatNumericCurrency(row.totalDebit, currency, 2)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                    {formatNumericCurrency(row.totalCredit, currency, 2)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums">
                    {formatNumericCurrency(row.netBalance, currency, 2)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-[#EFF3FA]/60 dark:bg-[#162342] border-t border-slate-200 dark:border-[#223257] font-mono font-bold tabular-nums">
              <tr>
                <td colSpan={3} className="px-4 py-3">
                  Trial Balance Totals
                </td>
                <td className="px-4 py-3 text-right">
                  {formatNumericCurrency(trialBalance.totalDebits, currency, 2)}
                </td>
                <td className="px-4 py-3 text-right">
                  {formatNumericCurrency(trialBalance.totalCredits, currency, 2)}
                </td>
                <td className="px-4 py-3 text-right text-[#16B8A6]">
                  {trialBalance.isBalanced ? 'Balanced (0.00 diff)' : 'Imbalance'}
                </td>
              </tr>
            </tfoot>
          </table>
        </Surface>
      )}

      {tab === 'periods' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.fiscalPeriods.length === 0 ? (
            <Surface className="sm:col-span-2 lg:col-span-3 text-xs text-[#718096] dark:text-slate-400">
              Fiscal periods are created automatically when journals are posted.
            </Surface>
          ) : (
            data.fiscalPeriods.map((fp) => (
              <Surface key={fp.id} className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-mono text-sm font-bold">{fp.code}</div>
                  <div className="text-[11px] text-[#718096] dark:text-slate-400">
                    {fp.startDate} to {fp.endDate} ·{' '}
                    <span
                      className={
                        fp.status === 'open'
                          ? 'text-[#16B8A6] font-semibold'
                          : 'text-amber-600 dark:text-amber-400 font-semibold'
                      }
                    >
                      {fp.status.toUpperCase()}
                    </span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    toggleFiscalPeriod(fp.code, fp.status === 'open' ? 'closed' : 'open')
                  }
                >
                  {fp.status === 'open' ? (
                    <>
                      <Lock className="h-3.5 w-3.5" />
                      Close Period
                    </>
                  ) : (
                    <>
                      <Unlock className="h-3.5 w-3.5" />
                      Reopen
                    </>
                  )}
                </Button>
              </Surface>
            ))
          )}
        </div>
      )}
    </div>
  );
}
