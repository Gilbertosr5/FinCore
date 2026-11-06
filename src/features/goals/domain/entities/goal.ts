import type { IsoDate } from '@/lib/dates';
import type { Money } from '@/lib/money';

export type GoalCategory =
  | 'emergency_fund'
  | 'vehicle'
  | 'travel'
  | 'property'
  | 'equipment'
  | 'financial_independence'
  | 'other';

export const GOAL_CATEGORY_LABELS: Record<GoalCategory, string> = {
  emergency_fund: 'Reserva de emergência',
  vehicle: 'Veículo',
  travel: 'Viagem',
  property: 'Imóvel',
  equipment: 'Equipamentos',
  financial_independence: 'Independência financeira',
  other: 'Outros',
};

export type GoalPriority = 'low' | 'medium' | 'high';
export type GoalStatus = 'active' | 'completed' | 'cancelled';

export interface Goal {
  id: string;
  name: string;
  description: string | null;
  category: GoalCategory;
  targetAmount: Money;
  startDate: IsoDate;
  targetDate: IsoDate | null;
  priority: GoalPriority;
  /** Conta onde o dinheiro da meta é guardado (aportes são transferências, não receitas). */
  accountId: string | null;
  status: GoalStatus;
}

/**
 * Aporte (deposit) ou retirada (withdrawal) de uma meta. É uma destinação de
 * dinheiro já existente — nunca é contabilizado como receita ou despesa.
 */
export interface GoalContribution {
  id: string;
  goalId: string;
  date: IsoDate;
  amount: Money;
  type: 'deposit' | 'withdrawal';
}
