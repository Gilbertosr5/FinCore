import { getCardInstallments } from '@/features/credit-cards/domain/services/invoices';
import {
  countsAsExpense,
  countsAsIncome,
} from '@/features/transactions/domain/rules/transaction-effects';
import type { IsoDate } from '@/lib/dates';
import { Money } from '@/lib/money';

import type { DashboardData } from './dashboard-data';
import type { DateRange } from './period';

/**
 * Lançamento de resultado (receita ou despesa de consumo) em regime de
 * competência, unificando movimentações de conta e parcelas de cartão.
 *
 * Fontes de despesa:
 * - despesas de conta (kind = expense, não canceladas);
 * - parcelas de compras no cartão (na competência da parcela).
 * Nunca entram: transferências, pagamentos de fatura, aplicações/resgates e
 * lançamentos cancelados — evitando contabilização duplicada.
 */
export interface FinancialEntry {
  id: string;
  type: 'income' | 'expense';
  amount: Money;
  date: IsoDate;
  categoryId: string | null;
  /** Ainda não pago/recebido (somente lançamentos de conta). */
  pending: boolean;
}

export function getFinancialEntries(
  data: Pick<DashboardData, 'transactions' | 'cards' | 'purchases'>,
): FinancialEntry[] {
  const accountEntries = data.transactions.flatMap((tx): FinancialEntry[] => {
    const type = countsAsIncome(tx) ? 'income' : countsAsExpense(tx) ? 'expense' : null;
    if (!type) return [];
    return [
      {
        id: tx.id,
        type,
        amount: tx.amount,
        date: tx.competenceDate,
        categoryId: tx.categoryId,
        pending: tx.status === 'pending',
      },
    ];
  });

  const cardEntries = data.cards.flatMap((card) =>
    getCardInstallments(card, data.purchases).map((installment): FinancialEntry => ({
      id: `${installment.purchaseId}#${installment.number}`,
      type: 'expense',
      amount: installment.amount,
      date: installment.competenceDate,
      categoryId: installment.categoryId,
      pending: false,
    })),
  );

  return [...accountEntries, ...cardEntries];
}

export function entriesInRange(entries: readonly FinancialEntry[], range: DateRange) {
  return entries.filter((entry) => entry.date >= range.start && entry.date <= range.end);
}

export interface PeriodTotals {
  income: Money;
  incomePending: Money;
  expenses: Money;
  expensesPending: Money;
  result: Money;
  /** Resultado ÷ receitas, em pontos percentuais; null sem receitas. */
  savingsRate: number | null;
}

export function sumPeriod(entries: readonly FinancialEntry[]): PeriodTotals {
  const sum = (type: FinancialEntry['type'], pendingOnly = false) =>
    Money.sum(
      entries
        .filter((entry) => entry.type === type && (!pendingOnly || entry.pending))
        .map((entry) => entry.amount),
    );
  const income = sum('income');
  const expenses = sum('expense');
  const result = income.subtract(expenses);
  const rate = result.percentageOf(income);
  return {
    income,
    incomePending: sum('income', true),
    expenses,
    expensesPending: sum('expense', true),
    result,
    savingsRate: rate === null ? null : rate.toNumber(),
  };
}
