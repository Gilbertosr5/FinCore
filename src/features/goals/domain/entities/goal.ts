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
  /**
   * Transferência entre contas registrada junto com o aporte/retirada (ADR 0011).
   * null = só a destinação foi registrada (o dinheiro já estava na conta).
   */
  transferId: string | null;
}

export const GOAL_PRIORITY_LABELS: Record<GoalPriority, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
};

export const GOAL_STATUS_LABELS: Record<GoalStatus, string> = {
  active: 'Em andamento',
  completed: 'Concluída',
  cancelled: 'Cancelada',
};
