import type { Transaction } from '@/features/transactions/domain/entities/transaction';

import type { Goal, GoalContribution } from '../entities/goal';

/** Contrato do repositório de metas (ids gerados no cliente; gravação idempotente). */
export interface GoalRepository {
  findAll(): Promise<Goal[]>;
  findById(id: string): Promise<Goal | null>;
  save(goal: Goal): Promise<void>;
  /** Exclui a meta (somente sem aportes — validado no caso de uso). */
  remove(id: string): Promise<void>;
  findContributions(): Promise<GoalContribution[]>;
  /**
   * Grava o aporte e, se houver, as pernas da transferência numa única operação
   * atômica (ADR 0015): na API, uma requisição; no IndexedDB, uma transação.
   */
  saveContribution(
    contribution: GoalContribution,
    transferLegs?: readonly Transaction[],
  ): Promise<void>;
  /** Exclui o aporte e as pernas da transferência vinculada, atomicamente. */
  removeContribution(id: string, transferLegIds?: readonly string[]): Promise<void>;
}
