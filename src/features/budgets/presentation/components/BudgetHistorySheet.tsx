import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { HistoryTimeline } from '@/features/history';
import { formatMonthShort, isMonthKey } from '@/lib/dates';
import { getErrorMessage } from '@/lib/errors';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';

import { BudgetStatusBadge } from './budget-status';
import { BUDGET_PERIOD_LABELS } from '../../application/budget-use-cases';
import type { Budget } from '../../domain/entities/budget';
import { useBudgetHistory } from '../hooks/use-budgets';

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function periodLabel(key: string): string {
  return isMonthKey(key) ? capitalize(formatMonthShort(key)) : key;
}

/** Planejado × realizado período a período e histórico de alterações do orçamento. */
export function BudgetHistorySheet({
  budget,
  onClose,
}: {
  budget: Budget | null;
  onClose: () => void;
}) {
  const history = useBudgetHistory(budget?.id ?? null);
  return (
    <Sheet
      open={budget !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent side="right" className="w-full max-w-lg overflow-y-auto bg-popover p-6">
        {budget && (
          <div className="flex flex-col gap-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <SheetTitle className="text-lg font-semibold">{budget.name}</SheetTitle>
                <SheetDescription className="text-sm text-muted-foreground">
                  {BUDGET_PERIOD_LABELS[budget.period]} · limite atual de{' '}
                  {formatMoney(budget.amount)}
                </SheetDescription>
              </div>
              <SheetClose asChild>
                <Button variant="ghost" size="icon" aria-label="Fechar histórico">
                  <X aria-hidden="true" />
                </Button>
              </SheetClose>
            </div>

            <section aria-label="Planejado × realizado" className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">Planejado × realizado</h3>
              {history.isError ? (
                <p className="text-sm text-destructive">{getErrorMessage(history.error)}</p>
              ) : !history.data ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Período</TableHead>
                      <TableHead className="text-right">Planejado</TableHead>
                      <TableHead className="text-right">Realizado</TableHead>
                      <TableHead>Situação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.data.map((row) => (
                      <TableRow key={row.key}>
                        <TableCell className={cn(row.current && 'font-semibold')}>
                          {periodLabel(row.key)}
                          {row.current && <span className="sr-only"> (período atual)</span>}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(row.usage.budget.amount)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(row.usage.spent)}
                        </TableCell>
                        <TableCell>
                          <BudgetStatusBadge
                            status={row.usage.status}
                            percent={row.usage.percent}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              <p className="text-xs text-muted-foreground">
                Os períodos anteriores são comparados com o limite atual do orçamento.
              </p>
            </section>

            <section aria-label="Alterações" className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">Alterações</h3>
              <HistoryTimeline entityType="budget" entityId={budget.id} />
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
