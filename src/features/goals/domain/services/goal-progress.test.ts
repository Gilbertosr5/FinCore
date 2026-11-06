import { asIsoDate } from '@/lib/dates';
import { Money } from '@/lib/money';

import { computeGoalProgress } from './goal-progress';
import type { Goal, GoalContribution } from '../entities/goal';

const d = asIsoDate;

const goal: Goal = {
  id: 'g1',
  name: 'Viagem',
  description: null,
  category: 'travel',
  targetAmount: Money.of('12000'),
  startDate: d('2026-01-01'),
  targetDate: d('2026-12-31'),
  priority: 'high',
  accountId: null,
  status: 'active',
};

const contribution = (
  amount: string,
  date: string,
  type: GoalContribution['type'] = 'deposit',
  goalId = 'g1',
): GoalContribution => ({
  id: `${goalId}-${date}-${amount}`,
  goalId,
  date: d(date),
  amount: Money.of(amount),
  type,
});

describe('progresso de metas', () => {
  it('soma aportes, desconta retiradas e ignora outras metas e datas futuras', () => {
    const progress = computeGoalProgress(
      goal,
      [
        contribution('3000', '2026-02-01'),
        contribution('1000', '2026-03-01'),
        contribution('500', '2026-03-10', 'withdrawal'),
        contribution('9999', '2026-03-01', 'deposit', 'outra'),
        contribution('2000', '2026-07-01'),
      ],
      d('2026-06-30'),
    );
    expect(progress.accumulated.toString()).toBe('3500.00');
    expect(progress.remaining.toString()).toBe('8500.00');
    expect(progress.percent).toBeCloseTo(29.17, 2);
  });

  it('calcula o aporte mensal necessário até a data-alvo', () => {
    const progress = computeGoalProgress(
      goal,
      [contribution('3000', '2026-01-10')],
      d('2026-06-30'),
    );
    // 9000 restantes / 6 meses (jun → dez)
    expect(progress.monthsLeft).toBe(6);
    expect(progress.monthlyRequired?.toString()).toBe('1500.00');
    expect(progress.overdue).toBe(false);
  });

  it('meta atingida não exige aportes; prazo vencido é sinalizado', () => {
    const reached = computeGoalProgress(
      goal,
      [contribution('12500', '2026-02-01')],
      d('2026-03-01'),
    );
    expect(reached.percent).toBeGreaterThan(100);
    expect(reached.remaining.isZero()).toBe(true);
    expect(reached.monthlyRequired).toBeNull();

    const late = computeGoalProgress(goal, [], d('2027-01-15'));
    expect(late.overdue).toBe(true);
    expect(late.monthlyRequired?.toString()).toBe('12000.00');
  });

  it('sem data-alvo não há aporte necessário', () => {
    const progress = computeGoalProgress({ ...goal, targetDate: null }, [], d('2026-03-01'));
    expect(progress.monthlyRequired).toBeNull();
    expect(progress.monthsLeft).toBeNull();
  });
});
