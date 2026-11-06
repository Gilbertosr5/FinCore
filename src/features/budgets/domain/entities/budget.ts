import type { Money } from '@/lib/money';

export type BudgetPeriod = 'monthly' | 'yearly';

export interface Budget {
  id: string;
  name: string;
  /** Categoria limitada; `null` = orçamento geral de despesas. */
  categoryId: string | null;
  amount: Money;
  period: BudgetPeriod;
  /** Percentual a partir do qual o orçamento entra em alerta (padrão 80). */
  alertThresholdPercent: number;
  active: boolean;
}
