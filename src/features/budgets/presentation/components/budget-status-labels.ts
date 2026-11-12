import type { ProgressTone } from '@/components/data-display/ProgressBar';

import type { BudgetUsageStatus } from '../../domain/services/budget-usage';

export const BUDGET_STATUS_LABELS: Record<BudgetUsageStatus, string> = {
  ok: 'Dentro do limite',
  warning: 'Atenção',
  exceeded: 'Excedido',
};

export const BUDGET_STATUS_TONE: Record<BudgetUsageStatus, ProgressTone> = {
  ok: 'success',
  warning: 'warning',
  exceeded: 'destructive',
};
