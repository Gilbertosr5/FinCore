import type { Goal, GoalContribution } from '../entities/goal';

/** Contrato de leitura. Criação, edição e registro de aportes entram na Fase 6. */
export interface GoalRepository {
  findAll(): Promise<Goal[]>;
  findContributions(): Promise<GoalContribution[]>;
}
