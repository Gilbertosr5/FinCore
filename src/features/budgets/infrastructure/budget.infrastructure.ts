import type { AxiosInstance } from 'axios';
import { z } from 'zod';

import { parseRecords } from '@/lib/schemas/parse-records';
import { idField, moneyField } from '@/lib/schemas/record-fields';
import { fetchList } from '@/services/api/list-resource';
import type { DemoDataStore } from '@/services/storage/demo-data-store';

import type { Budget } from '../domain/entities/budget';
import type { BudgetRepository } from '../domain/repositories/budget.repository';

export const BUDGET_ENDPOINTS = { list: '/budgets' } as const;

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
}

export class ApiBudgetRepository implements BudgetRepository {
  constructor(private readonly http: AxiosInstance) {}

  findAll(): Promise<Budget[]> {
    return fetchList(this.http, BUDGET_ENDPOINTS.list, budgetRecordSchema);
  }
}
