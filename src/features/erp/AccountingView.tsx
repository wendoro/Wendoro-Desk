import React, { useMemo, useState } from 'react';
import {
  Building,
  CheckCircle2,
  Download,
  Landmark,
  Lock,
  PiggyBank,
  Plus,
  Receipt,
  RotateCcw,
  Trash2,
  Unlock,
} from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { DataColumn, DataTable } from '@/src/components/ui/DataTable';
import { Surface } from '@/src/components/ui/Surface';
import { DonutChart, GroupedBarChart } from '@/src/components/charts/ErpCharts';
import { useErpData } from '@/src/components/shell/ErpDataProvider';
import { useTenant } from '@/src/components/shell/TenantProvider';
import { buildBalanceCompositionSlices } from '@/src/core/engine/chartDataHelpers';
import { JournalEntry } from '@/src/core/store/erpTypes';
import { formatNumericCurrency } from '@/src/lib/utils';

type AccountingTab =
  | 'journals'
  | 'trial_balance'
  | 'statements'
  | 'fixed_assets'
  | 'budgets'
  | 'expenses'
  | 'bank_recon'
  | 'periods';

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
  const { activeCompany, principal } = useTenant();
  const {
    data,
    metrics,
    trialBalance,
    financialStatements,
    agingReport,
    postBalancedJournal,
    reverseJournal,
    toggleFiscalPeriod,
    registerFixedAsset,
    runMonthlyDepreciation,
    addBudget,
    deleteBudget,
    addExpenseClaim,
    approveExpenseClaim,
    addBankTransaction,
    reconcileBankTransaction,
  } = useErpData();
  const currency = activeCompany.baseCurrency;
  const today = new Date().toISOString().slice(0, 10);
  const currentPeriod = today.slice(0, 7);

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

  // Fixed Assets State
  const [assetName, setAssetName] = useState('');
  const [assetCategory, setAssetCategory] = useState('Machinery & Equipment');
  const [assetDate, setAssetDate] = useState(today);
  const [assetCost, setAssetCost] = useState('12000');
  const [assetSalvage, setAssetSalvage] = useState('0');
  const [assetLife, setAssetLife] = useState('36');
  const [assetPostJournal, setAssetPostJournal] = useState(true);
  const [assetPayAcct, setAssetPayAcct] = useState<'1000' | '2100'>('1000');
  const [deprPeriod, setDeprPeriod] = useState(currentPeriod);

  // Budgets State
  const [budPeriod, setBudPeriod] = useState(currentPeriod);
  const [budCostCenter, setBudCostCenter] = useState('Operations');
  const [budAcctCode, setBudAcctCode] = useState('5300');
  const [budAmount, setBudAmount] = useState('5000');
  const [budNotes, setBudNotes] = useState('');

  // Expense Claim State
  const [expEmp, setExpEmp] = useState(principal.fullName);
  const [expCat, setExpCat] = useState('Travel & Meals');
  const [expDate, setExpDate] = useState(today);
  const [expAmt, setExpAmt] = useState('0');
  const [expTax, setExpTax] = useState('0');
  const [expDesc, setExpDesc] = useState('');

  // Bank Recon State
  const [bankDate, setBankDate] = useState(today);
  const [bankDesc, setBankDesc] = useState('');
  const [bankRef, setBankRef] = useState('');
  const [bankDir, setBankDir] = useState<'credit' | 'debit'>('credit');
  const [bankAmt, setBankAmt] = useState('0');
  const [reconSelections, setReconSelections] = useState<Record<string, string>>({});

  const draftBalance = useMemo(() => {
    const totalDebit = draftLines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
    const totalCredit = draftLines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
    return {
      totalDebit,
      totalCredit,
      isBalanced: totalDebit > 0 && Math.abs(totalDebit - totalCredit) < 0.005,
    };
  }, [draftLines]);

  const taxSummary = useMemo(() => {
    const byCode = new Map(trialBalance.rows.map((r) => [r.code, r.netBalance]));
    const outputTax = byCode.get('2200') ?? 0;
    const inputTax = byCode.get('1400') ?? 0;
    return { outputTax, inputTax, net: outputTax - inputTax };
  }, [trialBalance.rows]);

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

  const handleRegisterAsset = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    try {
      const created = registerFixedAsset({
        name: assetName,
        category: assetCategory,
        purchaseDate: assetDate,
        purchaseCost: Number(assetCost) || 0,
        salvageValue: Number(assetSalvage) || 0,
        usefulLifeMonths: Math.max(1, Number(assetLife) || 12),
        postAcquisitionJournal: assetPostJournal,
        paymentAccountCode: assetPayAcct,
      });
      setAssetName('');
      setNotice(`Registered Fixed Asset ${created.assetCode} (${created.name}).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register asset.');
    }
  };

  const handleRunDepr = () => {
    setError(null);
    setNotice(null);
    try {
      const res = runMonthlyDepreciation(deprPeriod, today);
      setNotice(
        `Posted ${formatNumericCurrency(res.totalDepreciation, currency, 2)} depreciation across ${res.assetsCount} asset(s) for ${deprPeriod}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Depreciation run failed.');
    }
  };

  const handleAddBudget = (e: React.FormEvent) => {
    e.preventDefault();
    const acc = data.accounts.find((a) => a.code === budAcctCode);
    addBudget({
      periodKey: budPeriod,
      costCenter: budCostCenter.trim() || 'Operations',
      accountCode: budAcctCode,
      accountName: acc?.name ?? budAcctCode,
      plannedAmount: Math.max(0, Number(budAmount) || 0),
      notes: budNotes.trim(),
    });
    setBudNotes('');
    setNotice(`Added budget allocation for ${budCostCenter}.`);
  };

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expDesc.trim()) return;
    addExpenseClaim({
      employeeName: expEmp.trim() || principal.fullName,
      category: expCat.trim() || 'General',
      expenseDate: expDate,
      amount: Math.max(0, Number(expAmt) || 0),
      taxAmount: Math.max(0, Number(expTax) || 0),
      description: expDesc.trim(),
    });
    setExpDesc('');
    setExpAmt('0');
    setExpTax('0');
    setNotice('Submitted expense claim for approval.');
  };

  const handleAddBankTx = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankDesc.trim()) return;
    addBankTransaction({
      txDate: bankDate,
      description: bankDesc.trim(),
      reference: bankRef.trim() || `BNK-${Date.now().toString().slice(-4)}`,
      direction: bankDir,
      amount: Math.max(0.01, Number(bankAmt) || 0),
    });
    setBankDesc('');
    setBankRef('');
    setBankAmt('0');
    setNotice('Added bank statement line for reconciliation.');
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
          <div className="font-mono text-xs font-semibold text-[#1C1917] dark:text-slate-100">
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
          <div className="text-xs font-medium text-[#1C1917] dark:text-slate-100">
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
          <h1 className="text-2xl font-bold tracking-tight text-[#1C1917] dark:text-slate-100">
            Finance, Accounting & Controlling
          </h1>
          <p className="mt-1 text-xs text-[#718096] dark:text-slate-400">
            Double-entry GL, P&L & Balance Sheet, AR/AP aging, fixed assets & depreciation, cost-center budgets, expense claims, and bank reconciliation.
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
          <div className="mt-1 text-lg font-bold font-mono tabular-nums text-[#1C1917] dark:text-slate-100">
            {formatNumericCurrency(metrics.totalExpenses, currency, 2)}
          </div>
        </Surface>
        <Surface>
          <div className="text-xs text-[#718096] dark:text-slate-400">AR / AP Balance</div>
          <div className="mt-1 text-xs font-mono tabular-nums space-y-0.5">
            <div className="text-[#DC2626] font-semibold">
              AR: {formatNumericCurrency(metrics.openReceivables, currency, 2)}
            </div>
            <div className="text-[#718096] dark:text-slate-300">
              AP: {formatNumericCurrency(metrics.openPayables, currency, 2)}
            </div>
          </div>
        </Surface>
        <Surface>
          <div className="text-xs text-[#718096] dark:text-slate-400">Inventory Asset (1300)</div>
          <div className="mt-1 text-lg font-bold font-mono tabular-nums text-[#1C1917] dark:text-slate-100">
            {formatNumericCurrency(metrics.inventoryAssetValue, currency, 2)}
          </div>
        </Surface>
        <Surface>
          <div className="text-xs text-[#718096] dark:text-slate-400">Net Tax Liability</div>
          <div className="mt-1 text-lg font-bold font-mono tabular-nums text-[#1C1917] dark:text-slate-100">
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
                  className="w-full h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Reference</label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Optional ref (auto if blank)"
                  className="w-full h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Description / Narration</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Office rent, equity capital, or accrual"
                  className="w-full h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
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
                  className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-2 rounded-lg border border-slate-200 dark:border-[#32242A] bg-[#FAF9F7]/60 dark:bg-[#141013]"
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
                      className="w-full h-8 px-2 rounded-md text-xs bg-white dark:bg-[#1B1417] border border-slate-200 dark:border-[#32242A]"
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
                      className="w-full h-8 px-2 rounded-md text-xs font-mono bg-white dark:bg-[#1B1417] border border-slate-200 dark:border-[#32242A]"
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
                      className="w-full h-8 px-2 rounded-md text-xs font-mono bg-white dark:bg-[#1B1417] border border-slate-200 dark:border-[#32242A]"
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
                      className="w-full h-8 px-2 rounded-md text-xs bg-white dark:bg-[#1B1417] border border-slate-200 dark:border-[#32242A]"
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
      <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-[#251B20]">
        {(
          [
            { id: 'journals', label: `Journals (${data.journals.length})` },
            { id: 'statements', label: 'P&L, Balance Sheet & Aging' },
            { id: 'trial_balance', label: 'Trial Balance & COA' },
            { id: 'fixed_assets', label: `Fixed Assets (${data.fixedAssets.length})` },
            { id: 'budgets', label: `Budgets (${data.budgets.length})` },
            { id: 'expenses', label: `Expenses (${data.expenseClaims.length})` },
            { id: 'bank_recon', label: `Bank Recon (${data.bankTransactions.length})` },
            { id: 'periods', label: `Periods (${data.fiscalPeriods.length})` },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap ${
              tab === t.id
                ? 'bg-white dark:bg-[#1B1417] text-[#1C1917] dark:text-slate-100 shadow-xs'
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

      {tab === 'statements' && (
        <div className="space-y-6">
          {/* Interactive P&L & Aging Visualizations */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Surface padding="lg" className="space-y-3">
              <h2 className="text-sm font-semibold text-[#1C1917] dark:text-slate-100">
                P&L Financial Summary
              </h2>
              <GroupedBarChart
                data={[
                  { label: 'Revenue', primary: Math.max(0, financialStatements.totalRevenue) },
                  { label: 'COGS', primary: Math.max(0, financialStatements.cogsTotal) },
                  {
                    label: 'OpEx',
                    primary: Math.max(
                      0,
                      financialStatements.totalExpenses - financialStatements.cogsTotal,
                    ),
                  },
                  { label: 'Net Income', primary: Math.max(0, financialStatements.netIncome) },
                ]}
                primaryLabel={currency}
                primaryColor="#DC2626"
                formatValue={(v) => formatNumericCurrency(v, currency, 0)}
                height={190}
                emptyMessage="Post invoices or expense journals to plot P&L metrics."
              />
            </Surface>

            <Surface padding="lg" className="space-y-3">
              <h2 className="text-sm font-semibold text-[#1C1917] dark:text-slate-100">
                AR & AP Aging Distribution
              </h2>
              <GroupedBarChart
                data={[
                  { label: 'Current', primary: agingReport.ar.current, secondary: agingReport.ap.current },
                  { label: '1-30d', primary: agingReport.ar.days1to30, secondary: agingReport.ap.days1to30 },
                  { label: '31-60d', primary: agingReport.ar.days31to60, secondary: agingReport.ap.days31to60 },
                  { label: '61-90d', primary: agingReport.ar.days61to90, secondary: agingReport.ap.days61to90 },
                  { label: '90+d', primary: agingReport.ar.days90Plus, secondary: agingReport.ap.days90Plus },
                ]}
                primaryLabel="Receivable (AR)"
                secondaryLabel="Payable (AP)"
                primaryColor="#16B8A6"
                secondaryColor="#F59E0B"
                formatValue={(v) => formatNumericCurrency(v, currency, 0)}
                height={190}
                emptyMessage="No open receivable or payable aging balances."
              />
            </Surface>

            <Surface padding="lg" className="space-y-3">
              <h2 className="text-sm font-semibold text-[#1C1917] dark:text-slate-100">
                Balance Sheet Asset & Liability Mix
              </h2>
              <DonutChart
                slices={buildBalanceCompositionSlices(trialBalance.rows)}
                centerLabel="Total Assets"
                centerValue={formatNumericCurrency(financialStatements.totalAssets, currency, 0)}
                formatValue={(v) => formatNumericCurrency(v, currency, 0)}
                emptyMessage="Post journals to inspect account distribution."
              />
            </Surface>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Income Statement */}
            <Surface padding="lg" className="space-y-4">
              <h2 className="text-sm font-semibold text-[#1C1917] dark:text-slate-100">
                Profit & Loss (Income Statement)
              </h2>
              <div className="space-y-2 text-xs">
                <div className="font-semibold text-[#718096] uppercase text-[11px]">Revenue</div>
                {financialStatements.revenueRows.map((r) => (
                  <div key={r.accountId} className="flex justify-between font-mono tabular-nums">
                    <span>{r.code} · {r.name}</span>
                    <span>{formatNumericCurrency(r.netBalance, currency, 2)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-mono tabular-nums pt-1 border-t border-slate-200 dark:border-[#32242A]">
                  <span>Less: Cost of Goods Sold (5000)</span>
                  <span>({formatNumericCurrency(financialStatements.cogsTotal, currency, 2)})</span>
                </div>
                <div className="flex justify-between font-mono tabular-nums font-bold text-[#DC2626] pt-1">
                  <span>Gross Profit</span>
                  <span>{formatNumericCurrency(financialStatements.grossProfit, currency, 2)}</span>
                </div>
                <div className="font-semibold text-[#718096] uppercase text-[11px] pt-2">
                  Operating Expenses
                </div>
                {financialStatements.operatingExpenseRows.map((r) => (
                  <div key={r.accountId} className="flex justify-between font-mono tabular-nums">
                    <span>{r.code} · {r.name}</span>
                    <span>{formatNumericCurrency(r.netBalance, currency, 2)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-mono tabular-nums text-sm font-bold pt-2 border-t border-slate-200 dark:border-[#32242A]">
                  <span>Net Income</span>
                  <span className={financialStatements.netIncome >= 0 ? 'text-[#16B8A6]' : 'text-red-600'}>
                    {formatNumericCurrency(financialStatements.netIncome, currency, 2)}
                  </span>
                </div>
              </div>
            </Surface>

            {/* Balance Sheet */}
            <Surface padding="lg" className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[#1C1917] dark:text-slate-100">
                  Balance Sheet
                </h2>
                <span className="text-xs font-mono font-semibold text-[#16B8A6]">
                  {financialStatements.balanceSheetBalanced ? 'A = L + E Balanced' : 'Out of Balance'}
                </span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="font-semibold text-[#718096] uppercase text-[11px]">Assets</div>
                {financialStatements.assetRows.map((r) => (
                  <div key={r.accountId} className="flex justify-between font-mono tabular-nums">
                    <span>{r.code} · {r.name}</span>
                    <span>{formatNumericCurrency(r.netBalance, currency, 2)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-mono tabular-nums font-bold border-t border-slate-200 dark:border-[#32242A] pt-1">
                  <span>Total Assets</span>
                  <span>{formatNumericCurrency(financialStatements.totalAssets, currency, 2)}</span>
                </div>
                <div className="font-semibold text-[#718096] uppercase text-[11px] pt-2">
                  Liabilities & Equity
                </div>
                {financialStatements.liabilityRows.map((r) => (
                  <div key={r.accountId} className="flex justify-between font-mono tabular-nums">
                    <span>{r.code} · {r.name}</span>
                    <span>{formatNumericCurrency(r.netBalance, currency, 2)}</span>
                  </div>
                ))}
                {financialStatements.equityRows.map((r) => (
                  <div key={r.accountId} className="flex justify-between font-mono tabular-nums">
                    <span>{r.code} · {r.name}</span>
                    <span>{formatNumericCurrency(r.netBalance, currency, 2)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-mono tabular-nums">
                  <span>Current Period Retained Earnings</span>
                  <span>{formatNumericCurrency(financialStatements.netIncome, currency, 2)}</span>
                </div>
                <div className="flex justify-between font-mono tabular-nums text-sm font-bold pt-2 border-t border-slate-200 dark:border-[#32242A]">
                  <span>Total Liabilities & Equity</span>
                  <span>
                    {formatNumericCurrency(
                      financialStatements.totalLiabilities + financialStatements.totalEquityWithNetIncome,
                      currency,
                      2,
                    )}
                  </span>
                </div>
              </div>
            </Surface>
          </div>

          {/* Aging & Tax */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Surface padding="lg" className="lg:col-span-2 space-y-3">
              <h3 className="text-sm font-semibold">AR / AP Aging Schedule</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left font-mono tabular-nums">
                  <thead className="text-[#718096] border-b border-slate-200 dark:border-[#32242A]">
                    <tr>
                      <th className="py-2 font-sans">Ledger</th>
                      <th className="py-2 text-right">Current</th>
                      <th className="py-2 text-right">1-30d</th>
                      <th className="py-2 text-right">31-60d</th>
                      <th className="py-2 text-right">61-90d</th>
                      <th className="py-2 text-right">90+d</th>
                      <th className="py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70 dark:divide-[#32242A]">
                    <tr>
                      <td className="py-2.5 font-sans font-semibold text-[#DC2626]">Accounts Receivable</td>
                      <td className="py-2.5 text-right">{formatNumericCurrency(agingReport.ar.current, currency, 2)}</td>
                      <td className="py-2.5 text-right">{formatNumericCurrency(agingReport.ar.days1to30, currency, 2)}</td>
                      <td className="py-2.5 text-right">{formatNumericCurrency(agingReport.ar.days31to60, currency, 2)}</td>
                      <td className="py-2.5 text-right">{formatNumericCurrency(agingReport.ar.days61to90, currency, 2)}</td>
                      <td className="py-2.5 text-right">{formatNumericCurrency(agingReport.ar.days90Plus, currency, 2)}</td>
                      <td className="py-2.5 text-right font-bold">{formatNumericCurrency(agingReport.ar.total, currency, 2)}</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 font-sans font-semibold text-[#1C1917] dark:text-slate-100">Accounts Payable</td>
                      <td className="py-2.5 text-right">{formatNumericCurrency(agingReport.ap.current, currency, 2)}</td>
                      <td className="py-2.5 text-right">{formatNumericCurrency(agingReport.ap.days1to30, currency, 2)}</td>
                      <td className="py-2.5 text-right">{formatNumericCurrency(agingReport.ap.days31to60, currency, 2)}</td>
                      <td className="py-2.5 text-right">{formatNumericCurrency(agingReport.ap.days61to90, currency, 2)}</td>
                      <td className="py-2.5 text-right">{formatNumericCurrency(agingReport.ap.days90Plus, currency, 2)}</td>
                      <td className="py-2.5 text-right font-bold">{formatNumericCurrency(agingReport.ap.total, currency, 2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Surface>

            <Surface padding="lg" className="space-y-3">
              <h3 className="text-sm font-semibold">GST / VAT Compliance Summary</h3>
              <div className="space-y-2 text-xs font-mono tabular-nums">
                <div className="flex justify-between">
                  <span className="font-sans text-[#718096]">Output Tax Collected (2200)</span>
                  <span>{formatNumericCurrency(taxSummary.outputTax, currency, 2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-sans text-[#718096]">Less: Input Tax Credit (1400)</span>
                  <span>({formatNumericCurrency(taxSummary.inputTax, currency, 2)})</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-[#32242A] font-bold">
                  <span className="font-sans">Net Tax Payable</span>
                  <span className="text-[#DC2626]">{formatNumericCurrency(taxSummary.net, currency, 2)}</span>
                </div>
              </div>
            </Surface>
          </div>
        </div>
      )}

      {tab === 'trial_balance' && (
        <Surface padding="none" className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#EFF3FA]/70 dark:bg-[#251B20] text-[#718096] dark:text-slate-300 border-b border-slate-200 dark:border-[#32242A]">
              <tr>
                <th className="px-4 py-3 font-semibold">Code</th>
                <th className="px-4 py-3 font-semibold">Account</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold text-right">Debit</th>
                <th className="px-4 py-3 font-semibold text-right">Credit</th>
                <th className="px-4 py-3 font-semibold text-right">Net Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-[#32242A]">
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
            <tfoot className="bg-[#EFF3FA]/60 dark:bg-[#251B20] border-t border-slate-200 dark:border-[#32242A] font-mono font-bold tabular-nums">
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

      {tab === 'fixed_assets' && (
        <div className="space-y-6">
          <Surface padding="lg">
            <form onSubmit={handleRegisterAsset} className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <Building className="h-4 w-4 text-[#DC2626]" />
                  Register Fixed Asset & Depreciation Schedule
                </h2>
                <div className="flex items-center gap-2">
                  <input
                    type="month"
                    value={deprPeriod}
                    onChange={(e) => setDeprPeriod(e.target.value)}
                    className="h-8 px-2 rounded-md text-xs font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={handleRunDepr}>
                    Run Monthly Depreciation
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                <input
                  type="text"
                  required
                  value={assetName}
                  onChange={(e) => setAssetName(e.target.value)}
                  placeholder="Asset Name (e.g. CNC Lathe) *"
                  className="lg:col-span-2 h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
                <input
                  type="text"
                  value={assetCategory}
                  onChange={(e) => setAssetCategory(e.target.value)}
                  placeholder="Category"
                  className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
                <input
                  type="date"
                  value={assetDate}
                  onChange={(e) => setAssetDate(e.target.value)}
                  className="h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
                <input
                  type="number"
                  step="0.01"
                  value={assetCost}
                  onChange={(e) => setAssetCost(e.target.value)}
                  placeholder={`Cost (${currency})`}
                  className="h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
                <input
                  type="number"
                  min="1"
                  value={assetLife}
                  onChange={(e) => setAssetLife(e.target.value)}
                  placeholder="Useful Months"
                  title="Useful Life (Months)"
                  className="h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={assetPostJournal}
                      onChange={(e) => setAssetPostJournal(e.target.checked)}
                    />
                    <span>Post Acquisition GL Journal (DR 1500 Fixed Assets)</span>
                  </label>
                  {assetPostJournal && (
                    <select
                      value={assetPayAcct}
                      onChange={(e) => setAssetPayAcct(e.target.value as '1000' | '2100')}
                      className="h-8 px-2 rounded-md text-xs bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                    >
                      <option value="1000">Credit Cash & Bank (1000)</option>
                      <option value="2100">Credit Accounts Payable (2100)</option>
                    </select>
                  )}
                  <input
                    type="number"
                    step="0.01"
                    value={assetSalvage}
                    onChange={(e) => setAssetSalvage(e.target.value)}
                    placeholder="Salvage Value"
                    className="w-32 h-8 px-2 rounded-md text-xs font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                  />
                </div>
                <Button type="submit" variant="primary" size="sm">
                  Register Asset
                </Button>
              </div>
            </form>
          </Surface>

          <Surface padding="none" className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#EFF3FA]/70 dark:bg-[#251B20] text-[#718096] border-b border-slate-200 dark:border-[#32242A]">
                <tr>
                  <th className="px-4 py-3">Asset</th>
                  <th className="px-4 py-3">Acquired</th>
                  <th className="px-4 py-3 text-right">Purchase Cost</th>
                  <th className="px-4 py-3 text-right">Accum. Depr.</th>
                  <th className="px-4 py-3 text-right">Net Book Value</th>
                  <th className="px-4 py-3 text-right">Last Run</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-[#32242A]">
                {data.fixedAssets.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-[#718096]">
                      No fixed assets registered yet.
                    </td>
                  </tr>
                ) : (
                  data.fixedAssets.map((a) => (
                    <tr key={a.id}>
                      <td className="px-4 py-3">
                        <div className="font-semibold">{a.name}</div>
                        <div className="font-mono text-[11px] text-[#718096]">
                          {a.assetCode} · {a.category} · {a.usefulLifeMonths}m
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono">{a.purchaseDate}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">
                        {formatNumericCurrency(a.purchaseCost, currency, 2)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-amber-600 dark:text-amber-400">
                        {formatNumericCurrency(a.accumulatedDepreciation, currency, 2)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-[#16B8A6]">
                        {formatNumericCurrency(a.purchaseCost - a.accumulatedDepreciation, currency, 2)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{a.lastDepreciationPeriod ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Surface>
        </div>
      )}

      {tab === 'budgets' && (
        <div className="space-y-6">
          <Surface padding="lg">
            <form onSubmit={handleAddBudget} className="space-y-4">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <PiggyBank className="h-4 w-4 text-[#16B8A6]" />
                Allocate Cost-Center Budget
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <input
                  type="month"
                  value={budPeriod}
                  onChange={(e) => setBudPeriod(e.target.value)}
                  className="h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
                <input
                  type="text"
                  value={budCostCenter}
                  onChange={(e) => setBudCostCenter(e.target.value)}
                  placeholder="Cost Center (e.g. Engineering)"
                  className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
                <select
                  value={budAcctCode}
                  onChange={(e) => setBudAcctCode(e.target.value)}
                  className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                >
                  {data.accounts
                    .filter((a) => a.category === 'expense' || a.category === 'revenue')
                    .map((a) => (
                      <option key={a.id} value={a.code}>
                        {a.code} · {a.name}
                      </option>
                    ))}
                </select>
                <input
                  type="number"
                  step="0.01"
                  value={budAmount}
                  onChange={(e) => setBudAmount(e.target.value)}
                  placeholder={`Planned (${currency})`}
                  className="h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
                <Button type="submit" variant="primary" size="sm" className="h-9">
                  Save Budget
                </Button>
              </div>
            </form>
          </Surface>

          <Surface padding="none" className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#EFF3FA]/70 dark:bg-[#251B20] text-[#718096] border-b border-slate-200 dark:border-[#32242A]">
                <tr>
                  <th className="px-4 py-3">Period & Cost Center</th>
                  <th className="px-4 py-3">Account</th>
                  <th className="px-4 py-3 text-right">Planned</th>
                  <th className="px-4 py-3 text-right">GL Actual</th>
                  <th className="px-4 py-3 text-right">Variance</th>
                  <th className="px-4 py-3 text-right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-[#32242A]">
                {data.budgets.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-[#718096]">
                      No cost-center budgets configured yet.
                    </td>
                  </tr>
                ) : (
                  data.budgets.map((b) => {
                    const actual = trialBalance.rows.find((r) => r.code === b.accountCode)?.netBalance ?? 0;
                    const variance = b.plannedAmount - actual;
                    return (
                      <tr key={b.id}>
                        <td className="px-4 py-3">
                          <div className="font-semibold">{b.costCenter}</div>
                          <div className="font-mono text-[11px] text-[#718096]">{b.periodKey}</div>
                        </td>
                        <td className="px-4 py-3 font-mono">{b.accountCode} · {b.accountName}</td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">
                          {formatNumericCurrency(b.plannedAmount, currency, 2)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">
                          {formatNumericCurrency(actual, currency, 2)}
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-mono tabular-nums font-semibold ${
                            variance >= 0 ? 'text-[#16B8A6]' : 'text-red-600'
                          }`}
                        >
                          {formatNumericCurrency(variance, currency, 2)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => deleteBudget(b.id)}
                            className="p-1 text-[#718096] hover:text-red-600 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </Surface>
        </div>
      )}

      {tab === 'expenses' && (
        <div className="space-y-6">
          <Surface padding="lg">
            <form onSubmit={handleAddExpense} className="space-y-4">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Receipt className="h-4 w-4 text-[#DC2626]" />
                Submit Employee Expense Claim
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                <input
                  type="text"
                  value={expEmp}
                  onChange={(e) => setExpEmp(e.target.value)}
                  placeholder="Employee Name"
                  className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
                <input
                  type="text"
                  value={expCat}
                  onChange={(e) => setExpCat(e.target.value)}
                  placeholder="Category"
                  className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
                <input
                  type="date"
                  value={expDate}
                  onChange={(e) => setExpDate(e.target.value)}
                  className="h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
                <input
                  type="number"
                  step="0.01"
                  value={expAmt}
                  onChange={(e) => setExpAmt(e.target.value)}
                  placeholder={`Net Amount (${currency})`}
                  className="h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
                <input
                  type="number"
                  step="0.01"
                  value={expTax}
                  onChange={(e) => setExpTax(e.target.value)}
                  placeholder="Input Tax"
                  className="h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
                <input
                  type="text"
                  required
                  value={expDesc}
                  onChange={(e) => setExpDesc(e.target.value)}
                  placeholder="Description / Receipt ref *"
                  className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit" variant="primary" size="sm">
                  Submit Claim
                </Button>
              </div>
            </form>
          </Surface>

          <Surface padding="none" className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#EFF3FA]/70 dark:bg-[#251B20] text-[#718096] border-b border-slate-200 dark:border-[#32242A]">
                <tr>
                  <th className="px-4 py-3">Claim</th>
                  <th className="px-4 py-3">Employee & Description</th>
                  <th className="px-4 py-3 text-right">Total (+Tax)</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Post to GL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-[#32242A]">
                {data.expenseClaims.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-[#718096]">
                      No expense claims submitted yet.
                    </td>
                  </tr>
                ) : (
                  data.expenseClaims.map((c) => (
                    <tr key={c.id}>
                      <td className="px-4 py-3 font-mono font-semibold">{c.claimNumber}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{c.employeeName} · {c.category}</div>
                        <div className="text-[11px] text-[#718096]">{c.description} ({c.expenseDate})</div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold">
                        {formatNumericCurrency(c.amount + c.taxAmount, currency, 2)}
                      </td>
                      <td className="px-4 py-3 capitalize font-semibold text-[#DC2626]">{c.status}</td>
                      <td className="px-4 py-3 text-right">
                        {c.status === 'pending' ? (
                          <div className="inline-flex gap-2">
                            <button
                              type="button"
                              onClick={() => approveExpenseClaim(c.id, true, today)}
                              className="text-xs font-medium text-[#16B8A6] hover:underline cursor-pointer"
                            >
                              Approve & Pay
                            </button>
                            <button
                              type="button"
                              onClick={() => approveExpenseClaim(c.id, false, today)}
                              className="text-xs font-medium text-[#DC2626] hover:underline cursor-pointer"
                            >
                              Post to AP
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-[#16B8A6] inline-flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Posted
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Surface>
        </div>
      )}

      {tab === 'bank_recon' && (
        <div className="space-y-6">
          <Surface padding="lg">
            <form onSubmit={handleAddBankTx} className="space-y-4">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Landmark className="h-4 w-4 text-[#DC2626]" />
                Import / Record Bank Statement Line
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                <input
                  type="date"
                  value={bankDate}
                  onChange={(e) => setBankDate(e.target.value)}
                  className="h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
                <input
                  type="text"
                  required
                  value={bankDesc}
                  onChange={(e) => setBankDesc(e.target.value)}
                  placeholder="Bank narration *"
                  className="lg:col-span-2 h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
                <input
                  type="text"
                  value={bankRef}
                  onChange={(e) => setBankRef(e.target.value)}
                  placeholder="UTR / Reference"
                  className="h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
                <select
                  value={bankDir}
                  onChange={(e) => setBankDir(e.target.value as 'credit' | 'debit')}
                  className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                >
                  <option value="credit">Deposit (+)</option>
                  <option value="debit">Withdrawal (-)</option>
                </select>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    value={bankAmt}
                    onChange={(e) => setBankAmt(e.target.value)}
                    placeholder="Amount"
                    className="w-full h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                  />
                  <Button type="submit" variant="primary" size="sm" className="h-9 shrink-0">
                    Add
                  </Button>
                </div>
              </div>
            </form>
          </Surface>

          <Surface padding="none" className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#EFF3FA]/70 dark:bg-[#251B20] text-[#718096] border-b border-slate-200 dark:border-[#32242A]">
                <tr>
                  <th className="px-4 py-3">Date & Ref</th>
                  <th className="px-4 py-3">Bank Narration</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Match GL Journal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-[#32242A]">
                {data.bankTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-[#718096]">
                      No bank statement transactions added yet.
                    </td>
                  </tr>
                ) : (
                  data.bankTransactions.map((tx) => (
                    <tr key={tx.id}>
                      <td className="px-4 py-3 font-mono">
                        <div>{tx.txDate}</div>
                        <div className="text-[11px] text-[#718096]">{tx.reference}</div>
                      </td>
                      <td className="px-4 py-3 font-medium">{tx.description}</td>
                      <td
                        className={`px-4 py-3 text-right font-mono tabular-nums font-semibold ${
                          tx.direction === 'credit' ? 'text-[#16B8A6]' : 'text-amber-600'
                        }`}
                      >
                        {tx.direction === 'credit' ? '+' : '-'}
                        {formatNumericCurrency(tx.amount, currency, 2)}
                      </td>
                      <td className="px-4 py-3">
                        {tx.status === 'reconciled' ? (
                          <span className="text-xs font-semibold text-[#16B8A6]">
                            Reconciled (
                            {data.journals.find((j) => j.id === tx.matchedJournalId)?.journalNumber ??
                              'Matched'}
                            )
                          </span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <select
                              value={reconSelections[tx.id] ?? ''}
                              onChange={(e) =>
                                setReconSelections((prev) => ({ ...prev, [tx.id]: e.target.value }))
                              }
                              className="h-7 px-2 rounded text-xs bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                            >
                              <option value="">Pick GL Journal...</option>
                              {data.journals.map((j) => (
                                <option key={j.id} value={j.id}>
                                  {j.journalNumber} · {j.reference} ({formatNumericCurrency(j.totalDebit, currency, 2)})
                                </option>
                              ))}
                            </select>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={!reconSelections[tx.id]}
                              onClick={() => reconcileBankTransaction(tx.id, reconSelections[tx.id])}
                            >
                              Match
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Surface>
        </div>
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
