import type { AxiosInstance } from 'axios';

import { parseRecords } from '@/lib/schemas/parse-records';
import { isApiError } from '@/services/api/api-error';
import { fetchList } from '@/services/api/list-resource';
import type { DemoDataStore, DemoRecord } from '@/services/storage/demo-data-store';

import {
  categoryRecordSchema,
  categoryToRecord,
  recurrenceRecordSchema,
  recurrenceToRecord,
  transactionRecordSchema,
  transactionToRecord,
} from './transaction.records';
import type { Category } from '../domain/entities/category';
import type { Recurrence } from '../domain/entities/recurrence';
import type { Transaction } from '../domain/entities/transaction';
import { TransactionError } from '../domain/errors/transaction-error';
import type {
  CategoryRepository,
  LedgerChanges,
  TransactionRepository,
} from '../domain/repositories/transaction.repository';

export const TRANSACTION_ENDPOINTS = {
  list: '/transactions',
  byId: (id: string) => `/transactions/${encodeURIComponent(id)}`,
  batch: '/transactions/batch',
  recurrences: '/recurrences',
  categories: '/categories',
  category: (id: string) => `/categories/${encodeURIComponent(id)}`,
} as const;

const asRecord = (value: object) => value as DemoRecord;

/** Corpo do lote atômico (mesmo formato no IndexedDB e na API). */
function toBatchPayload(changes: LedgerChanges) {
  return {
    upsert: (changes.upsert ?? []).map(transactionToRecord),
    remove: changes.remove ?? [],
    upsertRecurrences: (changes.upsertRecurrences ?? []).map(recurrenceToRecord),
    removeRecurrences: changes.removeRecurrences ?? [],
  };
}

export class DemoTransactionRepository implements TransactionRepository {
  constructor(private readonly store: DemoDataStore) {}

  async findAll(): Promise<Transaction[]> {
    return parseRecords(
      transactionRecordSchema,
      await this.store.readAll('transactions'),
      'transactions',
    );
  }

  async findById(id: string): Promise<Transaction | null> {
    const record = await this.store.get('transactions', id);
    if (!record) return null;
    return parseRecords(transactionRecordSchema, [record], 'transactions')[0] ?? null;
  }

  async findRecurrences(): Promise<Recurrence[]> {
    return parseRecords(
      recurrenceRecordSchema,
      await this.store.readAll('recurrences'),
      'recurrences',
    );
  }

  async commit(changes: LedgerChanges): Promise<void> {
    const payload = toBatchPayload(changes);
    await this.store.write({
      put: {
        transactions: payload.upsert.map(asRecord),
        recurrences: payload.upsertRecurrences.map(asRecord),
      },
      remove: { transactions: payload.remove, recurrences: payload.removeRecurrences },
    });
  }
}

export class DemoCategoryRepository implements CategoryRepository {
  constructor(private readonly store: DemoDataStore) {}

  async findAll(): Promise<Category[]> {
    return parseRecords(categoryRecordSchema, await this.store.readAll('categories'), 'categories');
  }

  async save(category: Category): Promise<void> {
    await this.store.write({ put: { categories: [asRecord(categoryToRecord(category))] } });
  }

  async remove(id: string): Promise<void> {
    await this.store.write({ remove: { categories: [id] } });
  }
}

/** Implementação REST (contrato em docs/api-contract.md). */
export class ApiTransactionRepository implements TransactionRepository {
  constructor(private readonly http: AxiosInstance) {}

  findAll(): Promise<Transaction[]> {
    return fetchList(this.http, TRANSACTION_ENDPOINTS.list, transactionRecordSchema);
  }

  async findById(id: string): Promise<Transaction | null> {
    try {
      const { data } = await this.http.get<unknown>(TRANSACTION_ENDPOINTS.byId(id));
      return parseRecords(transactionRecordSchema, [data], `GET /transactions/${id}`)[0] ?? null;
    } catch (error) {
      if (isApiError(error) && error.kind === 'not_found') return null;
      throw error;
    }
  }

  findRecurrences(): Promise<Recurrence[]> {
    return fetchList(this.http, TRANSACTION_ENDPOINTS.recurrences, recurrenceRecordSchema);
  }

  async commit(changes: LedgerChanges): Promise<void> {
    await this.http.post(TRANSACTION_ENDPOINTS.batch, toBatchPayload(changes));
  }
}

export class ApiCategoryRepository implements CategoryRepository {
  constructor(private readonly http: AxiosInstance) {}

  findAll(): Promise<Category[]> {
    return fetchList(this.http, TRANSACTION_ENDPOINTS.categories, categoryRecordSchema);
  }

  async save(category: Category): Promise<void> {
    await this.http.put(TRANSACTION_ENDPOINTS.category(category.id), categoryToRecord(category));
  }

  async remove(id: string): Promise<void> {
    try {
      await this.http.delete(TRANSACTION_ENDPOINTS.category(id));
    } catch (error) {
      if (isApiError(error) && error.kind === 'conflict') {
        throw new TransactionError(
          'category_in_use',
          'Esta categoria possui lançamentos e não pode ser excluída.',
        );
      }
      throw error;
    }
  }
}
