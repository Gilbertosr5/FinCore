import { countsAsExpense, countsAsIncome } from '@/features/transactions';
import { asIsoDate } from '@/lib/dates';
import { Money } from '@/lib/money';

import { createInMemoryGoals, defaultGoal } from '../../../../tests/helpers/in-memory-goals';
import type { GoalContribution } from '../domain/entities/goal';

/* Hoje = 10/03/2026; corrente R$ 1.000, poupança R$ 0, "old" arquivada. */

const brl = (value: string) => Money.of(value);
const d = asIsoDate;

const goalInput = (overrides: Record<string, unknown> = {}) => ({
  name: 'Carro novo',
  description: '  ',
  category: 'vehicle' as const,
  targetAmount: brl('30000'),
  startDate: d('2026-03-01'),
  targetDate: d('2027-03-01') as ReturnType<typeof d> | null,
  priority: 'medium' as const,
  accountId: 'savings' as string | null,
  ...overrides,
});

const deposit = (overrides: Partial<Record<string, unknown>> = {}) => ({
  goalId: 'goal',
  type: 'deposit' as GoalContribution['type'],
  amount: brl('500'),
  date: d('2026-03-05'),
  counterpartAccountId: null as string | null,
  ...overrides,
});

describe('cadastro de metas', () => {
  it('cria meta ativa, normaliza a descrição vazia e registra no histórico', async () => {
    const env = createInMemoryGoals({ goals: [] });
    const goal = await env.goals.create.execute(goalInput());
    expect(goal).toMatchObject({ status: 'active', description: null, name: 'Carro novo' });
    expect(env.state.auditLog.at(-1)).toMatchObject({ entityType: 'goal', action: 'created' });
  });

  it.each([
    [{ name: 'A' }, 'invalid_name'],
    [{ targetAmount: brl('0') }, 'invalid_amount'],
    [{ targetDate: d('2026-03-01') }, 'invalid_dates'],
    [{ accountId: 'old' }, 'account_archived'],
    [{ accountId: 'nope' }, 'account_not_found'],
    [{ description: 'x'.repeat(201) }, 'invalid_description'],
  ])('rejeita %o', async (override, code) => {
    const env = createInMemoryGoals({ goals: [] });
    await expect(env.goals.create.execute(goalInput(override))).rejects.toMatchObject({ code });
  });

  it('conclui, cancela e reativa preservando os aportes', async () => {
    const env = createInMemoryGoals();
    await env.goals.addContribution.execute(deposit());
    await env.goals.setStatus.execute('goal', 'completed');
    expect(env.store.goals.get('goal')?.status).toBe('completed');
    await expect(env.goals.addContribution.execute(deposit())).rejects.toMatchObject({
      code: 'goal_not_active',
    });
    await env.goals.setStatus.execute('goal', 'active');
    const { goals } = await env.goals.list.execute();
    expect(goals[0]?.progress.accumulated.toString()).toBe('500.00');
  });

  it('só exclui metas sem aportes', async () => {
    const env = createInMemoryGoals({ goals: [defaultGoal(), defaultGoal({ id: 'vazia' })] });
    await env.goals.addContribution.execute(deposit());
    await expect(env.goals.remove.execute('goal')).rejects.toMatchObject({ code: 'goal_in_use' });
    await env.goals.remove.execute('vazia');
    expect(env.store.goals.has('vazia')).toBe(false);
  });
});

