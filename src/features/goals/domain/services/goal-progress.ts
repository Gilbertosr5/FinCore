import { addMonths, differenceInCalendarMonths, endOfMonth, type IsoDate } from '@/lib/dates';
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

/** Janela usada para medir o ritmo de aportes. */
export const GOAL_PACE_WINDOW_MONTHS = 6;

export interface GoalProjection {
  /** Ritmo atual: (aportes − retiradas) por mês na janela recente. ESTIMATIVA. */
  averageMonthly: Money;
  /** Mês estimado de conclusão no ritmo atual (null se já atingida ou sem ritmo positivo). */
  projectedDate: IsoDate | null;
  /** No ritmo atual chega até a data-alvo? null sem data-alvo, sem ritmo ou já atingida. */
  onTrack: boolean | null;
}

/**
 * Projeção linear da meta no ritmo dos últimos meses (sem rendimentos). É uma
 * estimativa e deve ser exibida como tal.
 */
export function projectGoal(
  progress: GoalProgress,
  contributions: readonly GoalContribution[],
  today: IsoDate,
  windowMonths = GOAL_PACE_WINDOW_MONTHS,
): GoalProjection {
  const { goal, remaining } = progress;
  const currency = goal.targetAmount.currency;
  const windowStartCandidate = addMonths(today, -windowMonths);
  const windowStart = goal.startDate > windowStartCandidate ? goal.startDate : windowStartCandidate;
  const months = Math.max(1, differenceInCalendarMonths(today, windowStart));
  const net = contributions
    .filter(
      (item) => item.goalId === goal.id && item.date > windowStartCandidate && item.date <= today,
    )
    .reduce(
      (total, item) =>
        item.type === 'deposit' ? total.add(item.amount) : total.subtract(item.amount),
      Money.zero(currency),
    );
  const averageMonthly = net.divide(months);

  if (!remaining.isPositive() || !averageMonthly.isPositive()) {
    return { averageMonthly, projectedDate: null, onTrack: null };
  }
  const monthsNeeded = remaining.toDecimal().div(averageMonthly.toDecimal()).ceil().toNumber();
  const projectedDate = endOfMonth(addMonths(today, monthsNeeded));
  return {
    averageMonthly,
    projectedDate,
    onTrack: goal.targetDate === null ? null : projectedDate <= endOfMonth(goal.targetDate),
  };
}
