import {
  CircleCheck,
  CloudOff,
  History,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Plus,
  Scale,
  Trash2,
  TriangleAlert,
  WalletCards,
} from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';

import { MonthNavigator } from '@/components/data-display/MonthNavigator';
import { ProgressBar } from '@/components/data-display/ProgressBar';
import { StatCard } from '@/components/data-display/StatCard';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { EmptyState } from '@/components/feedback/EmptyState';
import { StatusScreen } from '@/components/feedback/StatusScreen';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateBR, isMonthKey, toMonthKey } from '@/lib/dates';
import { getErrorMessage } from '@/lib/errors';
import { formatMoney, formatPercent } from '@/lib/money';
import { cn } from '@/lib/utils';

import { BUDGET_PERIOD_LABELS, type BudgetView } from '../../application/budget-use-cases';
import type { Budget } from '../../domain/entities/budget';
import { BudgetStatusBadge } from '../components/budget-status';
import { BUDGET_STATUS_TONE } from '../components/budget-status-labels';
import { BudgetFormDialog } from '../components/BudgetFormDialog';
import { BudgetHistorySheet } from '../components/BudgetHistorySheet';
import { useBudgetsServices } from '../context/budgets-context';
import { useBudgetMonth, useDeleteBudget, useSetBudgetActive } from '../hooks/use-budgets';

