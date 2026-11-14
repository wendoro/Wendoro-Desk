import {
  AccountCategory,
  AccountSubType,
  ChartAccount,
  ErpDatabaseState,
  FiscalPeriod,
  JournalEntry,
  JournalLine,
  LedgerEntry,
  LedgerEntryType,
} from '@/src/core/store/erpTypes';

export class ErpDomainError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ErpDomainError';
    this.code = code;
  }
}

export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) {
    throw new ErpDomainError('INVALID_AMOUNT', 'Monetary value must be a finite number.');
  }
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function createUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function nextSequenceNumber(
  state: ErpDatabaseState,
  companyId: string,
  prefix: string,
  pad = 4,
): { nextState: ErpDatabaseState; formatted: string; seq: number } {
  const key = `${companyId}:${prefix}`;
  const seq = (state.sequences[key] ?? 0) + 1;
  return {
    nextState: {
      ...state,
      sequences: {
        ...state.sequences,
        [key]: seq,
      },
    },
    formatted: `${prefix}-${String(seq).padStart(pad, '0')}`,
    seq,
  };
}

const STANDARD_ACCOUNTS: Array<{
  code: string;
  name: string;
  category: AccountCategory;
  subType: AccountSubType;
}> = [
  { code: '1000', name: 'Cash & Bank', category: 'asset', subType: 'cash' },
  {
    code: '1200',
    name: 'Accounts Receivable',
    category: 'asset',
    subType: 'accounts_receivable',
  },
  { code: '1300', name: 'Inventory Asset', category: 'asset', subType: 'inventory' },
  {
    code: '1400',
    name: 'Input Tax Receivable',
    category: 'asset',
    subType: 'input_tax',
  },
  {
    code: '2100',
    name: 'Accounts Payable',
    category: 'liability',
    subType: 'accounts_payable',
  },
  {
    code: '2200',
    name: 'Output Tax Payable',
    category: 'liability',
    subType: 'output_tax',
  },
  {
    code: '2300',
    name: 'Payroll Payable',
    category: 'liability',
    subType: 'payroll_payable',
  },
  { code: '3000', name: 'Owner Equity', category: 'equity', subType: 'equity' },
  { code: '4000', name: 'Sales Revenue', category: 'revenue', subType: 'sales_revenue' },
  {
    code: '5000',
    name: 'Cost of Goods Sold',
    category: 'expense',
    subType: 'cogs',
  },
  {
    code: '5200',
    name: 'Salaries & Payroll Expense',
    category: 'expense',
    subType: 'payroll_expense',
  },
  {
    code: '5300',
    name: 'Operating Expense',
    category: 'expense',
    subType: 'operating_expense',
  },
  {
    code: '5400',
    name: 'Inventory Adjustment Expense',
    category: 'expense',
    subType: 'operating_expense',
  },
];

export function ensureCompanyAccounts(
  state: ErpDatabaseState,
  companyId: string,
): { nextState: ErpDatabaseState; accounts: ChartAccount[] } {
  const existing = state.accounts.filter((a) => a.companyId === companyId);
  const existingCodes = new Set(existing.map((a) => a.code));
  const missing = STANDARD_ACCOUNTS.filter((tpl) => !existingCodes.has(tpl.code)).map(
    (tpl): ChartAccount => ({
      id: createUuid(),
      companyId,
      code: tpl.code,
      name: tpl.name,
      category: tpl.category,
      subType: tpl.subType,
      isSystem: true,
    }),
  );

  if (missing.length === 0) {
    return { nextState: state, accounts: existing };
  }

  const nextAccounts = [...state.accounts, ...missing];
  return {
    nextState: { ...state, accounts: nextAccounts },
    accounts: [...existing, ...missing],
  };
}

export function getAccountByCode(
  accounts: ChartAccount[],
  companyId: string,
  code: string,
): ChartAccount {
  const found = accounts.find((a) => a.companyId === companyId && a.code === code);
  if (!found) {
    throw new ErpDomainError('ACCOUNT_NOT_FOUND', `Chart account ${code} not found.`);
  }
  return found;
}

