import type { Budget } from '../entities/budget';

/** Contrato do repositório de orçamentos (ids gerados no cliente; gravação idempotente). */
export interface BudgetRepository {
  findAll(): Promise<Budget[]>;
  findById(id: string): Promise<Budget | null>;
  save(budget: Budget): Promise<void>;
  remove(id: string): Promise<void>;
}
