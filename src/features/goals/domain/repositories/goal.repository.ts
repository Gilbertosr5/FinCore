import type { Goal, GoalContribution } from '../entities/goal';

/** Contrato do repositório de metas (ids gerados no cliente; gravação idempotente). */
export interface GoalRepository {
  findAll(): Promise<Goal[]>;
  findById(id: string): Promise<Goal | null>;
  save(goal: Goal): Promise<void>;
  /** Exclui a meta (somente sem aportes — validado no caso de uso). */
  remove(id: string): Promise<void>;
  findContributions(): Promise<GoalContribution[]>;
  saveContribution(contribution: GoalContribution): Promise<void>;
  removeContribution(id: string): Promise<void>;
}
