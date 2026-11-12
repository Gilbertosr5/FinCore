import {
  computeAccountBalances,
  sumBalances,
} from '@/features/accounts/domain/services/account-balance';
import { computeCardDebt } from '@/features/credit-cards/domain/services/invoices';
import {
  addMonthsToKey,
  getDateParts,
  daysInMonth,
  monthEnd,
  toMonthKey,
  type IsoDate,
  type MonthKey,
} from '@/lib/dates';
import { Money } from '@/lib/money';

import {
  collectFlows,
  computeVariableAverages,
  type Flow,
  type PlanningData,
  type VariableAverages,
} from './flows';

/** Ajustes percentuais de um cenário sobre o que é ESTIMADO. */
export interface ScenarioAdjustments {
  /** Variação das receitas previstas (ex.: -10 = 10% a menos). */
  incomeChangePercent: number;
  /** Variação das despesas variáveis estimadas (compromissos fixos não mudam). */
  expenseChangePercent: number;
}

export type ScenarioKey = 'base' | 'optimistic' | 'conservative' | 'custom';

export const SCENARIO_LABELS: Record<ScenarioKey, string> = {
  base: 'Base',
  optimistic: 'Otimista',
  conservative: 'Conservador',
  custom: 'Personalizado',
};

export const SCENARIO_PRESETS: Record<Exclude<ScenarioKey, 'custom'>, ScenarioAdjustments> = {
  base: { incomeChangePercent: 0, expenseChangePercent: 0 },
  optimistic: { incomeChangePercent: 5, expenseChangePercent: -10 },
  conservative: { incomeChangePercent: -10, expenseChangePercent: 10 },
};

/** Grande compra simulada (não é gravada): valor total dividido a partir do mês. */
export interface PlannedPurchase {
  amount: Money;
  month: MonthKey;
  installments: number;
}

export interface ProjectionMonth {
  month: MonthKey;
  /** Mês atual: considera apenas o que ainda falta acontecer. */
  current: boolean;
  scheduledIncome: Money;
  estimatedIncome: Money;
  scheduledExpenses: Money;
  cardInstallments: Money;
  estimatedExpenses: Money;
  plannedPurchase: Money;
  income: Money;
  expenses: Money;
  result: Money;
  /** Saldo projetado ao fim do mês (ESTIMATIVA). */
  balance: Money;
}

export interface BalanceProjection {
  today: IsoDate;
  accountsBalance: Money;
  /** Parcelas de cartão já vencidas por competência e ainda não pagas. */
  cardLiability: Money;
  /** Ponto de partida: saldo das contas − faturas já comprometidas. */
  startingBalance: Money;
  months: ProjectionMonth[];
  lowest: { month: MonthKey; balance: Money };
  averages: VariableAverages;
  scenario: ScenarioAdjustments;
}

export const MAX_PROJECTION_MONTHS = 60;

const factor = (percent: number) => 1 + percent / 100;
const sum = (flows: readonly Flow[]) => Money.sum(flows.map((flow) => flow.amount));

function plannedAmount(purchases: readonly PlannedPurchase[], month: MonthKey): Money {
  return Money.sum(
    purchases.flatMap((purchase) =>
      purchase.amount
        .allocate(purchase.installments)
        .filter((_, index) => addMonthsToKey(purchase.month, index) === month),
    ),
  );
}

/**
 * Projeção do saldo mês a mês (regime de competência, ESTIMATIVA):
 * - parte do saldo das contas menos as parcelas de cartão já devidas;
 * - soma receitas/despesas pendentes, ocorrências futuras de recorrências e
 *   parcelas de cartão já lançadas;
 * - acrescenta a média dos gastos e receitas variáveis dos últimos meses
 *   (proporcional aos dias restantes no mês atual);
 * - aplica o cenário e as grandes compras simuladas.
 */
export function buildBalanceProjection(
  data: PlanningData,
  today: IsoDate,
  options: {
    months: number;
    scenario: ScenarioAdjustments;
    purchases?: readonly PlannedPurchase[];
  },
): BalanceProjection {
  const monthsCount = Math.min(Math.max(Math.trunc(options.months), 1), MAX_PROJECTION_MONTHS);
  const currentMonth = toMonthKey(today);
  const lastMonth = addMonthsToKey(currentMonth, monthsCount - 1);
  const flows = collectFlows(data, monthEnd(lastMonth));
  const averages = computeVariableAverages(flows, today);
  const purchases = options.purchases ?? [];
  const incomeFactor = factor(options.scenario.incomeChangePercent);
  const expenseFactor = factor(options.scenario.expenseChangePercent);

  const accountsBalance = sumBalances(
    computeAccountBalances(
      data.accounts.filter((account) => !account.archived),
      data.transactions,
      today,
    ),
  );
  const totalDebt = Money.sum(
    data.cards.map((card) => computeCardDebt(card, data.purchases, data.transactions, today)),
  );
  const futureInstallments = sum(flows.filter((flow) => flow.card && flow.date > today));
  const cardLiability = totalDebt.subtract(futureInstallments).max(Money.zero());
  const startingBalance = accountsBalance.subtract(cardLiability);

  const { day, year, month } = getDateParts(today);
  const monthDays = daysInMonth(year, month);
  const remainingFraction = (monthDays - day) / monthDays;

  let balance = startingBalance;
  const rows = Array.from({ length: monthsCount }, (_, index): ProjectionMonth => {
    const key = addMonthsToKey(currentMonth, index);
    const current = index === 0;
    const end = monthEnd(key);
    // Mês atual: pendentes até o fim do mês (inclui atrasados); futuros: só o mês.
    const inMonth = (flow: Flow) => (current ? flow.date <= end : toMonthKey(flow.date) === key);
    const accountFlows = flows.filter((flow) => !flow.card && flow.pending && inMonth(flow));
    const scheduledIncome = sum(accountFlows.filter((flow) => flow.type === 'income'));
    const scheduledExpenses = sum(accountFlows.filter((flow) => flow.type === 'expense'));
    const cardInstallments = sum(
      flows.filter((flow) => flow.card && flow.date > today && toMonthKey(flow.date) === key),
    );
    const share = current ? remainingFraction : 1;
    const estimatedIncome = averages.totalIncome.multiply(share);
    const estimatedExpenses = averages.totalExpenses.multiply(share * expenseFactor);
    const plannedPurchase = plannedAmount(purchases, key);

    const income = scheduledIncome.add(estimatedIncome).multiply(incomeFactor);
    const expenses = scheduledExpenses
      .add(cardInstallments)
      .add(estimatedExpenses)
      .add(plannedPurchase);
    const result = income.subtract(expenses);
    balance = balance.add(result);
    return {
      month: key,
      current,
      scheduledIncome,
      estimatedIncome,
      scheduledExpenses,
      cardInstallments,
      estimatedExpenses,
      plannedPurchase,
      income,
      expenses,
      result,
      balance,
    };
  });

  const lowest = rows.reduce(
    (min, row) =>
      row.balance.lessThan(min.balance) ? { month: row.month, balance: row.balance } : min,
    { month: currentMonth, balance: rows[0]?.balance ?? startingBalance },
  );

  return {
    today,
    accountsBalance,
    cardLiability,
    startingBalance,
    months: rows,
    lowest,
    averages,
    scenario: options.scenario,
  };
}