export function ensureOpenFiscalPeriod(
  state: ErpDatabaseState,
  companyId: string,
  date: string,
): { nextState: ErpDatabaseState; period: FiscalPeriod } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ErpDomainError('INVALID_DATE', `Invalid accounting date: ${date}`);
  }
  const periodCode = date.slice(0, 7);
  const existing = state.fiscalPeriods.find(
    (p) => p.companyId === companyId && p.code === periodCode,
  );
  if (existing) {
    if (existing.status === 'closed') {
      throw new ErpDomainError(
        'FISCAL_PERIOD_CLOSED',
        `Fiscal period ${periodCode} is closed. Reopen the period or post to an open period.`,
      );
    }
    return { nextState: state, period: existing };
  }

  const [yearStr, monthStr] = periodCode.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const created: FiscalPeriod = {
    id: createUuid(),
    companyId,
    code: periodCode,
    name: `${periodCode} Fiscal Period`,
    startDate: `${periodCode}-01`,
    endDate: `${periodCode}-${String(lastDay).padStart(2, '0')}`,
    status: 'open',
  };

  return {
    nextState: {
      ...state,
      fiscalPeriods: [created, ...state.fiscalPeriods],
    },
    period: created,
  };
}

export function setFiscalPeriodStatus(
  state: ErpDatabaseState,
  companyId: string,
  periodCode: string,
  status: 'open' | 'closed',
): ErpDatabaseState {
  const existing = state.fiscalPeriods.find(
    (p) => p.companyId === companyId && p.code === periodCode,
  );
  if (existing) {
    return {
      ...state,
      fiscalPeriods: state.fiscalPeriods.map((p) =>
        p.id === existing.id ? { ...p, status } : p,
      ),
    };
  }
  const [yearStr, monthStr] = periodCode.split('-');
  const lastDay = new Date(Date.UTC(Number(yearStr), Number(monthStr), 0)).getUTCDate();
  const created: FiscalPeriod = {
    id: createUuid(),
    companyId,
    code: periodCode,
    name: `${periodCode} Fiscal Period`,
    startDate: `${periodCode}-01`,
    endDate: `${periodCode}-${String(lastDay).padStart(2, '0')}`,
    status,
  };
  return {
    ...state,
    fiscalPeriods: [created, ...state.fiscalPeriods],
  };
}

export interface DraftJournalLine {
  accountId?: string;
  accountCode?: string;
  debit: number;
  credit: number;
  memo?: string;
}

export function validateAndNormalizeJournalLines(
  accounts: ChartAccount[],
  companyId: string,
  draftLines: DraftJournalLine[],
): { lines: JournalLine[]; totalDebit: number; totalCredit: number } {
  if (draftLines.length < 2) {
    throw new ErpDomainError(
      'UNBALANCED_JOURNAL',
      'Double-entry journal must contain at least 2 lines (debit and credit).',
    );
  }

  let totalDebit = 0;
  let totalCredit = 0;

  const lines: JournalLine[] = draftLines.map((line, index) => {
    const debit = roundMoney(line.debit);
    const credit = roundMoney(line.credit);

    if (debit < 0 || credit < 0) {
      throw new ErpDomainError(
        'NEGATIVE_JOURNAL_LINE',
        `Journal line ${index + 1} cannot have negative debit or credit.`,
      );
    }
    if (debit > 0 && credit > 0) {
      throw new ErpDomainError(
        'AMBIGUOUS_JOURNAL_LINE',
        `Journal line ${index + 1} cannot have both debit and credit > 0.`,
      );
    }
    if (debit === 0 && credit === 0) {
      throw new ErpDomainError(
        'ZERO_JOURNAL_LINE',
        `Journal line ${index + 1} must have a non-zero debit or credit.`,
      );
    }

    const account = line.accountId
      ? accounts.find((a) => a.companyId === companyId && a.id === line.accountId)
      : line.accountCode
        ? accounts.find((a) => a.companyId === companyId && a.code === line.accountCode)
        : undefined;

    if (!account) {
      throw new ErpDomainError(
        'ACCOUNT_NOT_FOUND',
        `Invalid account reference on journal line ${index + 1}.`,
      );
    }

    totalDebit = roundMoney(totalDebit + debit);
    totalCredit = roundMoney(totalCredit + credit);

    return {
      id: createUuid(),
      accountId: account.id,
      accountCode: account.code,
      accountName: account.name,
      accountCategory: account.category,
      debit,
      credit,
      memo: line.memo,
    };
  });

  if (totalDebit <= 0 || Math.abs(totalDebit - totalCredit) >= 0.005) {
    throw new ErpDomainError(
      'UNBALANCED_JOURNAL',
      `Journal does not balance: Debits (${totalDebit.toFixed(2)}) != Credits (${totalCredit.toFixed(2)}).`,
    );
  }

  return { lines, totalDebit, totalCredit };
}

