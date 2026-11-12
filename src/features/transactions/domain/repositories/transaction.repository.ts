import type { Category } from '../entities/category';
import type { Recurrence } from '../entities/recurrence';
import type { Transaction } from '../entities/transaction';

/**
 * Conjunto de alterações do "livro de lançamentos" aplicado de forma atômica:
 * ou tudo é gravado, ou nada. Garante que as duas pernas de uma transferência,
 * todas as parcelas de um parcelamento ou uma recorrência e suas ocorrências
 * nunca fiquem pela metade.
 */
export interface LedgerChanges {
  upsert?: Transaction[];
  remove?: string[];
  upsertRecurrences?: Recurrence[];
  removeRecurrences?: string[];
}

export interface TransactionRepository {
  findAll(): Promise<Transaction[]>;
  findById(id: string): Promise<Transaction | null>;
  findRecurrences(): Promise<Recurrence[]>;
  /** Cria ou substitui (ids gerados no cliente — operação idempotente). */
  commit(changes: LedgerChanges): Promise<void>;
}

export interface CategoryRepository {
  findAll(): Promise<Category[]>;
  save(category: Category): Promise<void>;
  remove(id: string): Promise<void>;
}
