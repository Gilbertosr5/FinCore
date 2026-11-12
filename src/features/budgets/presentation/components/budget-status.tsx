import { Badge } from '@/components/ui/badge';
import { formatPercent } from '@/lib/money';

import { BUDGET_STATUS_LABELS } from './budget-status-labels';
import type { BudgetUsageStatus } from '../../domain/services/budget-usage';

/** Situação do orçamento em texto + percentual (nunca só cor). */
export function BudgetStatusBadge({
  status,
  percent,
}: {
  status: BudgetUsageStatus;
  percent: number | null;
}) {
  const variant = status === 'ok' ? 'success' : status === 'warning' ? 'warning' : 'destructive';
  return (
    <Badge variant={variant}>
      {BUDGET_STATUS_LABELS[status]}
      {percent !== null && ` · ${formatPercent(Math.floor(percent))}`}
    </Badge>
  );
}