/** Orçamentos: consumo do mês, alertas, planejado × realizado e histórico. */
export function BudgetsPage() {
  const { today } = useBudgetsServices();
  const currentMonth = toMonthKey(today());
  const [params, setParams] = useSearchParams();
  const requested = params.get('mes') ?? '';
  const month = isMonthKey(requested) ? requested : currentMonth;
  const overview = useBudgetMonth(month);
  const setActive = useSetBudgetActive();
  const remove = useDeleteBudget();
  const [form, setForm] = useState<Budget | 'new' | null>(null);
  const [historyOf, setHistoryOf] = useState<Budget | null>(null);
  const [deleting, setDeleting] = useState<Budget | null>(null);
  const [showPaused, setShowPaused] = useState(false);

  if (overview.isError) {
    return (
      <StatusScreen
        tone="destructive"
        icon={CloudOff}
        title="Não foi possível carregar os orçamentos"
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
  const items = data?.items ?? [];
  const paused = items.filter((item) => !item.usage.budget.active);
  const visible = showPaused ? items : items.filter((item) => item.usage.budget.active);

  const toggleActive = (budget: Budget) => {
    setActive.mutate(
      { id: budget.id, active: !budget.active },
      {
        onSuccess: () => {
          toast.success(budget.active ? 'Orçamento pausado.' : 'Orçamento reativado.');
        },
        onError: (error) => {
          toast.error(getErrorMessage(error));
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthNavigator
          month={month}
          currentMonth={currentMonth}
          onChange={(next) => {
            setParams(next === currentMonth ? {} : { mes: next }, { replace: true });
          }}
        />
        <Button
          onClick={() => {
            setForm('new');
          }}
        >
          <Plus aria-hidden="true" />
          Novo orçamento
        </Button>
      </div>

      <section
        aria-label="Resumo dos orçamentos"
        aria-busy={overview.isFetching}
        className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4"
      >
        {data ? (
          <>
            <div className="col-span-2 xl:col-span-1">
              <StatCard
                label="Planejado × realizado"
                value={formatMoney(data.spentByCategory)}
                icon={Scale}
                hint={`de ${formatMoney(data.plannedByCategory)} (mensais por categoria)`}
                tone={
                  data.spentByCategory.greaterThan(data.plannedByCategory) ? 'negative' : 'default'
                }
              />
            </div>
            <StatCard
              label="Dentro do limite"
              value={String(data.counts.ok)}
              icon={CircleCheck}
              tone="positive"
            />
            <StatCard
              label="Em alerta"
              value={String(data.counts.warning)}
              icon={TriangleAlert}
              tone={data.counts.warning > 0 ? 'warning' : 'default'}
              hint="Atingiram o limiar de alerta"
            />
            <StatCard
              label="Excedidos"
              value={String(data.counts.exceeded)}
              icon={WalletCards}
              tone={data.counts.exceeded > 0 ? 'negative' : 'default'}
              hint="Acima de 100% do limite"
            />
          </>
        ) : (
          Array.from({ length: 4 }, (_, index) => (
            <Skeleton
              key={index}
              className={cn('h-28 rounded-xl', index === 0 && 'col-span-2 xl:col-span-1')}
            />
          ))
        )}
      </section>

      {paused.length > 0 && (
        <div className="flex items-center gap-2">
          <Checkbox
            id="show-paused"
            checked={showPaused}
            onCheckedChange={(checked) => {
              setShowPaused(checked === true);
            }}
          />
          <Label htmlFor="show-paused">Mostrar orçamentos pausados ({paused.length})</Label>
        </div>
      )}

      {!data ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={WalletCards}
            title="Nenhum orçamento ativo"
            description="Defina limites mensais ou anuais por categoria ou para todas as despesas."
            action={
              <Button
                size="sm"
                onClick={() => {
                  setForm('new');
                }}
              >
                Novo orçamento
              </Button>
            }
          />
        </Card>
      ) : (
        <ul aria-label="Orçamentos" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((view) => (
            <li key={view.usage.budget.id}>
              <BudgetCard
                view={view}
                onEdit={setForm}
                onHistory={setHistoryOf}
                onToggle={toggleActive}
                onDelete={setDeleting}
              />
            </li>
          ))}
        </ul>
      )}

      <BudgetFormDialog
        target={form}
        onClose={() => {
          setForm(null);
        }}
      />
      <BudgetHistorySheet
        budget={historyOf}
        onClose={() => {
          setHistoryOf(null);
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Excluir orçamento?"
        description="O orçamento e seus alertas serão removidos. Os lançamentos não são afetados. Para manter o histórico, prefira pausar."
        confirmLabel="Excluir"
        destructive
        pending={remove.isPending}
        onConfirm={() => {
          if (!deleting) return;
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast.success('Orçamento excluído.');
              setDeleting(null);
            },
            onError: (error) => {
              toast.error(getErrorMessage(error));
            },
          });
        }}
      />
    </div>
  );
}

interface BudgetCardProps {
  view: BudgetView;
  onEdit: (budget: Budget) => void;
  onHistory: (budget: Budget) => void;
  onToggle: (budget: Budget) => void;
  onDelete: (budget: Budget) => void;
}

function BudgetCard({ view, onEdit, onHistory, onToggle, onDelete }: BudgetCardProps) {
  const { usage, categoryName, period } = view;
  const { budget } = usage;
  const percent = usage.percent ?? 0;
  const exceeded = usage.status === 'exceeded';
  return (
    <Card className={cn('h-full gap-3', !budget.active && 'opacity-70')}>
      <CardHeader className="flex-row items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <CardTitle className="truncate">{budget.name}</CardTitle>
          <p className="truncate text-xs text-muted-foreground">
            {categoryName ?? 'Todas as despesas'} · {BUDGET_PERIOD_LABELS[budget.period]} ·{' '}
            {formatDateBR(period.start)} a {formatDateBR(period.end)}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Ações do orçamento ${budget.name}`}>
              <MoreHorizontal aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() => {
                onHistory(budget);
              }}
            >
              <History aria-hidden="true" />
              Histórico
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                onEdit(budget);
              }}
            >
              <Pencil aria-hidden="true" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                onToggle(budget);
              }}
            >
              {budget.active ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
              {budget.active ? 'Pausar' : 'Reativar'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => {
                onDelete(budget);
              }}
            >
              <Trash2 aria-hidden="true" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {budget.active ? (
            <BudgetStatusBadge status={usage.status} percent={usage.percent} />
          ) : (
            <Badge variant="outline">Pausado</Badge>
          )}
          <span className="text-xs text-muted-foreground">
            alerta em {formatPercent(budget.alertThresholdPercent)}
          </span>
        </div>
        <ProgressBar
          value={percent}
          tone={BUDGET_STATUS_TONE[usage.status]}
          label={`Consumo do orçamento ${budget.name}`}
          valueText={`${formatPercent(Math.floor(percent))} utilizado`}
        />
        <dl className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <dt className="text-muted-foreground">Utilizado</dt>
            <dd className="text-sm font-semibold tabular-nums">
              {formatMoney(usage.spent)}{' '}
              <span className="text-xs font-normal text-muted-foreground">
                de {formatMoney(budget.amount)}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{exceeded ? 'Excedente' : 'Disponível'}</dt>
            <dd
              className={cn('text-sm font-semibold tabular-nums', exceeded && 'text-destructive')}
            >
              {formatMoney(exceeded ? usage.excess : usage.remaining)}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
