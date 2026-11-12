import type { Account } from '@/features/accounts/domain/entities/account';
import type { Budget } from '@/features/budgets/domain/entities/budget';
import type { CardPurchase, CreditCard } from '@/features/credit-cards/domain/entities/credit-card';
import { getCardInstallments } from '@/features/credit-cards/domain/services/invoices';
import type {
  Asset,
  AssetValuation,
  InvestmentMovement,
} from '@/features/investments/domain/entities/investment';
import type { Category } from '@/features/transactions/domain/entities/category';
import type { Recurrence } from '@/features/transactions/domain/entities/recurrence';
import type { Transaction } from '@/features/transactions/domain/entities/transaction';
import {
  countsAsExpense,
  countsAsIncome,
} from '@/features/transactions/domain/rules/transaction-effects';
import { monthKeysBetween, toMonthKey, type IsoDate, type MonthKey } from '@/lib/dates';
import type { Money } from '@/lib/money';

/** Dados de origem dos relatórios (lidos uma vez; tudo é calculado). */
export interface ReportData {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  recurrences: Recurrence[];
  cards: CreditCard[];
  purchases: CardPurchase[];
  budgets: Budget[];
  assets: Asset[];
  movements: InvestmentMovement[];
  valuations: AssetValuation[];
}

export interface ReportFilters {
  start: IsoDate;
  end: IsoDate;
  /** Conta específica (relatórios de receitas/despesas e caixa); null = todas. */
  accountId: string | null;
}

/**
 * Receita/despesa por COMPETÊNCIA (mesmas regras do dashboard — ADR 0007):
 * lançamentos de conta não cancelados e parcelas de cartão. Transferências,
 * pagamentos de fatura e aplicações nunca entram. Com filtro de conta, as
 * parcelas de cartão (que não pertencem a uma conta) ficam de fora.
 */
export interface ReportEntry {
  type: 'income' | 'expense';
  amount: Money;
  date: IsoDate;
  categoryId: string | null;
  accountId: string | null;
}

export function collectEntries(data: ReportData, filters: ReportFilters): ReportEntry[] {
  const fromAccounts = data.transactions.flatMap((tx): ReportEntry[] => {
    if (filters.accountId !== null && tx.accountId !== filters.accountId) return [];
    const type = countsAsIncome(tx) ? 'income' : countsAsExpense(tx) ? 'expense' : null;
    if (!type) return [];
    return [
      {
        type,
        amount: tx.amount,
        date: tx.competenceDate,
        categoryId: tx.categoryId,
        accountId: tx.accountId,
      },
    ];
  });
  const fromCards =
    filters.accountId !== null
      ? []
      : data.cards.flatMap((card) =>
          getCardInstallments(card, data.purchases).map((item): ReportEntry => ({
            type: 'expense',
            amount: item.amount,
            date: item.competenceDate,
            categoryId: item.categoryId,
            accountId: null,
          })),
        );
  return [...fromAccounts, ...fromCards].filter(
    (entry) => entry.date >= filters.start && entry.date <= filters.end,
  );
}

/** Meses (competência) cobertos pelo período. */
export function monthsOf(filters: Pick<ReportFilters, 'start' | 'end'>): MonthKey[] {
  return monthKeysBetween(toMonthKey(filters.start), toMonthKey(filters.end));
}
