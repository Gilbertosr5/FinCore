import { Goal as GoalIcon } from 'lucide-react';

import { ProgressBar } from '@/components/data-display/ProgressBar';
import { EmptyState } from '@/components/feedback/EmptyState';
import { GOAL_CATEGORY_LABELS, type GoalProgress } from '@/features/goals';
import { formatDateBR } from '@/lib/dates';
import { formatMoney, formatPercent } from '@/lib/money';

import { PanelCard } from './PanelCard';

const MAX_ITEMS = 4;

export function GoalsPanel({ goals }: { goals: GoalProgress[] }) {
  return (
    <PanelCard
      title="Metas em andamento"
      description="Progresso calculado pelos aportes registrados."
    >
      {goals.length === 0 ? (
        <EmptyState icon={GoalIcon} title="Nenhuma meta ativa" />
      ) : (
        <ul className="flex flex-col gap-4">
          {goals.slice(0, MAX_ITEMS).map((progress) => (
            <li key={progress.goal.id} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{progress.goal.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {GOAL_CATEGORY_LABELS[progress.goal.category]}
                    {progress.goal.targetDate && ` · até ${formatDateBR(progress.goal.targetDate)}`}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums">
                  {formatPercent(Math.min(progress.percent, 100))}
                </span>
              </div>
              <ProgressBar
                value={progress.percent}
                tone={progress.percent >= 100 ? 'success' : 'primary'}
                label={`Meta ${progress.goal.name}`}
                valueText={`${formatPercent(Math.round(progress.percent))} atingido`}
              />
              <p className="text-xs text-muted-foreground tabular-nums">
                {formatMoney(progress.accumulated)} de {formatMoney(progress.goal.targetAmount)}
                {progress.monthlyRequired &&
                  ` · aporte necessário ${formatMoney(progress.monthlyRequired)}/mês`}
                {progress.overdue && ' · prazo vencido'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </PanelCard>
  );
}
