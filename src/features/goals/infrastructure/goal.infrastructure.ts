import type { AxiosInstance } from 'axios';
import { z } from 'zod';

import { parseRecords } from '@/lib/schemas/parse-records';
import { idField, isoDateField, moneyField, nullableString } from '@/lib/schemas/record-fields';
import { fetchList } from '@/services/api/list-resource';
import type { DemoDataStore } from '@/services/storage/demo-data-store';

import type { Goal, GoalContribution } from '../domain/entities/goal';
import type { GoalRepository } from '../domain/repositories/goal.repository';

export const GOAL_ENDPOINTS = {
  list: '/goals',
  contributions: '/goals/contributions',
} as const;

export const goalRecordSchema = z
  .object({
    id: idField,
    name: z.string().min(1),
    description: nullableString,
    category: z.enum([
      'emergency_fund',
      'vehicle',
      'travel',
      'property',
      'equipment',
      'financial_independence',
      'other',
    ]),
    targetAmount: moneyField,
    startDate: isoDateField,
    targetDate: isoDateField.nullish().transform((value) => value ?? null),
    priority: z.enum(['low', 'medium', 'high']),
    accountId: idField.nullish().transform((value) => value ?? null),
    status: z.enum(['active', 'completed', 'cancelled']),
  })
  .transform((record): Goal => record);

export const goalContributionRecordSchema = z
  .object({
    id: idField,
    goalId: idField,
    date: isoDateField,
    amount: moneyField,
    type: z.enum(['deposit', 'withdrawal']),
  })
  .transform((record): GoalContribution => record);

export function goalToRecord(goal: Goal) {
  return { ...goal, targetAmount: goal.targetAmount.toString() };
}

export function goalContributionToRecord(contribution: GoalContribution) {
  return { ...contribution, amount: contribution.amount.toString() };
}

export class DemoGoalRepository implements GoalRepository {
  constructor(private readonly store: DemoDataStore) {}

  async findAll(): Promise<Goal[]> {
    return parseRecords(goalRecordSchema, await this.store.readAll('goals'), 'goals');
  }

  async findContributions(): Promise<GoalContribution[]> {
    return parseRecords(
      goalContributionRecordSchema,
      await this.store.readAll('goalContributions'),
      'goalContributions',
    );
  }
}

export class ApiGoalRepository implements GoalRepository {
  constructor(private readonly http: AxiosInstance) {}

  findAll(): Promise<Goal[]> {
    return fetchList(this.http, GOAL_ENDPOINTS.list, goalRecordSchema);
  }

  findContributions(): Promise<GoalContribution[]> {
    return fetchList(this.http, GOAL_ENDPOINTS.contributions, goalContributionRecordSchema);
  }
}
