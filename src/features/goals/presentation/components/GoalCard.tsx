import {
  Ban,
  CircleCheck,
  MinusCircle,
  MoreHorizontal,
  Pencil,
  PlusCircle,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { Link } from 'react-router';

import { ProgressBar } from '@/components/data-display/ProgressBar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { goalPath } from '@/constants/routes';
import { formatDateBR } from '@/lib/dates';
import { formatMoney, formatPercent } from '@/lib/money';
import { cn } from '@/lib/utils';

import { projectionText } from './goal-projection-text';
import type { GoalView } from '../../application/goal-use-cases';
import {
  GOAL_CATEGORY_LABELS,
  GOAL_PRIORITY_LABELS,
  GOAL_STATUS_LABELS,
  type Goal,
  type GoalContribution,
  type GoalStatus,
} from '../../domain/entities/goal';

export type GoalAction =
  | { type: 'contribute'; kind: GoalContribution['type'] }
  | { type: 'edit' }
  | { type: 'status'; status: GoalStatus }
  | { type: 'delete' };

/** Situação + prioridade em texto (nunca só cor). */
export function GoalBadges({ goal, overdue }: { goal: Goal; overdue: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {goal.status !== 'active' ? (
        <Badge variant={goal.status === 'completed' ? 'success' : 'outline'}>
          {GOAL_STATUS_LABELS[goal.status]}
        </Badge>
      ) : overdue ? (
        <Badge variant="destructive">Prazo vencido</Badge>
      ) : null}
      <Badge variant="secondary">
        Prioridade {GOAL_PRIORITY_LABELS[goal.priority].toLowerCase()}
      </Badge>
    </div>
  );
}

export function GoalActionsMenu({
  goal,
  onAction,
}: {
  goal: Goal;
  onAction: (action: GoalAction) => void;
}) {
  const active = goal.status === 'active';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Ações da meta ${goal.name}`}>
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {active && (
          <>
            <DropdownMenuItem
              onSelect={() => {
                onAction({ type: 'contribute', kind: 'deposit' });
              }}
            >
              <PlusCircle aria-hidden="true" />
              Aportar
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                onAction({ type: 'contribute', kind: 'withdrawal' });
              }}
            >
              <MinusCircle aria-hidden="true" />
              Retirar
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuItem
          onSelect={() => {
            onAction({ type: 'edit' });
          }}
        >
          <Pencil aria-hidden="true" />
          Editar
        </DropdownMenuItem>
        {active ? (
          <>
            <DropdownMenuItem
              onSelect={() => {
                onAction({ type: 'status', status: 'completed' });
              }}
            >
              <CircleCheck aria-hidden="true" />
              Concluir
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                onAction({ type: 'status', status: 'cancelled' });
              }}
            >
              <Ban aria-hidden="true" />
              Cancelar meta
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem
            onSelect={() => {
              onAction({ type: 'status', status: 'active' });
            }}
          >
            <RotateCcw aria-hidden="true" />
            Reativar
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => {
            onAction({ type: 'delete' });
          }}
        >
          <Trash2 aria-hidden="true" />
          Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function GoalCard({
  view,
  onAction,
}: {
  view: GoalView;
  onAction: (action: GoalAction) => void;
}) {
  const { progress, projection } = view;
  const { goal } = progress;
  const reached = !progress.remaining.isPositive();
  const projection$ = projectionText(view);
  return (
    <Card className={cn('relative h-full gap-3', goal.status !== 'active' && 'opacity-75')}>
      <CardHeader className="flex-row items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <CardTitle className="truncate">
            <Link
              to={goalPath(goal.id)}
              className="outline-none after:absolute after:inset-0 hover:underline focus-visible:underline"
            >
              {goal.name}
            </Link>
          </CardTitle>
          <p className="truncate text-xs text-muted-foreground">
            {GOAL_CATEGORY_LABELS[goal.category]}
            {goal.targetDate ? ` · até ${formatDateBR(goal.targetDate)}` : ' · sem prazo'}
          </p>
        </div>
        <div className="relative z-10">
          <GoalActionsMenu goal={goal} onAction={onAction} />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <GoalBadges goal={goal} overdue={progress.overdue} />
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-lg font-semibold tabular-nums">
            {formatMoney(progress.accumulated)}
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">
            de {formatMoney(goal.targetAmount)} ({formatPercent(Math.floor(progress.percent))})
          </span>
        </div>
        <ProgressBar
          value={progress.percent}
          tone={reached ? 'success' : progress.overdue ? 'destructive' : 'primary'}
          label={`Progresso da meta ${goal.name}`}
          valueText={`${formatPercent(Math.floor(progress.percent))} atingido`}
        />
        <dl className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <dt className="text-muted-foreground">Faltam</dt>
            <dd className="text-sm font-semibold tabular-nums">
              {formatMoney(progress.remaining)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Aporte mensal necessário</dt>
            <dd className="text-sm font-semibold tabular-nums">
              {progress.monthlyRequired ? formatMoney(progress.monthlyRequired) : '—'}
            </dd>
          </div>
        </dl>
        {goal.status === 'active' && projection$ && (
          <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            <Badge variant="outline">Estimativa</Badge>
            {projection$}
            {projection.onTrack === false && (
              <span className="font-medium text-warning">Abaixo do necessário para o prazo.</span>
            )}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
