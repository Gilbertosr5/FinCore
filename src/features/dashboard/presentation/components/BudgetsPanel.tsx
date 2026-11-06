import { CircleCheck } from 'lucide-react';

import { ProgressBar } from '@/components/data-display/ProgressBar';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Badge } from '@/components/ui/badge';
import type { BudgetUsage } from '@/features/budgets';
import { formatMoney, formatPercent } from '@/lib/money';

import { PanelCard } from './PanelCard';

const MAX_ITEMS = 4;

/** Orçamentos que atingiram o limiar de alerta ou foram excedidos (período atual). */
export function BudgetsPanel({ budgets }: { budgets: BudgetUsage[] }) {
  const attention = budgets.filter((usage) => usage.status !== 'ok').slice(0, MAX_ITEMS);

  return (
    <PanelCard
      title="Orçamentos próximos do limite"
      description="Consumo no período corrente de cada orçamento."
    >
      {attention.length === 0 ? (
        <EmptyState
          icon={CircleCheck}
          title="Todos os orçamentos dentro do limite"
          description={budgets.length === 0 ? 'Nenhum orçamento cadastrado.' : undefined}
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {attention.map((usage) => {
            const percent = usage.percent ?? 0;
            const exceeded = usage.status === 'exceeded';
            return (
              <li key={usage.budget.id} className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate font-medium">{usage.budget.name}</span>
                  <Badge variant={exceeded ? 'destructive' : 'warning'}>
                    {exceeded ? 'Excedido' : 'Atenção'} · {formatPercent(Math.round(percent))}
                  </Badge>
                </div>
                <ProgressBar
                  value={percent}
                  tone={exceeded ? 'destructive' : 'warning'}
                  label={`Orçamento ${usage.budget.name}`}
                  valueText={`${formatPercent(Math.round(percent))} utilizado`}
                />
                <p className="text-xs text-muted-foreground tabular-nums">
                  {formatMoney(usage.spent)} de {formatMoney(usage.budget.amount)}
                  {exceeded
                    ? ` · excedente de ${formatMoney(usage.excess)}`
                    : ` · restam ${formatMoney(usage.remaining)}`}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </PanelCard>
  );
}
