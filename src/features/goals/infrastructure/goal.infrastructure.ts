import type { AxiosInstance } from 'axios';
import { z } from 'zod';

import { transactionToRecord, type Transaction } from '@/features/transactions';
import { parseRecords } from '@/lib/schemas/parse-records';
import { idField, isoDateField, moneyField, nullableString } from '@/lib/schemas/record-fields';
import { isApiError } from '@/services/api/api-error';
import { fetchList } from '@/services/api/list-resource';
import type { DemoRecord } from '@/services/storage/demo-data-contracts';
import type { DemoDataStore } from '@/services/storage/demo-data-store';

import type { Goal, GoalContribution } from '../domain/entities/goal';
import type { GoalRepository } from '../domain/repositories/goal.repository';

export const GOAL_ENDPOINTS = {
  list: '/goals',
  byId: (id: string) => `/goals/${encodeURIComponent(id)}`,
  contributions: '/goals/contributions',
  contribution: (id: string) => `/goals/contributions/${encodeURIComponent(id)}`,
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
    transferId: idField.nullish().transform((value) => value ?? null),
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

  async findById(id: string): Promise<Goal | null> {
    const record = await this.store.get('goals', id);
    if (!record) return null;
    return parseRecords(goalRecordSchema, [record], 'goals')[0] ?? null;
  }

  async save(goal: Goal): Promise<void> {
    await this.store.write({ put: { goals: [goalToRecord(goal)] } });
  }

  async remove(id: string): Promise<void> {
    await this.store.write({ remove: { goals: [id] } });
  }

  async findContributions(): Promise<GoalContribution[]> {
    return parseRecords(
      goalContributionRecordSchema,
      await this.store.readAll('goalContributions'),
      'goalContributions',
    );
  }

  async saveContribution(
    contribution: GoalContribution,
    transferLegs: readonly Transaction[] = [],
  ): Promise<void> {
    // Uma única transação do IndexedDB: aporte e transferência, ou nada.
    await this.store.write({
      put: {
        goalContributions: [goalContributionToRecord(contribution)],
        transactions: transferLegs.map((leg) => transactionToRecord(leg) as DemoRecord),
      },
    });
  }

  async removeContribution(id: string, transferLegIds: readonly string[] = []): Promise<void> {
    await this.store.write({
      remove: { goalContributions: [id], transactions: [...transferLegIds] },
    });
  }
}

/** Implementação REST (contrato em docs/api-contract.md). */
export class ApiGoalRepository implements GoalRepository {
  constructor(private readonly http: AxiosInstance) {}

  findAll(): Promise<Goal[]> {
    return fetchList(this.http, GOAL_ENDPOINTS.list, goalRecordSchema);
  }

  async findById(id: string): Promise<Goal | null> {
    try {
      const { data } = await this.http.get<unknown>(GOAL_ENDPOINTS.byId(id));
      return parseRecords(goalRecordSchema, [data], `GET /goals/${id}`)[0] ?? null;
    } catch (error) {
      if (isApiError(error) && error.kind === 'not_found') return null;
      throw error;
    }
  }

  async save(goal: Goal): Promise<void> {
    await this.http.put(GOAL_ENDPOINTS.byId(goal.id), goalToRecord(goal));
  }

  async remove(id: string): Promise<void> {
    await this.http.delete(GOAL_ENDPOINTS.byId(id));
  }

  findContributions(): Promise<GoalContribution[]> {
    return fetchList(this.http, GOAL_ENDPOINTS.contributions, goalContributionRecordSchema);
  }

  /** Aporte + pernas da transferência numa única requisição (o servidor grava tudo ou nada). */
  async saveContribution(
    contribution: GoalContribution,
    transferLegs: readonly Transaction[] = [],
  ): Promise<void> {
    await this.http.put(GOAL_ENDPOINTS.contribution(contribution.id), {
      ...goalContributionToRecord(contribution),
      transactions: transferLegs.map(transactionToRecord),
    });
  }

  /** O servidor exclui as pernas da transferência vinculada na mesma transação. */
  async removeContribution(id: string): Promise<void> {
    await this.http.delete(GOAL_ENDPOINTS.contribution(id));
  }
}
