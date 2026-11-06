import { endOfMonth, startOfMonth, toIsoDate, getDateParts, type IsoDate } from '@/lib/dates';
import { Money } from '@/lib/money';

import type { Budget } from '../entities/budget';

export type BudgetUsageStatus = 'ok' | 'warning' | 'exceeded';

export interface BudgetUsage {
  budget: Budget;
  spent: Money;
  /** Disponível (zero quando excedido). */
  remaining: Money;
  /** Valor acima do limite (zero quando dentro do limite). */
  excess: Money;
  /** Percentual consumido; null se o limite for zero. */
  percent: number | null;
  status: BudgetUsageStatus;
}

/** Período corrente do orçamento (mês ou ano que contém `today`). */
export function getBudgetPeriod(
  budget: Pick<Budget, 'period'>,
  today: IsoDate,
): { start: IsoDate; end: IsoDate } {
  if (budget.period === 'monthly') return { start: startOfMonth(today), end: endOfMonth(today) };
  const { year } = getDateParts(today);
  return {
    start: toIsoDate({ year, month: 1, day: 1 }),
    end: toIsoDate({ year, month: 12, day: 31 }),
  };
}

/**
 * Uso do orçamento: alerta ao atingir o limiar (ex.: 80%) e excedido quando o
 * gasto ultrapassa o limite (> 100%), informando o excedente.
 */
export function computeBudgetUsage(budget: Budget, spent: Money): BudgetUsage {
  const zero = Money.zero(budget.amount.currency);
  const percentDecimal = spent.percentageOf(budget.amount);
  const percent = percentDecimal === null ? null : percentDecimal.toNumber();
  const exceeded = spent.greaterThan(budget.amount);
  // Comparação exata (gasto × 100 ≥ limite × limiar): o percentual exibido é
  // arredondado e não pode antecipar o alerta (79,998% não é 80%).
  const reachedThreshold =
    !budget.amount.isZero() &&
    spent
      .toDecimal()
      .times(100)
      .greaterThanOrEqualTo(budget.amount.toDecimal().times(budget.alertThresholdPercent));
  const status: BudgetUsageStatus = exceeded ? 'exceeded' : reachedThreshold ? 'warning' : 'ok';
  return {
    budget,
    spent,
    remaining: budget.amount.subtract(spent).max(zero),
    excess: spent.subtract(budget.amount).max(zero),
    percent,
    status,
  };
}
