import { asIsoDate } from '@/lib/dates';
import { Money } from '@/lib/money';

import { computeBudgetUsage, getBudgetPeriod } from './budget-usage';
import type { Budget } from '../entities/budget';

const food: Budget = {
  id: 'b1',
  name: 'Alimentação',
  categoryId: 'food',
  amount: Money.of('800'),
  period: 'monthly',
  alertThresholdPercent: 80,
  active: true,
};

describe('uso do orçamento', () => {
  it('fica ok abaixo do limiar', () => {
    const usage = computeBudgetUsage(food, Money.of('639.99'));
    expect(usage.status).toBe('ok');
    expect(usage.remaining.toString()).toBe('160.01');
  });

  it('alerta ao atingir 80% (exemplo: R$ 640 de R$ 800)', () => {
    const usage = computeBudgetUsage(food, Money.of('640'));
    expect(usage.status).toBe('warning');
    expect(usage.percent).toBe(80);
  });

  it('exatamente 100% ainda não é excedido', () => {
    expect(computeBudgetUsage(food, Money.of('800')).status).toBe('warning');
  });

  it('acima de 100% indica o excedente', () => {
    const usage = computeBudgetUsage(food, Money.of('950.50'));
    expect(usage.status).toBe('exceeded');
    expect(usage.excess.toString()).toBe('150.50');
    expect(usage.remaining.isZero()).toBe(true);
  });

  it('limite zero: percentual indefinido, qualquer gasto excede', () => {
    const usage = computeBudgetUsage({ ...food, amount: Money.zero() }, Money.of('1'));
    expect(usage.percent).toBeNull();
    expect(usage.status).toBe('exceeded');
  });

  it('período mensal e anual', () => {
    const today = asIsoDate('2024-02-15');
    expect(getBudgetPeriod(food, today)).toEqual({ start: '2024-02-01', end: '2024-02-29' });
    expect(getBudgetPeriod({ period: 'yearly' }, today)).toEqual({
      start: '2024-01-01',
      end: '2024-12-31',
    });
  });
});
