import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatMonthLong, getDateParts, toMonthKey, type MonthKey } from '@/lib/dates';
import { formatMoney, type Money } from '@/lib/money';
import { cn } from '@/lib/utils';

import type { PlanningSnapshot } from '../../application/load-planning-data';
import {
  buildAnnualPlan,
  PLAN_MONTH_STATUS_LABELS,
  type CategoryPlanLine,
  type MonthPlan,
  type PlanMonthStatus,
} from '../../domain/month-plan';

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const STATUS_VARIANT: Record<PlanMonthStatus, 'secondary' | 'default' | 'outline'> = {
  realized: 'secondary',
  current: 'default',
  forecast: 'outline',
};

function Signed({ value, strong = false }: { value: Money; strong?: boolean }) {
  return (
    <span
      className={cn(
        'tabular-nums',
        strong && 'font-semibold',
        value.isNegative() && 'text-destructive',
      )}
    >
      {formatMoney(value)}
    </span>
  );
}

/** Plano anual (12 meses) e detalhamento do mês escolhido por categoria. */
export function AnnualPlanSection({ snapshot }: { snapshot: PlanningSnapshot }) {
  const currentYear = getDateParts(snapshot.today).year;
  const [year, setYear] = useState(currentYear);
  const [selected, setSelected] = useState<MonthKey>(toMonthKey(snapshot.today));
  const plan = useMemo(
    () => buildAnnualPlan(snapshot.data, snapshot.today, year),
    [snapshot, year],
  );
  const monthPlan = plan.months.find((item) => item.month === selected) ?? plan.months[0];

  const changeYear = (next: number) => {
    setYear(next);
    setSelected(next === currentYear ? toMonthKey(snapshot.today) : (`${next}-01` as MonthKey));
  };

  return (
    <Card className="gap-5">
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <CardTitle>Plano anual e mensal</CardTitle>
          <CardDescription>
            Receitas e despesas por competência: realizado nos meses passados, agendado e estimado
            (média dos variáveis) nos próximos.
          </CardDescription>
        </div>
        <div className="flex items-center gap-1" role="group" aria-label="Ano">
          <Button
            variant="outline"
            size="icon"
            aria-label="Ano anterior"
            onClick={() => {
              changeYear(year - 1);
            }}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <span aria-live="polite" className="min-w-14 text-center text-sm font-semibold">
            {year}
          </span>
          <Button
            variant="outline"
            size="icon"
            aria-label="Próximo ano"
            onClick={() => {
              changeYear(year + 1);
            }}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <caption className="sr-only">Plano de {year} mês a mês</caption>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-right">Receitas</TableHead>
                <TableHead className="text-right">Despesas</TableHead>
                <TableHead className="text-right">Resultado</TableHead>
                <TableHead className="text-right">Orçado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plan.months.map((row) => {
                const active = row.month === monthPlan?.month;
                return (
                  <TableRow key={row.month} className={cn(active && 'bg-primary/10')}>
                    <TableCell>
                      <button
                        type="button"
                        aria-pressed={active}
                        className="rounded-sm font-medium whitespace-nowrap underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => {
                          setSelected(row.month);
                        }}
                      >
                        {capitalize(formatMonthLong(row.month))}
                      </button>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[row.status]}>
                        {PLAN_MONTH_STATUS_LABELS[row.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(row.income.total)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(row.expenses.total)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Signed value={row.result} />
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {row.budgeted ? formatMoney(row.budgeted) : '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2} className="font-semibold">
                  Total de {year}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatMoney(plan.income.total)}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatMoney(plan.expenses.total)}
                </TableCell>
                <TableCell className="text-right">
                  <Signed value={plan.result} strong />
                </TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </div>
        {monthPlan && <MonthBreakdown plan={monthPlan} categoryNames={snapshot.categoryNames} />}
      </CardContent>
    </Card>
  );
}

function MonthBreakdown({
  plan,
  categoryNames,
}: {
  plan: MonthPlan;
  categoryNames: Record<string, string>;
}) {
  return (
    <section aria-label={`Plano de ${formatMonthLong(plan.month)}`} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold">{capitalize(formatMonthLong(plan.month))}</h3>
        <Badge variant={STATUS_VARIANT[plan.status]}>{PLAN_MONTH_STATUS_LABELS[plan.status]}</Badge>
        {plan.status !== 'realized' && <Badge variant="outline">Inclui estimativas</Badge>}
      </div>
      <dl className="grid gap-3 rounded-lg bg-muted/50 p-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted-foreground">Receitas (realizado + previsto)</dt>
          <dd className="font-semibold tabular-nums">{formatMoney(plan.income.total)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Despesas (realizado + previsto)</dt>
          <dd className="font-semibold tabular-nums">{formatMoney(plan.expenses.total)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Resultado</dt>
          <dd>
            <Signed value={plan.result} strong />
          </dd>
        </div>
      </dl>
      <div className="grid gap-4 xl:grid-cols-2">
        <CategoryTable
          title="Despesas por categoria"
          lines={plan.expensesByCategory}
          categoryNames={categoryNames}
          showBudget
        />
        <CategoryTable
          title="Receitas por categoria"
          lines={plan.incomeByCategory}
          categoryNames={categoryNames}
        />
      </div>
    </section>
  );
}

function CategoryTable({
  title,
  lines,
  categoryNames,
  showBudget = false,
}: {
  title: string;
  lines: CategoryPlanLine[];
  categoryNames: Record<string, string>;
  showBudget?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <caption className="px-3 pt-3 text-left text-sm font-medium">{title}</caption>
        <TableHeader>
          <TableRow>
            <TableHead>Categoria</TableHead>
            <TableHead className="text-right">Realizado</TableHead>
            <TableHead className="text-right">Previsto</TableHead>
            <TableHead className="text-right">Total</TableHead>
            {showBudget && <TableHead className="text-right">Orçamento</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.length === 0 ? (
            <TableRow>
              <TableCell colSpan={showBudget ? 5 : 4} className="text-center text-muted-foreground">
                Nada registrado ou previsto.
              </TableCell>
            </TableRow>
          ) : (
            lines.map((line) => {
              const over = line.budget !== null && line.total.greaterThan(line.budget);
              return (
                <TableRow key={line.categoryId ?? 'none'}>
                  <TableCell>
                    {line.categoryId
                      ? (categoryNames[line.categoryId] ?? 'Categoria')
                      : 'Sem categoria'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(line.realized)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(line.scheduled.add(line.estimated))}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'text-right font-medium tabular-nums',
                      over && 'text-destructive',
                    )}
                  >
                    {formatMoney(line.total)}
                    {over && <span className="sr-only"> (acima do orçamento)</span>}
                  </TableCell>
                  {showBudget && (
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {line.budget ? formatMoney(line.budget) : '—'}
                    </TableCell>
                  )}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
