import {
  createGoalUseCases,
  type Goal,
  type GoalContribution,
  type GoalRepository,
} from '@/features/goals';
import { asIsoDate } from '@/lib/dates';
import { Money } from '@/lib/money';

import { createInMemoryLedger } from './in-memory-ledger';

type LedgerOptions = Parameters<typeof createInMemoryLedger>[0];

/**
 * Livro em memória + repositório de metas. A porta de transferências usa os
 * mesmos casos de uso de lançamentos que a composição real (DataProvider).
 */
export function createInMemoryGoals(
  options: LedgerOptions & { goals?: Goal[]; contributions?: GoalContribution[] } = {},
) {
  const ledger = createInMemoryLedger(options);
  const goals = new Map((options.goals ?? [defaultGoal()]).map((g) => [g.id, g]));
  const contributions = new Map((options.contributions ?? []).map((c) => [c.id, c]));
  const failures = { saveContribution: false };

  const repository: GoalRepository = {
    findAll: () => Promise.resolve([...goals.values()]),
    findById: (id) => Promise.resolve(goals.get(id) ?? null),
    save: (goal) => {
      goals.set(goal.id, goal);
      return Promise.resolve();
    },
    remove: (id) => {
      goals.delete(id);
      return Promise.resolve();
    },
    findContributions: () => Promise.resolve([...contributions.values()]),
    // Gravação atômica: com falha simulada, nem o aporte nem a transferência ficam.
    saveContribution: (contribution, legs = []) => {
      if (failures.saveContribution) return Promise.reject(new Error('falha simulada'));
      contributions.set(contribution.id, contribution);
      for (const leg of legs) ledger.state.transactions.set(leg.id, leg);
      return Promise.resolve();
    },
    removeContribution: (id, legIds = []) => {
      contributions.delete(id);
      for (const legId of legIds) ledger.state.transactions.delete(legId);
      return Promise.resolve();
    },
  };

  const useCases = createGoalUseCases({
    ...ledger.context,
    goals: repository,
    transfers: {
      prepare: (input) => ledger.ledger.createTransfer.prepare(input),
      prepareRemoval: (transferId) =>
        ledger.ledger.createTransfer.prepareRemoval(transferId, 'Excluído junto com o aporte'),
    },
  });

  return {
    ...ledger,
    goals: useCases,
    store: { goals, contributions },
    failures,
    async balanceOf(accountId: string): Promise<Money> {
      const found = (await ledger.accounts.list.execute()).find(
        (item) => item.account.id === accountId,
      );
      if (!found) throw new Error(`conta ${accountId} não encontrada`);
      return found.balance;
    },
  };
}

/** Meta padrão: R$ 6.000 de 01/01 a 31/12/2026, guardada na poupança. */
export function defaultGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'goal',
    name: 'Viagem',
    description: null,
    category: 'travel',
    targetAmount: Money.of('6000'),
    startDate: asIsoDate('2026-01-01'),
    targetDate: asIsoDate('2026-12-31'),
    priority: 'high',
    accountId: 'savings',
    status: 'active',
    ...overrides,
  };
}
