import {
  addMonthsToKey,
  asMonthKey,
  daysInMonth,
  getDateParts,
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
  type FlowType,
  type PlanningData,
  type VariableAverages,
} from './flows';

export type PlanMonthStatus = 'realized' | 'current' | 'forecast';

export const PLAN_MONTH_STATUS_LABELS: Record<PlanMonthStatus, string> = {
  realized: 'Realizado',
  current: 'Em andamento',
  forecast: 'Previsto',
};

/**
 * Valores de um mês por competência:
 * - realized: competência até hoje (inclui pendentes já vencidos);
 * - scheduled: já conhecido para depois de hoje (pendentes, recorrências, parcelas);
 * - estimated: média dos variáveis (ESTIMATIVA) para o que ainda não aconteceu.
 */
export interface PlanAmounts {
  realized: Money;
  scheduled: Money;
  estimated: Money;
  total: Money;
}

export interface CategoryPlanLine extends PlanAmounts {
  categoryId: string | null;
  /** Limite do orçamento mensal ativo da categoria (somente despesas). */
  budget: Money | null;
}

export interface MonthPlan {
  month: MonthKey;
  status: PlanMonthStatus;
  income: PlanAmounts;
  expenses: PlanAmounts;
  result: Money;
  incomeByCategory: CategoryPlanLine[];
  expensesByCategory: CategoryPlanLine[];
  /** Orçamento mensal geral (ou soma dos orçamentos mensais por categoria); null sem orçamentos. */
  budgeted: Money | null;
}

export interface AnnualPlan {
  year: number;
  months: MonthPlan[];
  income: PlanAmounts;
  expenses: PlanAmounts;
  result: Money;
  averages: VariableAverages;
}

const zero = () => Money.zero();

function amounts(realized: Money, scheduled: Money, estimated: Money): PlanAmounts {
  return { realized, scheduled, estimated, total: realized.add(scheduled).add(estimated) };
}

function sumAmounts(list: readonly PlanAmounts[]): PlanAmounts {
  return amounts(
    Money.sum(list.map((item) => item.realized)),
    Money.sum(list.map((item) => item.scheduled)),
    Money.sum(list.map((item) => item.estimated)),
  );
}

function statusOf(month: MonthKey, today: IsoDate): PlanMonthStatus {
  const current = toMonthKey(today);
  return month < current ? 'realized' : month === current ? 'current' : 'forecast';
}

function estimateShare(status: PlanMonthStatus, today: IsoDate): number {
  if (status === 'realized') return 0;
  if (status === 'forecast') return 1;
  const { year, month, day } = getDateParts(today);
  const days = daysInMonth(year, month);
  return (days - day) / days;
}

function categoryLines(
  type: FlowType,
  monthFlows: readonly Flow[],
  averages: Map<string | null, Money>,
  share: number,
  today: IsoDate,
  budgets: Map<string, Money>,
): CategoryPlanLine[] {
  const keys = new Set<string | null>([
    ...monthFlows.filter((flow) => flow.type === type).map((flow) => flow.categoryId),
    ...(share > 0 ? averages.keys() : []),
    ...(type === 'expense' ? budgets.keys() : []),
  ]);
  return [...keys]
    .map((categoryId): CategoryPlanLine => {
      const own = monthFlows.filter((flow) => flow.type === type && flow.categoryId === categoryId);
      const realized = Money.sum(own.filter((flow) => flow.date <= today).map((f) => f.amount));
      const scheduled = Money.sum(own.filter((flow) => flow.date > today).map((f) => f.amount));
      const estimated = (averages.get(categoryId) ?? zero()).multiply(share);
      return {
        categoryId,
        ...amounts(realized, scheduled, estimated),
        budget: categoryId === null ? null : (budgets.get(categoryId) ?? null),
      };
    })
    .filter((line) => !line.total.isZero() || line.budget !== null)
    .sort((a, b) => b.total.compare(a.total));
}

function buildMonth(
  month: MonthKey,
  flows: readonly Flow[],
  averages: VariableAverages,
  today: IsoDate,
  data: PlanningData,
): MonthPlan {
  const status = statusOf(month, today);
  const share = estimateShare(status, today);
  const monthFlows = flows.filter((flow) => toMonthKey(flow.date) === month);
  const monthlyBudgets = data.budgets.filter(
    (budget) => budget.active && budget.period === 'monthly',
  );
  const byCategory = new Map(
    monthlyBudgets.flatMap((budget) =>
      budget.categoryId === null ? [] : [[budget.categoryId, budget.amount] as const],
    ),
  );
  const general = monthlyBudgets.find((budget) => budget.categoryId === null);
  const budgeted = general
    ? general.amount
    : byCategory.size > 0
      ? Money.sum([...byCategory.values()])
      : null;

  const incomeByCategory = categoryLines(
    'income',
    monthFlows,
    averages.income,
    share,
    today,
    new Map(),
  );
  const expensesByCategory = categoryLines(
    'expense',
    monthFlows,
    averages.expenses,
    share,
    today,
    byCategory,
  );
  const income = sumAmounts(incomeByCategory);
  const expenses = sumAmounts(expensesByCategory);
  return {
    month,
    status,
    income,
    expenses,
    result: income.total.subtract(expenses.total),
    incomeByCategory,
    expensesByCategory,
    budgeted,
  };
}

/** Plano de um mês: realizado + previsto por categoria, com orçamento. */
export function buildMonthPlan(data: PlanningData, today: IsoDate, month: MonthKey): MonthPlan {
  const flows = collectFlows(data, monthEnd(month));
  return buildMonth(month, flows, computeVariableAverages(flows, today), today, data);
}

/** Plano anual: 12 meses (realizados, mês atual e previstos) e totais do ano. */
export function buildAnnualPlan(data: PlanningData, today: IsoDate, year: number): AnnualPlan {
  const december = asMonthKey(`${year}-12`);
  const flows = collectFlows(data, monthEnd(december));
  const averages = computeVariableAverages(flows, today);
  const january = asMonthKey(`${year}-01`);
  const months = Array.from({ length: 12 }, (_, index) =>
    buildMonth(addMonthsToKey(january, index), flows, averages, today, data),
  );
  const income = sumAmounts(months.map((item) => item.income));
  const expenses = sumAmounts(months.map((item) => item.expenses));
  return {
    year,
    months,
    income,
    expenses,
    result: income.total.subtract(expenses.total),
    averages,
  };
}
