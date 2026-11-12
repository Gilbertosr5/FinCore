import type { AxiosInstance } from 'axios';

import { parseRecords } from '@/lib/schemas/parse-records';
import { isApiError } from '@/services/api/api-error';
import { fetchList } from '@/services/api/list-resource';
import type { DemoDataStore } from '@/services/storage/demo-data-store';

import { accountRecordSchema, accountToRecord } from './account.records';
import type { Account } from '../domain/entities/account';
import type { AccountRepository } from '../domain/repositories/account.repository';

export const ACCOUNT_ENDPOINTS = {
  list: '/accounts',
  byId: (id: string) => `/accounts/${encodeURIComponent(id)}`,
} as const;

/** Implementação de demonstração (IndexedDB). */
export class DemoAccountRepository implements AccountRepository {
  constructor(private readonly store: DemoDataStore) {}

  async findAll(): Promise<Account[]> {
    return parseRecords(accountRecordSchema, await this.store.readAll('accounts'), 'accounts');
  }

  async findById(id: string): Promise<Account | null> {
    const record = await this.store.get('accounts', id);
    if (!record) return null;
    return parseRecords(accountRecordSchema, [record], 'accounts')[0] ?? null;
  }

  async save(account: Account): Promise<void> {
    await this.store.write({ put: { accounts: [accountToRecord(account)] } });
  }
}

/** Implementação REST (contrato em docs/api-contract.md). */
export class ApiAccountRepository implements AccountRepository {
  constructor(private readonly http: AxiosInstance) {}

  findAll(): Promise<Account[]> {
    return fetchList(this.http, ACCOUNT_ENDPOINTS.list, accountRecordSchema);
  }

  async findById(id: string): Promise<Account | null> {
    try {
      const { data } = await this.http.get<unknown>(ACCOUNT_ENDPOINTS.byId(id));
      return parseRecords(accountRecordSchema, [data], `GET /accounts/${id}`)[0] ?? null;
    } catch (error) {
      if (isApiError(error) && error.kind === 'not_found') return null;
      throw error;
    }
  }

  async save(account: Account): Promise<void> {
    await this.http.put(ACCOUNT_ENDPOINTS.byId(account.id), accountToRecord(account));
  }
}