function deriveLegacyLedgerType(category: AccountCategory): LedgerEntryType {
  switch (category) {
    case 'revenue':
      return 'income';
    case 'expense':
      return 'expense';
    case 'asset':
      return 'asset';
    case 'liability':
    case 'equity':
    default:
      return 'liability';
  }
}

export function postJournalEntry(
  state: ErpDatabaseState,
  params: {
    companyId: string;
    branchId: string | null;
    date: string;
    reference: string;
    description: string;
    sourceModule: JournalEntry['sourceModule'];
    sourceId?: string;
    idempotencyKey: string;
    lines: DraftJournalLine[];
    reversesJournalId?: string;
  },
): { nextState: ErpDatabaseState; journal: JournalEntry } {
  const duplicate = state.journals.find(
    (j) =>
      j.companyId === params.companyId &&
      j.idempotencyKey === params.idempotencyKey &&
      j.status === 'posted',
  );
  if (duplicate) {
    throw new ErpDomainError(
      'DUPLICATE_JOURNAL_POSTING',
      `Journal already posted for idempotency key "${params.idempotencyKey}" (${duplicate.journalNumber}).`,
    );
  }

  const ensuredAccounts = ensureCompanyAccounts(state, params.companyId);
  const ensuredPeriod = ensureOpenFiscalPeriod(
    ensuredAccounts.nextState,
    params.companyId,
    params.date,
  );
  const normalized = validateAndNormalizeJournalLines(
    ensuredAccounts.accounts,
    params.companyId,
    params.lines,
  );
  const seqRes = nextSequenceNumber(ensuredPeriod.nextState, params.companyId, 'JV', 4);

  const createdAt = nowIso();
  const journal: JournalEntry = {
    id: createUuid(),
    companyId: params.companyId,
    branchId: params.branchId,
    journalNumber: seqRes.formatted,
    date: params.date,
    fiscalPeriodId: ensuredPeriod.period.id,
    reference: params.reference,
    description: params.description,
    sourceModule: params.sourceModule,
    sourceId: params.sourceId,
    idempotencyKey: params.idempotencyKey,
    status: 'posted',
    reversesJournalId: params.reversesJournalId,
    lines: normalized.lines,
    totalDebit: normalized.totalDebit,
    totalCredit: normalized.totalCredit,
    createdAt,
  };

  // Maintain readable flattened ledger projection rows linked to this journal
  const projectedRows: LedgerEntry[] = normalized.lines.map((line) => ({
    id: line.id,
    companyId: params.companyId,
    branchId: params.branchId,
    date: params.date,
    accountName: `${line.accountCode} · ${line.accountName}`,
    entryType: deriveLegacyLedgerType(line.accountCategory),
    amount: line.debit > 0 ? line.debit : line.credit,
    reference: `${journal.journalNumber} (${params.reference})`,
    description: line.memo || params.description,
    sourceModule: params.sourceModule,
    journalId: journal.id,
    createdAt,
  }));

  return {
    nextState: {
      ...seqRes.nextState,
      journals: [journal, ...seqRes.nextState.journals],
      ledgerEntries: [...projectedRows, ...seqRes.nextState.ledgerEntries],
    },
    journal,
  };
}

