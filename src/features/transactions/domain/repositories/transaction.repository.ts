import type { Category } from '../entities/category';
import type { Transaction } from '../entities/transaction';

/**
 * Contratos de leitura. Escrita (criar, editar, duplicar, cancelar, recorrências,
 * parcelamentos) e filtros no servidor entram na Fase 4.
 */
export interface TransactionRepository {
  findAll(): Promise<Transaction[]>;
}

export interface CategoryRepository {
  findAll(): Promise<Category[]>;
}
