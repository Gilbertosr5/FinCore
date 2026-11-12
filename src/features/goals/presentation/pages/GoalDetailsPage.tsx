import {
  ArrowLeftRight,
  CalendarClock,
  ChevronRight,
  CloudOff,
  Gauge,
  PiggyBank,
  PlusCircle,
  Target,
  Trash2,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';

import { ProgressBar } from '@/components/data-display/ProgressBar';
import { StatCard } from '@/components/data-display/StatCard';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { EmptyState } from '@/components/feedback/EmptyState';
import { StatusScreen } from '@/components/feedback/StatusScreen';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ROUTES } from '@/constants/routes';
import { HistoryTimeline } from '@/features/history';
import { formatDateBR } from '@/lib/dates';
import { getErrorMessage } from '@/lib/errors';
import { formatMoney, formatPercent } from '@/lib/money';
import { cn } from '@/lib/utils';

import { GOAL_CATEGORY_LABELS, type GoalContribution } from '../../domain/entities/goal';
import { projectionText } from '../components/goal-projection-text';
import { GoalActionDialogs, type PendingGoalAction } from '../components/GoalActionDialogs';
import { GoalActionsMenu, GoalBadges } from '../components/GoalCard';
import { useGoalsServices } from '../context/goals-context';
import { useGoalDetails, useRemoveContribution } from '../hooks/use-goals';