describe('aportes e retiradas', () => {
  it('aporte sem transferência muda só o progresso — nunca saldo nem receita', async () => {
    const env = createInMemoryGoals();
    await env.goals.addContribution.execute(deposit());
    expect((await env.balanceOf('checking')).toString()).toBe('1000.00');
    expect(env.state.transactions.size).toBe(0);
    const details = await env.goals.details.execute('goal');
    expect(details.view.progress.accumulated.toString()).toBe('500.00');
    expect(details.contributions[0]?.transferId).toBeNull();
  });

  it('aporte com transferência move o dinheiro entre contas sem gerar receita', async () => {
    const env = createInMemoryGoals();
    const contribution = await env.goals.addContribution.execute(
      deposit({ counterpartAccountId: 'checking', amount: brl('400') }),
    );
    expect(contribution.transferId).not.toBeNull();
    expect((await env.balanceOf('checking')).toString()).toBe('600.00');
    expect((await env.balanceOf('savings')).toString()).toBe('400.00');
    const legs = [...env.state.transactions.values()];
    expect(legs).toHaveLength(2);
    expect(legs.every((tx) => tx.kind === 'transfer')).toBe(true);
    expect(legs.some((tx) => countsAsIncome(tx) || countsAsExpense(tx))).toBe(false);
    expect(legs[0]?.description).toBe('Aporte na meta "Viagem"');
  });

  it('retirada com transferência faz o caminho inverso e não excede o acumulado', async () => {
    const env = createInMemoryGoals();
    await env.goals.addContribution.execute(
      deposit({ counterpartAccountId: 'checking', amount: brl('400') }),
    );
    await expect(
      env.goals.addContribution.execute(
        deposit({ type: 'withdrawal', amount: brl('400.01'), date: d('2026-03-08') }),
      ),
    ).rejects.toMatchObject({ code: 'insufficient_balance' });
    // Retirada antes do aporte também é recusada (saldo da data).
    await expect(
      env.goals.addContribution.execute(
        deposit({ type: 'withdrawal', amount: brl('100'), date: d('2026-03-02') }),
      ),
    ).rejects.toMatchObject({ code: 'insufficient_balance' });

    await env.goals.addContribution.execute(
      deposit({
        type: 'withdrawal',
        amount: brl('150'),
        date: d('2026-03-08'),
        counterpartAccountId: 'checking',
      }),
    );
    expect((await env.balanceOf('checking')).toString()).toBe('750.00');
    expect((await env.balanceOf('savings')).toString()).toBe('250.00');
    const { goals } = await env.goals.list.execute();
    expect(goals[0]?.progress.accumulated.toString()).toBe('250.00');
  });

  it.each([
    [{ date: d('2026-03-11') }, 'contribution_in_future'],
    [{ date: d('2025-12-31') }, 'contribution_before_start'],
    [{ amount: brl('0') }, 'invalid_amount'],
    [{ counterpartAccountId: 'savings' }, 'same_account'],
    [{ counterpartAccountId: 'old' }, 'account_archived'],
  ])('rejeita aporte %o', async (override, code) => {
    const env = createInMemoryGoals();
    await expect(env.goals.addContribution.execute(deposit(override))).rejects.toMatchObject({
      code,
    });
    expect(env.state.transactions.size).toBe(0);
  });

  it('transferência exige conta da meta', async () => {
    const env = createInMemoryGoals({ goals: [defaultGoal({ accountId: null })] });
    await expect(
      env.goals.addContribution.execute(deposit({ counterpartAccountId: 'checking' })),
    ).rejects.toMatchObject({ code: 'transfer_requires_account' });
  });

  it('aporte e transferência são gravados juntos: se a gravação falhar, nenhum dos dois fica', async () => {
    const env = createInMemoryGoals();
    env.failures.saveContribution = true;
    await expect(
      env.goals.addContribution.execute(deposit({ counterpartAccountId: 'checking' })),
    ).rejects.toThrow('falha simulada');
    expect(env.state.transactions.size).toBe(0);
    expect((await env.balanceOf('checking')).toString()).toBe('1000.00');
  });

  it('excluir aporte remove também a transferência; não deixa retiradas sem saldo', async () => {
    const env = createInMemoryGoals();
    const first = await env.goals.addContribution.execute(
      deposit({ counterpartAccountId: 'checking', amount: brl('400') }),
    );
    await env.goals.addContribution.execute(
      deposit({ type: 'withdrawal', amount: brl('300'), date: d('2026-03-09') }),
    );
    await expect(env.goals.removeContribution.execute(first.id)).rejects.toMatchObject({
      code: 'insufficient_balance',
    });

    const second = await env.goals.addContribution.execute(
      deposit({ amount: brl('300'), date: d('2026-03-06') }),
    );
    await env.goals.removeContribution.execute(first.id);
    expect(env.state.transactions.size).toBe(0);
    expect((await env.balanceOf('checking')).toString()).toBe('1000.00');
    expect(env.store.contributions.has(second.id)).toBe(true);
  });
});

describe('visão geral e projeção', () => {
  it('soma metas ativas e calcula aporte mensal necessário', async () => {
    const env = createInMemoryGoals({
      goals: [
        defaultGoal(),
        defaultGoal({ id: 'sem-prazo', targetDate: null, priority: 'low' }),
        defaultGoal({ id: 'cancelada', status: 'cancelled' }),
      ],
    });
    await env.goals.addContribution.execute(deposit({ amount: brl('1200') }));
    const overview = await env.goals.list.execute();
    expect(overview.goals.map((view) => view.progress.goal.id)).toEqual([
      'goal',
      'sem-prazo',
      'cancelada',
    ]);
    expect(overview.totalTarget.toString()).toBe('12000.00');
    expect(overview.totalAccumulated.toString()).toBe('1200.00');
    // Faltam 4.800 em 9 meses (mar → dez).
    expect(overview.totalMonthlyRequired.toString()).toBe('533.33');
  });

  it('projeta a conclusão no ritmo dos aportes recentes', async () => {
    const contributions: GoalContribution[] = ['2026-01-10', '2026-02-10', '2026-03-05'].map(
      (date, index) => ({
        id: `c${index}`,
        goalId: 'goal',
        date: d(date),
        amount: brl('600'),
        type: 'deposit',
        transferId: null,
      }),
    );
    const env = createInMemoryGoals({ contributions });
    const { view } = await env.goals.details.execute('goal');
    // 1.800 em 2 meses (jan → mar) = 900/mês; faltam 4.200 → 5 meses → ago/2026.
    expect(view.projection.averageMonthly.toString()).toBe('900.00');
    expect(view.projection.projectedDate).toBe('2026-08-31');
    expect(view.projection.onTrack).toBe(true);
  });
});
