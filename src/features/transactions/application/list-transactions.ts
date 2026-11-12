import type { IsoDate } from '@/lib/dates';
import { Money } from '@/lib/money';

import type { LedgerContext } from './ledger-context';
import type { RecurrenceScheduler } from './recurrence-scheduler';
import type { Category } from '../domain/entities/category';
import type {
  Transaction,
  TransactionKind,
  TransactionStatus,
} from '../domain/entities/transaction';
import { countsAsExpense, countsAsIncome } from '../domain/rules/transaction-effects';

export type TransactionSort = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc';

export interface TransactionFilters {
  /** Período pela data de competência (inclusive). */
  start: IsoDate;
  end: IsoDate;
  kind?: TransactionKind | null;
  status?: TransactionStatus | null;
  categoryId?: string | null;
  accountId?: string | null;
  search?: string;
  sort?: TransactionSort;
  page?: number;
  pageSize?: number;
}

export interface TransactionView {
  transaction: Transaction;
  accountName: string;
  counterpartAccountName: string | null;
  categoryName: string | null;
  /** Vencida: pendente com vencimento anterior a hoje. */
  overdue: boolean;
}

export interface TransactionPage {
  items: TransactionView[];
  total: number;
  page: number;
  pageCount: number;
  /** Totais do conjunto filtrado inteiro (não só da página); cancelados não entram. */
  totals: { income: Money; expenses: Money; result: Money };
}

export const DEFAULT_PAGE_SIZE = 20;

/** Remove acentos e caixa: "Farmácia" é encontrada por "farmacia". */
export function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

function matchesSearch(view: TransactionView, term: string): boolean {
  if (!term) return true;
  const haystack = [
    view.transaction.description,
    view.transaction.notes ?? '',
    view.categoryName ?? '',
    ...view.transaction.tags,
  ]
    .map(normalizeSearch)
    .join(' ');
  return term.split(/\s+/).every((word) => haystack.includes(word));
}

const COMPARATORS: Record<TransactionSort, (a: TransactionView, b: TransactionView) => number> = {
  date_desc: (a, b) => compareDate(b, a),
  date_asc: (a, b) => compareDate(a, b),
  amount_desc: (a, b) => b.transaction.amount.compare(a.transaction.amount) || compareDate(b, a),
  amount_asc: (a, b) => a.transaction.amount.compare(b.transaction.amount) || compareDate(b, a),
};

function compareDate(a: TransactionView, b: TransactionView): number {
  const left = a.transaction.competenceDate;
  const right = b.transaction.competenceDate;
  if (left !== right) return left < right ? -1 : 1;
  return a.transaction.id < b.transaction.id ? -1 : a.transaction.id > b.transaction.id ? 1 : 0;
}

/** Lista paginada de movimentações de conta com filtros, busca e ordenação. */
export class ListTransactionsUseCase {
  constructor(
    private readonly context: LedgerContext,
    private readonly scheduler: RecurrenceScheduler,
  ) {}

  async execute(filters: TransactionFilters): Promise<TransactionPage> {
    await this.scheduler.ensure();
    const [transactions, accounts, categories] = await Promise.all([
      this.context.transactions.findAll(),
      this.context.accounts.findAll(),
      this.context.categories.findAll(),
    ]);
    const today = this.context.today();
    const accountName = new Map(accounts.map((account) => [account.id, account.name]));
    const categoryById = new Map<string, Category>(categories.map((item) => [item.id, item]));
    const term = normalizeSearch(filters.search ?? '');

    const views = transactions
      .filter(
        (tx) =>
          tx.competenceDate >= filters.start &&
          tx.competenceDate <= filters.end &&
          (!filters.kind || tx.kind === filters.kind) &&
          (!filters.status || tx.status === filters.status) &&
          (!filters.categoryId || tx.categoryId === filters.categoryId) &&
          (!filters.accountId || tx.accountId === filters.accountId),
      )
      .map((transaction): TransactionView => ({
        transaction,
        accountName: accountName.get(transaction.accountId) ?? 'Conta removida',
        counterpartAccountName: transaction.transfer
          ? (accountName.get(transaction.transfer.counterpartAccountId) ?? null)
          : null,
        categoryName: transaction.categoryId
          ? (categoryById.get(transaction.categoryId)?.name ?? null)
          : null,
        overdue:
          transaction.status === 'pending' &&
          transaction.dueDate !== null &&
          transaction.dueDate < today,
      }))
      .filter((view) => matchesSearch(view, term))
      .sort(COMPARATORS[filters.sort ?? 'date_desc']);

    const income = Money.sum(
      views
        .filter((view) => countsAsIncome(view.transaction))
        .map((view) => view.transaction.amount),
    );
    const expenses = Money.sum(
      views
        .filter((view) => countsAsExpense(view.transaction))
        .map((view) => view.transaction.amount),
    );

    const pageSize = Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE);
    const pageCount = Math.max(1, Math.ceil(views.length / pageSize));
    const page = Math.min(Math.max(1, filters.page ?? 1), pageCount);

    return {
      items: views.slice((page - 1) * pageSize, page * pageSize),
      total: views.length,
      page,
      pageCount,
      totals: { income, expenses, result: income.subtract(expenses) },
    };
  }
}
