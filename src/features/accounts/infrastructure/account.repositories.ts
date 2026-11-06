import type { AxiosInstance } from 'axios';

import { parseRecords } from '@/lib/schemas/parse-records';
import { fetchList } from '@/services/api/list-resource';
import type { DemoDataStore } from '@/services/storage/demo-data-store';

import { accountRecordSchema } from './account.records';
import type { Account } from '../domain/entities/account';
import type { AccountRepository } from '../domain/repositories/account.repository';

export const ACCOUNT_ENDPOINTS = { list: '/accounts' } as const;

/** Implementação de demonstração (IndexedDB). */
export class DemoAccountRepository implements AccountRepository {
  constructor(private readonly store: DemoDataStore) {}

  async findAll(): Promise<Account[]> {
    return parseRecords(accountRecordSchema, await this.store.readAll('accounts'), 'accounts');
  }
}

/** Implementação REST (contrato em docs/api-contract.md). */
export class ApiAccountRepository implements AccountRepository {
  constructor(private readonly http: AxiosInstance) {}

  findAll(): Promise<Account[]> {
    return fetchList(this.http, ACCOUNT_ENDPOINTS.list, accountRecordSchema);
  }
}
