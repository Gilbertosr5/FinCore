import type { Account } from '@/features/accounts/domain/entities/account';
import type { Budget } from '@/features/budgets/domain/entities/budget';
import type { CardPurchase, CreditCard } from '@/features/credit-cards/domain/entities/credit-card';
import { getCardInstallments } from '@/features/credit-cards/domain/services/invoices';
import type { Recurrence } from '@/features/transactions/domain/entities/recurrence';
import type { Transaction } from '@/features/transactions/domain/entities/transaction';
import {
  countsAsExpense,
  countsAsIncome,
} from '@/features/transactions/domain/rules/transaction-effects';
import { buildMissingOccurrences } from '@/features/transactions/domain/services/recurrence-schedule';
import { addMonthsToKey, toMonthKey, type IsoDate, type MonthKey } from '@/lib/dates';
import { Money } from '@/lib/money';

/** Dados de origem do planejamento (lidos dos repositórios). */
export interface PlanningData {
  accounts: Account[];
  transactions: Transaction[];
  recurrences: Recurrence[];
  cards: CreditCard[];
  purchases: CardPurchase[];
  budgets: Budget[];
}

export type FlowType = 'income' | 'expense';

/**
 * Receita ou despesa por COMPETÊNCIA, de qualquer origem. Transferências,
 * pagamentos de fatura, aplicações e cancelados nunca viram fluxo (ADR 0007).
 */
export interface Flow {
  type: FlowType;
  amount: Money;
  date: IsoDate;
  categoryId: string | null;
  /** Ainda não pago/recebido (lançamento de conta ou ocorrência futura de recorrência). */
  pending: boolean;
  /** Parcela de cartão (o caixa sai ao pagar a fatura — tratada como passivo). */
  card: boolean;
  /** Gasto/receita "do dia a dia": não vem de recorrência nem de parcelamento. */
  variable: boolean;
}

/**
 * Todos os fluxos conhecidos até `until`: lançamentos de conta, ocorrências
 * futuras de recorrências (ainda não materializadas) e parcelas de cartão.
 */
export function collectFlows(data: PlanningData, until: IsoDate): Flow[] {
  const virtual = data.recurrences.flatMap((recurrence) =>
    buildMissingOccurrences(recurrence, data.transactions, until),
  );
  const fromAccounts = [...data.transactions, ...virtual].flatMap((tx): Flow[] => {
    const type = countsAsIncome(tx) ? 'income' : countsAsExpense(tx) ? 'expense' : null;
    if (!type) return [];
    return [
      {
        type,
        amount: tx.amount,
        date: tx.competenceDate,
        categoryId: tx.categoryId,
        pending: tx.status === 'pending',
        card: false,
        variable: tx.recurrenceId === null && tx.installment === null,
      },
    ];
  });
  const fromCards = data.cards.flatMap((card) =>
    getCardInstallments(card, data.purchases).map((item): Flow => ({
      type: 'expense',
      amount: item.amount,
      date: item.competenceDate,
      categoryId: item.categoryId,
      pending: false,
      card: true,
      variable: item.total === 1,
    })),
  );
  return [...fromAccounts, ...fromCards];
}

/** Meses completos usados para estimar receitas e despesas variáveis. */
export const VARIABLE_WINDOW_MONTHS = 3;

export interface VariableAverages {
  /** Meses efetivamente considerados (pode ser menos que 3 para históricos curtos). */
  months: MonthKey[];
  income: Map<string | null, Money>;
  expenses: Map<string | null, Money>;
  totalIncome: Money;
  totalExpenses: Money;
}

/**
 * Média mensal, por categoria, dos fluxos variáveis dos últimos meses
 * completos (antes do mês atual). Base das ESTIMATIVAS dos meses futuros.
 */
export function computeVariableAverages(flows: readonly Flow[], today: IsoDate): VariableAverages {
  const current = toMonthKey(today);
  const firstMonth = flows.reduce<MonthKey | null>((min, flow) => {
    const month = toMonthKey(flow.date);
    return min === null || month < min ? month : min;
  }, null);
  const months = Array.from({ length: VARIABLE_WINDOW_MONTHS }, (_, index) =>
    addMonthsToKey(current, -(VARIABLE_WINDOW_MONTHS - index)),
  ).filter((month) => firstMonth !== null && month >= firstMonth);

  const income = new Map<string | null, Money>();
  const expenses = new Map<string | null, Money>();
  if (months.length > 0) {
    const window = new Set<string>(months);
    for (const flow of flows) {
      if (!flow.variable || !window.has(toMonthKey(flow.date))) continue;
      const target = flow.type === 'income' ? income : expenses;
      target.set(flow.categoryId, (target.get(flow.categoryId) ?? Money.zero()).add(flow.amount));
    }
    for (const target of [income, expenses]) {
      for (const [key, value] of target) target.set(key, value.divide(months.length));
    }
  }
  return {
    months,
    income,
    expenses,
    totalIncome: Money.sum([...income.values()]),
    totalExpenses: Money.sum([...expenses.values()]),
  };
}
