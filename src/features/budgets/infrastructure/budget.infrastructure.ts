import type { AxiosInstance } from 'axios';
import { z } from 'zod';

import { parseRecords } from '@/lib/schemas/parse-records';
import { idField, moneyField } from '@/lib/schemas/record-fields';
import { isApiError } from '@/services/api/api-error';
import { fetchList } from '@/services/api/list-resource';
import type { DemoDataStore } from '@/services/storage/demo-data-store';

import type { Budget } from '../domain/entities/budget';
import type { BudgetRepository } from '../domain/repositories/budget.repository';

export const BUDGET_ENDPOINTS = {
  list: '/budgets',
  byId: (id: string) => `/budgets/${encodeURIComponent(id)}`,
} as const;

export const budgetRecordSchema = z
  .object({
    id: idField,
    name: z.string().min(1),
    categoryId: idField.nullish().transform((value) => value ?? null),
    amount: moneyField,
    period: z.enum(['monthly', 'yearly']),
    alertThresholdPercent: z.number().min(1).max(100).default(80),
    active: z.boolean().default(true),
  })
  .transform((record): Budget => record);

export function budgetToRecord(budget: Budget) {
  return { ...budget, amount: budget.amount.toString() };
}

export class DemoBudgetRepository implements BudgetRepository {
  constructor(private readonly store: DemoDataStore) {}

  async findAll(): Promise<Budget[]> {
    return parseRecords(budgetRecordSchema, await this.store.readAll('budgets'), 'budgets');
  }

  async findById(id: string): Promise<Budget | null> {
    const record = await this.store.get('budgets', id);
    if (!record) return null;
    return parseRecords(budgetRecordSchema, [record], 'budgets')[0] ?? null;
  }

  async save(budget: Budget): Promise<void> {
    await this.store.write({ put: { budgets: [budgetToRecord(budget)] } });
  }

  async remove(id: string): Promise<void> {
    await this.store.write({ remove: { budgets: [id] } });
  }
}

export class ApiBudgetRepository implements BudgetRepository {
  constructor(private readonly http: AxiosInstance) {}

  findAll(): Promise<Budget[]> {
    return fetchList(this.http, BUDGET_ENDPOINTS.list, budgetRecordSchema);
  }

  async findById(id: string): Promise<Budget | null> {
    try {
      const { data } = await this.http.get<unknown>(BUDGET_ENDPOINTS.byId(id));
      return parseRecords(budgetRecordSchema, [data], `GET /budgets/${id}`)[0] ?? null;
    } catch (error) {
      if (isApiError(error) && error.kind === 'not_found') return null;
      throw error;
    }
  }

  async save(budget: Budget): Promise<void> {
    await this.http.put(BUDGET_ENDPOINTS.byId(budget.id), budgetToRecord(budget));
  }

  async remove(id: string): Promise<void> {
    await this.http.delete(BUDGET_ENDPOINTS.byId(id));
  }
}
