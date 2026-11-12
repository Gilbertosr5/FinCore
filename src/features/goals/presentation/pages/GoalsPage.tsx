import { CalendarClock, CloudOff, Goal as GoalIcon, PiggyBank, Plus, Target } from 'lucide-react';
import { useState } from 'react';

import { StatCard } from '@/components/data-display/StatCard';
import { EmptyState } from '@/components/feedback/EmptyState';
import { StatusScreen } from '@/components/feedback/StatusScreen';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useAccountSummaries } from '@/features/accounts';
import { getErrorMessage } from '@/lib/errors';
import { formatMoney, formatPercent } from '@/lib/money';

import { GoalActionDialogs, type PendingGoalAction } from '../components/GoalActionDialogs';
import { GoalCard } from '../components/GoalCard';
import { useGoalsServices } from '../context/goals-context';
import { useGoalsOverview } from '../hooks/use-goals';

/** Metas: progresso, aporte mensal necessário, projeção no ritmo atual e ações. */
export function GoalsPage() {
  const { today } = useGoalsServices();
  const overview = useGoalsOverview();
  const accounts = useAccountSummaries();
  const [pending, setPending] = useState<PendingGoalAction | 'new' | null>(null);
  const [showClosed, setShowClosed] = useState(false);

  if (overview.isError) {
    return (
      <StatusScreen
        tone="destructive"
        icon={CloudOff}
        title="Não foi possível carregar as metas"
        description={getErrorMessage(overview.error)}
        actions={
          <Button
            onClick={() => {
              void overview.refetch();
            }}
          >
            Tentar novamente
          </Button>
        }
      />
    );
  }

  const data = overview.data;
  const all = data?.goals ?? [];
  const closed = all.filter((view) => view.progress.goal.status !== 'active');
  const visible = showClosed ? all : all.filter((view) => view.progress.goal.status === 'active');
  const overallPercent = data?.totalAccumulated.percentageOf(data.totalTarget)?.toNumber() ?? 0;
  const activeAccounts = (accounts.data ?? [])
    .filter((item) => !item.account.archived)
    .map((item) => ({ id: item.account.id, name: item.account.name }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Aportes e retiradas são destinação de dinheiro — nunca receita ou despesa.
        </p>
        <Button
          onClick={() => {
            setPending('new');
          }}
        >
          <Plus aria-hidden="true" />
          Nova meta
        </Button>
      </div>

      <section aria-label="Resumo das metas" className="grid gap-4 sm:grid-cols-3">
        {data ? (
          <>
            <StatCard
              label="Acumulado nas metas"
              value={formatMoney(data.totalAccumulated)}
              icon={PiggyBank}
              hint={`${formatPercent(Math.floor(overallPercent))} de ${formatMoney(data.totalTarget)}`}
            />
            <StatCard
              label="Falta acumular"
              value={formatMoney(data.totalRemaining)}
              icon={Target}
              hint="Metas em andamento"
            />
            <StatCard
              label="Aporte mensal necessário"
              value={formatMoney(data.totalMonthlyRequired)}
              icon={CalendarClock}
              hint="Soma das metas com prazo"
            />
          </>
        ) : (
          Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-28 rounded-xl" />
          ))
        )}
      </section>

      {closed.length > 0 && (
        <div className="flex items-center gap-2">
          <Checkbox
            id="show-closed"
            checked={showClosed}
            onCheckedChange={(checked) => {
              setShowClosed(checked === true);
            }}
          />
          <Label htmlFor="show-closed">
            Mostrar metas concluídas e canceladas ({closed.length})
          </Label>
        </div>
      )}

      {!data ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-64 rounded-xl" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={GoalIcon}
            title="Nenhuma meta em andamento"
            description="Crie metas como reserva de emergência, viagem ou troca de carro."
            action={
              <Button
                size="sm"
                onClick={() => {
                  setPending('new');
                }}
              >
                Nova meta
              </Button>
            }
          />
        </Card>
      ) : (
        <ul aria-label="Metas" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((view) => (
            <li key={view.progress.goal.id}>
              <GoalCard
                view={view}
                onAction={(action) => {
                  setPending({ view, action });
                }}
              />
            </li>
          ))}
        </ul>
      )}

      <GoalActionDialogs
        pending={pending}
        accounts={activeAccounts}
        today={today()}
        onClose={() => {
          setPending(null);
        }}
      />
    </div>
  );
}