export function GoalDetailsPage() {
  const { goalId = '' } = useParams();
  const navigate = useNavigate();
  const { today } = useGoalsServices();
  const details = useGoalDetails(goalId);
  const removeContribution = useRemoveContribution();
  const [pending, setPending] = useState<PendingGoalAction | null>(null);
  const [removing, setRemoving] = useState<GoalContribution | null>(null);

  const data = details.data;
  const view = data?.view;
  const goal = view?.progress.goal;

  return (
    <div className="flex flex-col gap-6">
      <nav
        aria-label="Trilha de navegação"
        className="flex items-center gap-1 text-sm text-muted-foreground"
      >
        <Link to={ROUTES.goals} className="hover:text-foreground hover:underline">
          Metas
        </Link>
        <ChevronRight aria-hidden="true" className="size-4" />
        <span aria-current="page" className="font-medium text-foreground">
          {goal?.name ?? 'Detalhes'}
        </span>
      </nav>

      {details.isError ? (
        <StatusScreen
          tone="destructive"
          icon={CloudOff}
          title="Não foi possível carregar a meta"
          description={getErrorMessage(details.error)}
          actions={
            <Button asChild variant="outline">
              <Link to={ROUTES.goals}>Voltar às metas</Link>
            </Button>
          }
        />
      ) : !data || !view || !goal ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-28 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-semibold tracking-tight">{goal.name}</h2>
              <p className="text-sm text-muted-foreground">
                {[
                  GOAL_CATEGORY_LABELS[goal.category],
                  `início ${formatDateBR(goal.startDate)}`,
                  goal.targetDate ? `prazo ${formatDateBR(goal.targetDate)}` : 'sem prazo',
                  view.accountName ? `guardada em ${view.accountName}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {goal.description && <p className="text-sm">{goal.description}</p>}
              <GoalBadges goal={goal} overdue={view.progress.overdue} />
            </div>
            <div className="flex gap-2">
              {goal.status === 'active' && (
                <Button
                  onClick={() => {
                    setPending({ view, action: { type: 'contribute', kind: 'deposit' } });
                  }}
                >
                  <PlusCircle aria-hidden="true" />
                  Aportar
                </Button>
              )}
              <GoalActionsMenu
                goal={goal}
                onAction={(action) => {
                  setPending({ view, action });
                }}
              />
            </div>
          </div>

          <section aria-label="Progresso da meta" className="flex flex-col gap-4">
            <ProgressBar
              value={view.progress.percent}
              tone={view.progress.remaining.isPositive() ? 'primary' : 'success'}
              label={`Progresso da meta ${goal.name}`}
              valueText={`${formatPercent(Math.floor(view.progress.percent))} atingido`}
              className="h-3"
            />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Acumulado"
                value={formatMoney(view.progress.accumulated)}
                icon={PiggyBank}
                hint={`${formatPercent(Math.floor(view.progress.percent))} de ${formatMoney(goal.targetAmount)}`}
              />
              <StatCard label="Faltam" value={formatMoney(view.progress.remaining)} icon={Target} />
              <StatCard
                label="Aporte mensal necessário"
                value={
                  view.progress.monthlyRequired ? formatMoney(view.progress.monthlyRequired) : '—'
                }
                icon={CalendarClock}
                hint={
                  view.progress.monthsLeft !== null
                    ? `${view.progress.monthsLeft} ${view.progress.monthsLeft === 1 ? 'mês' : 'meses'} até o prazo`
                    : 'Defina um prazo para calcular'
                }
              />
              <StatCard
                label="Ritmo atual"
                value={`${formatMoney(view.projection.averageMonthly)}/mês`}
                icon={Gauge}
                badge={<Badge variant="outline">Estimativa</Badge>}
                hint="Média dos últimos 6 meses"
                tone={view.projection.onTrack === false ? 'warning' : 'default'}
              />
            </div>
            {goal.status === 'active' && (
              <p role="status" className="rounded-lg bg-muted px-3 py-2 text-sm">
                {projectionText(view)}
                {view.projection.onTrack === false &&
                  ' Nesse ritmo, a meta não será atingida até o prazo.'}
                {view.projection.onTrack === true && ' Nesse ritmo, a meta será atingida no prazo.'}
              </p>
            )}
          </section>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card className="gap-4">
              <CardHeader>
                <CardTitle>Aportes e retiradas</CardTitle>
              </CardHeader>
              <CardContent>
                {data.contributions.length === 0 ? (
                  <EmptyState icon={Wallet} title="Nenhum aporte registrado" className="py-6" />
                ) : (
                  <ul aria-label="Aportes da meta" className="divide-y divide-border">
                    {data.contributions.map((item) => {
                      const deposit = item.type === 'deposit';
                      return (
                        <li key={item.id} className="flex items-center gap-3 py-2 text-sm">
                          <div className="flex min-w-0 flex-1 flex-col">
                            <span className="flex flex-wrap items-center gap-2 font-medium">
                              {deposit ? 'Aporte' : 'Retirada'}
                              {item.transferId && (
                                <Badge variant="secondary">
                                  <ArrowLeftRight aria-hidden="true" />
                                  com transferência
                                </Badge>
                              )}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDateBR(item.date)}
                            </span>
                          </div>
                          <span
                            className={cn(
                              'shrink-0 font-medium tabular-nums',
                              deposit ? 'text-success' : 'text-destructive',
                            )}
                          >
                            {deposit ? '+' : '−'}
                            {formatMoney(item.amount)}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Excluir ${deposit ? 'aporte' : 'retirada'} de ${formatMoney(item.amount)} em ${formatDateBR(item.date)}`}
                            onClick={() => {
                              setRemoving(item);
                            }}
                          >
                            <Trash2 aria-hidden="true" />
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
            <Card className="gap-4">
              <CardHeader>
                <CardTitle>Histórico de alterações</CardTitle>
              </CardHeader>
              <CardContent>
                <HistoryTimeline entityType="goal" entityId={goal.id} />
              </CardContent>
            </Card>
          </div>

          <GoalActionDialogs
            pending={pending}
            accounts={data.accounts}
            today={today()}
            onClose={() => {
              setPending(null);
            }}
            onDeleted={() => {
              void navigate(ROUTES.goals, { replace: true });
            }}
          />
          <ConfirmDialog
            open={removing !== null}
            onOpenChange={(open) => {
              if (!open) setRemoving(null);
            }}
            title={removing?.type === 'withdrawal' ? 'Excluir retirada?' : 'Excluir aporte?'}
            description={
              removing?.transferId
                ? 'O registro e a transferência entre contas feita junto com ele serão excluídos.'
                : 'O registro será excluído e o progresso da meta recalculado.'
            }
            confirmLabel="Excluir"
            destructive
            pending={removeContribution.isPending}
            onConfirm={() => {
              if (!removing) return;
              removeContribution.mutate(removing.id, {
                onSuccess: () => {
                  toast.success('Registro excluído.');
                  setRemoving(null);
                },
                onError: (error) => {
                  toast.error(getErrorMessage(error));
                },
              });
            }}
          />
        </>
      )}
    </div>
  );
}
