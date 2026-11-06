import type { AxiosInstance } from 'axios';

import { parseRecords } from '@/lib/schemas/parse-records';
import { fetchList } from '@/services/api/list-resource';
import type { DemoDataStore } from '@/services/storage/demo-data-store';

import { categoryRecordSchema, transactionRecordSchema } from './transaction.records';
import type { Category } from '../domain/entities/category';
import type { Transaction } from '../domain/entities/transaction';
import type {
  CategoryRepository,
  TransactionRepository,
} from '../domain/repositories/transaction.repository';

export const TRANSACTION_ENDPOINTS = {
  list: '/transactions',
  categories: '/categories',
} as const;

export class DemoTransactionRepository implements TransactionRepository {
  constructor(private readonly store: DemoDataStore) {}

  async findAll(): Promise<Transaction[]> {
    return parseRecords(
      transactionRecordSchema,
      await this.store.readAll('transactions'),
      'transactions',
    );
  }
}

export class DemoCategoryRepository implements CategoryRepository {
  constructor(private readonly store: DemoDataStore) {}

  async findAll(): Promise<Category[]> {
    return parseRecords(categoryRecordSchema, await this.store.readAll('categories'), 'categories');
  }
}

export class ApiTransactionRepository implements TransactionRepository {
  constructor(private readonly http: AxiosInstance) {}

  findAll(): Promise<Transaction[]> {
    return fetchList(this.http, TRANSACTION_ENDPOINTS.list, transactionRecordSchema);
  }
}

export class ApiCategoryRepository implements CategoryRepository {
  constructor(private readonly http: AxiosInstance) {}

  findAll(): Promise<Category[]> {
    return fetchList(this.http, TRANSACTION_ENDPOINTS.categories, categoryRecordSchema);
  }
}