export function reverseJournalEntry(
  state: ErpDatabaseState,
  params: {
    companyId: string;
    branchId: string | null;
    journalId: string;
    reversalDate: string;
    reason: string;
  },
): { nextState: ErpDatabaseState; reversalJournal: JournalEntry } {
  const original = state.journals.find(
    (j) => j.id === params.journalId && j.companyId === params.companyId,
  );
  if (!original) {
    throw new ErpDomainError(
      'JOURNAL_NOT_FOUND',
      'Cannot reverse journal: entry does not belong to the active company.',
    );
  }
  if (original.status === 'reversed') {
    throw new ErpDomainError(
      'JOURNAL_ALREADY_REVERSED',
      `Journal ${original.journalNumber} has already been reversed.`,
    );
  }

  const reversalLines: DraftJournalLine[] = original.lines.map((line) => ({
    accountId: line.accountId,
    debit: line.credit,
    credit: line.debit,
    memo: `Reversal of ${original.journalNumber}: ${params.reason}`,
  }));

  const posted = postJournalEntry(state, {
    companyId: params.companyId,
    branchId: params.branchId,
    date: params.reversalDate,
    reference: `REV-${original.journalNumber}`,
    description: `Reversal of ${original.journalNumber} (${params.reason})`,
    sourceModule: original.sourceModule,
    sourceId: original.sourceId,
    idempotencyKey: `reversal:${original.id}`,
    lines: reversalLines,
    reversesJournalId: original.id,
  });

  return {
    nextState: {
      ...posted.nextState,
      journals: posted.nextState.journals.map((j) =>
        j.id === original.id
          ? { ...j, status: 'reversed', reversedByJournalId: posted.journal.id }
          : j,
      ),
    },
    reversalJournal: posted.journal,
  };
}

export interface TrialBalanceRow {
  accountId: string;
  code: string;
  name: string;
  category: AccountCategory;
  totalDebit: number;
  totalCredit: number;
  netBalance: number;
}

export function computeTrialBalance(
  state: ErpDatabaseState,
  companyId: string,
): {
  rows: TrialBalanceRow[];
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
} {
  const companyAccounts = state.accounts.filter((a) => a.companyId === companyId);
  const companyJournals = state.journals.filter((j) => j.companyId === companyId);

  const map = new Map<string, TrialBalanceRow>();
  for (const acc of companyAccounts) {
    map.set(acc.id, {
      accountId: acc.id,
      code: acc.code,
      name: acc.name,
      category: acc.category,
      totalDebit: 0,
      totalCredit: 0,
      netBalance: 0,
    });
  }

  for (const journal of companyJournals) {
    for (const line of journal.lines) {
      const row = map.get(line.accountId) ?? {
        accountId: line.accountId,
        code: line.accountCode,
        name: line.accountName,
        category: line.accountCategory,
        totalDebit: 0,
        totalCredit: 0,
        netBalance: 0,
      };
      row.totalDebit = roundMoney(row.totalDebit + line.debit);
      row.totalCredit = roundMoney(row.totalCredit + line.credit);
      row.netBalance =
        row.category === 'asset' || row.category === 'expense'
          ? roundMoney(row.totalDebit - row.totalCredit)
          : roundMoney(row.totalCredit - row.totalDebit);
      map.set(line.accountId, row);
    }
  }

  const rows = Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
  const totalDebits = roundMoney(rows.reduce((s, r) => s + r.totalDebit, 0));
  const totalCredits = roundMoney(rows.reduce((s, r) => s + r.totalCredit, 0));

  return {
    rows,
    totalDebits,
    totalCredits,
    isBalanced: Math.abs(totalDebits - totalCredits) < 0.005,
  };
}
