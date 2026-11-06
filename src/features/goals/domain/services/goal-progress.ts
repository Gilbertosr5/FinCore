import { differenceInCalendarMonths, type IsoDate } from '@/lib/dates';
import { Money } from '@/lib/money';

import type { Goal, GoalContribution } from '../entities/goal';

export interface GoalProgress {
  goal: Goal;
  accumulated: Money;
  remaining: Money;
  /** Percentual atingido (pode passar de 100). */
  percent: number;
  /** Meses restantes até a data-alvo (null sem data-alvo). */
  monthsLeft: number | null;
  /**
   * Aporte mensal necessário para atingir a meta no prazo (estimativa linear,
   * sem rendimentos). null sem data-alvo ou com a meta já atingida.
   */
  monthlyRequired: Money | null;
  /** Data-alvo já passou sem a meta ser atingida. */
  overdue: boolean;
}

/** Progresso calculado dinamicamente a partir dos aportes e retiradas até `today`. */
export function computeGoalProgress(
  goal: Goal,
  contributions: readonly GoalContribution[],
  today: IsoDate,
): GoalProgress {
  const currency = goal.targetAmount.currency;
  const zero = Money.zero(currency);
  const accumulated = contributions
    .filter((item) => item.goalId === goal.id && item.date <= today)
    .reduce(
      (total, item) =>
        item.type === 'deposit' ? total.add(item.amount) : total.subtract(item.amount),
      zero,
    )
    .max(zero);

  const remaining = goal.targetAmount.subtract(accumulated).max(zero);
  const percentDecimal = accumulated.percentageOf(goal.targetAmount);
  const percent = percentDecimal === null ? 100 : percentDecimal.toNumber();

  let monthsLeft: number | null = null;
  let monthlyRequired: Money | null = null;
  let overdue = false;
  if (goal.targetDate) {
    monthsLeft = Math.max(differenceInCalendarMonths(goal.targetDate, today), 0);
    overdue = goal.targetDate < today && remaining.isPositive();
    if (remaining.isPositive()) {
      monthlyRequired = monthsLeft > 0 ? remaining.divide(monthsLeft) : remaining;
    }
  }

  return { goal, accumulated, remaining, percent, monthsLeft, monthlyRequired, overdue };
}
