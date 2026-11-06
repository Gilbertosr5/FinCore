import type { Budget } from '../entities/budget';

/** Contrato de leitura. Escrita e histórico de orçamentos entram na Fase 5. */
export interface BudgetRepository {
  findAll(): Promise<Budget[]>;
}
