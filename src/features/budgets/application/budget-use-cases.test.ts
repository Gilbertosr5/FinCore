import { asMonthKey } from '@/lib/dates';
import { Money } from '@/lib/money';

import { tx, transfer } from '../../../../tests/helpers/finance-fixtures';
import { createInMemoryFinance, day } from '../../../../tests/helpers/in-memory-cards';
import type { Budget } from '../domain/entities/budget';

/* Hoje = 10/03/2026; cartão fecha dia 3 (compra em 05/03 → fatura de abril). */

const brl = (value: string) => Money.of(value);

function budget(overrides: Partial<Budget> = {}): Budget {
  return {
    id: 'bud-food',
    name: 'Alimentação',
    categoryId: 'food',
    amount: brl('800'),
    period: 'monthly',
    alertThresholdPercent: 80,
    active: true,
    ...overrides,
  };
}

const input = (overrides: Partial<Omit<Budget, 'id' | 'active'>> = {}) => ({
  name: 'Saúde',
  categoryId: 'health' as string | null,
  amount: brl('500'),
  period: 'monthly' as const,
  alertThresholdPercent: 80,
  ...overrides,
});

describe('cadastro de orçamentos', () => {
  it('cria orçamento ativo e registra no histórico', async () => {
    const env = createInMemoryFinance();
    const created = await env.budgets.create.execute(input());
    expect(created).toMatchObject({ name: 'Saúde', active: true, categoryId: 'health' });
    expect(env.state.auditLog.at(-1)).toMatchObject({ entityType: 'budget', action: 'created' });
  });

  it.each([
    [{ name: 'A' }, 'invalid_name'],
    [{ amount: brl('0') }, 'invalid_amount'],
    [{ alertThresholdPercent: 0 }, 'invalid_threshold'],
    [{ alertThresholdPercent: 101 }, 'invalid_threshold'],
    [{ categoryId: 'salary' }, 'category_mismatch'],
    [{ categoryId: 'nope' }, 'category_not_found'],
  ])('rejeita %o', async (override, code) => {
    const env = createInMemoryFinance();
    await expect(env.budgets.create.execute(input(override))).rejects.toMatchObject({ code });
  });

  it('impede dois orçamentos ativos para a mesma categoria e período', async () => {
    const env = createInMemoryFinance({ budgets: [budget()] });
    await expect(env.budgets.create.execute(input({ categoryId: 'food' }))).rejects.toMatchObject({
      code: 'duplicate',
    });
    // Período diferente é permitido.
    await env.budgets.create.execute(input({ categoryId: 'food', period: 'yearly' }));
    // Pausado não conflita; reativar com conflito é rejeitado.
    await env.budgets.setActive.execute('bud-food', false);
    const second = await env.budgets.create.execute(input({ categoryId: 'food' }));
    await expect(env.budgets.setActive.execute('bud-food', true)).rejects.toMatchObject({
      code: 'duplicate',
    });
    await env.budgets.remove.execute(second.id);
    await env.budgets.setActive.execute('bud-food', true);
    expect(env.finance.budgets.get('bud-food')?.active).toBe(true);
  });

  it('edição registra a mudança de limite', async () => {
    const env = createInMemoryFinance({ budgets: [budget()] });
    await env.budgets.update.execute('bud-food', input({ name: 'Comida', categoryId: 'food' }));
    expect(env.finance.budgets.get('bud-food')).toMatchObject({ name: 'Comida' });
    expect(env.state.auditLog.at(-1)?.summary).toMatch(/Limite alterado/);
  });
});

