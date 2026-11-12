import { createAccountUseCases, type Account, type AccountRepository } from '@/features/accounts';
import type { AuditEntry, AuditLogRepository } from '@/features/history';
import {
  createTransactionUseCases,
  type Category,
  type CategoryRepository,
  type CategoryUsageChecker,
  type LedgerChanges,
  type LedgerContext,
  type Recurrence,
  type Transaction,
  type TransactionRepository,
} from '@/features/transactions';
import { asIsoDate, type IsoDate } from '@/lib/dates';
import { Money } from '@/lib/money';

/**
 * Implementações em memória das portas de lançamentos e contas, para testar
 * casos de uso sem IndexedDB nem HTTP. `commit` é atômico por construção.
 */
export function createInMemoryLedger(
  options: {
    today?: string;
    accounts?: Account[];
    categories?: Category[];
    transactions?: Transaction[];
    recurrences?: Recurrence[];
    usageCheckers?: CategoryUsageChecker[];
  } = {},
) {
  let today: IsoDate = asIsoDate(options.today ?? '2026-03-10');
  const accounts = new Map((options.accounts ?? defaultAccounts()).map((a) => [a.id, a]));
  const categories = new Map((options.categories ?? defaultCategories()).map((c) => [c.id, c]));
  const transactions = new Map((options.transactions ?? []).map((t) => [t.id, t]));
  const recurrences = new Map((options.recurrences ?? []).map((r) => [r.id, r]));
  const auditLog: AuditEntry[] = [];
  let sequence = 0;

  const transactionRepository: TransactionRepository = {
    findAll: () => Promise.resolve([...transactions.values()]),
    findById: (id) => Promise.resolve(transactions.get(id) ?? null),
    findRecurrences: () => Promise.resolve([...recurrences.values()]),
    commit: (changes: LedgerChanges) => {
      for (const id of changes.remove ?? []) transactions.delete(id);
      for (const tx of changes.upsert ?? []) transactions.set(tx.id, tx);
      for (const id of changes.removeRecurrences ?? []) recurrences.delete(id);
      for (const item of changes.upsertRecurrences ?? []) recurrences.set(item.id, item);
      return Promise.resolve();
    },
  };
  const accountRepository: AccountRepository = {
    findAll: () => Promise.resolve([...accounts.values()]),
    findById: (id) => Promise.resolve(accounts.get(id) ?? null),
    save: (account) => {
      accounts.set(account.id, account);
      return Promise.resolve();
    },
  };
  const categoryRepository: CategoryRepository = {
    findAll: () => Promise.resolve([...categories.values()]),
    save: (category) => {
      categories.set(category.id, category);
      return Promise.resolve();
    },
    remove: (id) => {
      categories.delete(id);
      return Promise.resolve();
    },
  };
  const audit: AuditLogRepository = {
    findByEntity: (type, id) =>
      Promise.resolve(auditLog.filter((e) => e.entityType === type && e.entityId === id)),
    append: (entries) => {
      auditLog.push(...entries);
      return Promise.resolve();
    },
  };

  const context: LedgerContext = {
    transactions: transactionRepository,
    accounts: accountRepository,
    categories: categoryRepository,
    audit,
    newId: () => `id-${++sequence}`,
    today: () => today,
    now: () => `${today}T12:00:00-03:00`,
  };

  const ledger = createTransactionUseCases(context, options.usageCheckers);
  const accountsUseCases = createAccountUseCases({
    ...context,
    prepare: () => ledger.scheduler.ensure(),
  });

  return {
    context,
    ledger,
    accounts: accountsUseCases,
    state: { transactions, recurrences, accounts, categories, auditLog },
    setToday(value: string) {
      today = asIsoDate(value);
    },
    all: () =>
      [...transactions.values()].sort((a, b) => a.competenceDate.localeCompare(b.competenceDate)),
  };
}

export function defaultAccounts(): Account[] {
  return [
    {
      id: 'checking',
      name: 'Corrente',
      type: 'checking',
      institution: 'Banco',
      initialBalance: Money.of('1000'),
      initialBalanceDate: asIsoDate('2026-01-01'),
      archived: false,
    },
    {
      id: 'savings',
      name: 'Poupança',
      type: 'savings',
      institution: 'Banco',
      initialBalance: Money.zero(),
      initialBalanceDate: asIsoDate('2026-01-01'),
      archived: false,
    },
    {
      id: 'old',
      name: 'Conta antiga',
      type: 'checking',
      institution: null,
      initialBalance: Money.zero(),
      initialBalanceDate: asIsoDate('2026-01-01'),
      archived: true,
    },
  ];
}

export function defaultCategories(): Category[] {
  return [
    { id: 'salary', name: 'Salário', kind: 'income', nature: 'fixed' },
    { id: 'food', name: 'Alimentação', kind: 'expense', nature: 'variable' },
    { id: 'health', name: 'Saúde', kind: 'expense', nature: 'fixed' },
  ];
}
