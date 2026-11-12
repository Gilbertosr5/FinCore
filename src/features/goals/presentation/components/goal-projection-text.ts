import { formatMonthLong, toMonthKey } from '@/lib/dates';
import { formatMoney } from '@/lib/money';

import type { GoalView } from '../../application/goal-use-cases';

/** Texto da projeção no ritmo atual (sempre rotulado como estimativa). */
export function projectionText(view: GoalView): string | null {
  const { projection, progress } = view;
  if (!progress.remaining.isPositive()) return 'Meta atingida.';
  if (projection.projectedDate === null) {
    return 'Sem aportes recentes para estimar a conclusão.';
  }
  const month = formatMonthLong(toMonthKey(projection.projectedDate));
  return `No ritmo atual (${formatMoney(projection.averageMonthly)}/mês), conclusão estimada em ${month}.`;
}