describe('consumo dos orçamentos', () => {
  it('soma despesas e parcelas do cartão; ignora transferências, pagamentos de fatura e cancelados', async () => {
    const env = createInMemoryFinance({
      budgets: [
        budget(),
        budget({ id: 'bud-geral', name: 'Geral', categoryId: null, amount: brl('1000') }),
      ],
      transactions: [
        tx({
          accountId: 'checking',
          amount: '200',
          categoryId: 'food',
          competenceDate: day('2026-03-02'),
        }),
        tx({
          accountId: 'checking',
          amount: '150',
          categoryId: 'food',
          competenceDate: day('2026-03-20'),
          status: 'pending',
        }),
        tx({
          accountId: 'checking',
          amount: '999',
          categoryId: 'food',
          competenceDate: day('2026-03-04'),
          status: 'cancelled',
        }),
        tx({
          accountId: 'checking',
          amount: '100',
          categoryId: 'health',
          competenceDate: day('2026-03-03'),
        }),
        ...transfer('checking', 'savings', '500', '2026-03-05'),
        tx({
          accountId: 'checking',
          kind: 'card_payment',
          amount: '700',
          competenceDate: day('2026-03-06'),
          cardPayment: { cardId: 'card', invoiceMonth: asMonthKey('2026-03') },
        }),
      ],
    });
    // Compra parcelada em 05/03: parcelas por competência (mar, abr, mai).
    await env.cards.registerPurchase.execute({
      cardId: 'card',
      description: 'Restaurante',
      categoryId: 'food',
      totalAmount: brl('300'),
      purchaseDate: day('2026-03-05'),
      installmentCount: 3,
    });

    const march = await env.budgets.month.execute(asMonthKey('2026-03'));
    const food = march.items.find((item) => item.usage.budget.id === 'bud-food');
    const general = march.items.find((item) => item.usage.budget.id === 'bud-geral');
    // 200 + 150 (pendente) + 100 (1ª parcela) = 450.
    expect(food?.usage.spent.toString()).toBe('450.00');
    expect(food?.usage.status).toBe('ok');
    expect(food?.categoryName).toBe('Alimentação');
    // Geral: 450 + 100 (saúde) = 550.
    expect(general?.usage.spent.toString()).toBe('550.00');

    const april = await env.budgets.month.execute(asMonthKey('2026-04'));
    expect(
      april.items.find((item) => item.usage.budget.id === 'bud-food')?.usage.spent.toString(),
    ).toBe('100.00');
  });

  it('alerta ao atingir o limiar e indica o excedente acima de 100%', async () => {
    const env = createInMemoryFinance({
      budgets: [
        budget(),
        budget({ id: 'bud-health', name: 'Saúde', categoryId: 'health', amount: brl('100') }),
      ],
      transactions: [
        tx({
          accountId: 'checking',
          amount: '640',
          categoryId: 'food',
          competenceDate: day('2026-03-02'),
        }),
        tx({
          accountId: 'checking',
          amount: '130',
          categoryId: 'health',
          competenceDate: day('2026-03-02'),
        }),
      ],
    });
    const overview = await env.budgets.month.execute(asMonthKey('2026-03'));
    const food = overview.items.find((item) => item.usage.budget.id === 'bud-food');
    const health = overview.items.find((item) => item.usage.budget.id === 'bud-health');
    expect(food?.usage.status).toBe('warning');
    expect(food?.usage.remaining.toString()).toBe('160.00');
    expect(health?.usage.status).toBe('exceeded');
    expect(health?.usage.excess.toString()).toBe('30.00');
    expect(overview.counts).toEqual({ ok: 0, warning: 1, exceeded: 1 });
    // Excedidos primeiro.
    expect(overview.items[0]?.usage.budget.id).toBe('bud-health');
    expect(overview.plannedByCategory.toString()).toBe('900.00');
    expect(overview.spentByCategory.toString()).toBe('770.00');
  });

  it('orçamento anual usa o ano inteiro e pausados ficam fora das contagens', async () => {
    const env = createInMemoryFinance({
      budgets: [
        budget({ id: 'anual', period: 'yearly', amount: brl('5000') }),
        budget({ id: 'pausado', categoryId: 'health', active: false }),
      ],
      transactions: [
        tx({
          accountId: 'checking',
          amount: '300',
          categoryId: 'food',
          competenceDate: day('2026-01-15'),
        }),
        tx({
          accountId: 'checking',
          amount: '200',
          categoryId: 'food',
          competenceDate: day('2026-03-02'),
        }),
        tx({
          accountId: 'checking',
          amount: '999',
          categoryId: 'food',
          competenceDate: day('2025-12-31'),
        }),
      ],
    });
    const overview = await env.budgets.month.execute(asMonthKey('2026-03'));
    const yearly = overview.items.find((item) => item.usage.budget.id === 'anual');
    expect(yearly?.usage.spent.toString()).toBe('500.00');
    expect(yearly?.period).toEqual({ start: '2026-01-01', end: '2026-12-31' });
    expect(overview.counts).toEqual({ ok: 1, warning: 0, exceeded: 0 });
    expect(overview.items.at(-1)?.usage.budget.id).toBe('pausado');
  });

  it('histórico mostra planejado × realizado dos últimos 12 meses (mais recente primeiro)', async () => {
    const env = createInMemoryFinance({
      budgets: [budget()],
      transactions: [
        tx({
          accountId: 'checking',
          amount: '900',
          categoryId: 'food',
          competenceDate: day('2026-01-10'),
        }),
        tx({
          accountId: 'checking',
          amount: '100',
          categoryId: 'food',
          competenceDate: day('2026-03-01'),
        }),
      ],
    });
    const rows = await env.budgets.history.execute('bud-food');
    expect(rows).toHaveLength(12);
    expect(rows[0]).toMatchObject({ key: '2026-03', current: true });
    expect(rows[0]?.usage.spent.toString()).toBe('100.00');
    expect(rows[2]).toMatchObject({ key: '2026-01' });
    expect(rows[2]?.usage.status).toBe('exceeded');
    expect(rows[11]?.key).toBe('2025-04');
    await expect(env.budgets.history.execute('nope')).rejects.toMatchObject({ code: 'not_found' });
  });
});
