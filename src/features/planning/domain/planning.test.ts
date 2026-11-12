import type { Recurrence } from '@/features/transactions/domain/entities/recurrence';
import { Money } from '@/lib/money';

import { buildBalanceProjection, SCENARIO_PRESETS } from './balance-projection';
import type { PlanningData } from './flows';
import { buildAnnualPlan, buildMonthPlan } from './month-plan';
import { monthsToReach, requiredMonthlyContribution, simulateSavings } from './savings-simulation';
import {
  account,
  brl,
  card,
  d,
  m,
  purchase,
  transfer,
  tx,
} from '../../../../tests/helpers/finance-fixtures';

/*
 * Hoje = 10/03/2026. Conta corrente com R$ 1.000 em 01/01.
 * - Salário recorrente de R$ 5.000 (dia 5) — jan, fev e mar pagos.
 * - Alimentação variável: R$ 300 (jan) e R$ 600 (fev) → média R$ 450/mês.
 * - Despesa pendente de R$ 200 em 20/03.
 * - Compra de R$ 300 em 3x no cartão em 05/03 (competências 05/03, 05/04, 05/05).
 * Ruído que NÃO pode afetar: transferência, pagamento de fatura e cancelado.
 */
const today = d('2026-03-10');
const checking = account({ id: 'chk', initialBalance: brl('1000') });
const savings = account({ id: 'sav' });
const visa = card({ id: 'visa', closingDay: 3, dueDay: 10, paymentAccountId: 'chk' });

const salary: Recurrence = {
  id: 'rec-salary',
  frequency: 'monthly',
  startDate: d('2026-01-05'),
  endDate: null,
  template: {
    kind: 'income',
    description: 'Salário',
    amount: brl('5000'),
    accountId: 'chk',
    categoryId: 'salary',
    tags: [],
    notes: null,
  },
  excludedDates: [],
};

const salaryTx = (date: string) =>
  tx({
    id: `rec-salary_${date}`,
    kind: 'income',
    accountId: 'chk',
    amount: '5000',
    categoryId: 'salary',
    competenceDate: d(date),
    recurrenceId: 'rec-salary',
  });

function data(overrides: Partial<PlanningData> = {}): PlanningData {
  return {
    accounts: [checking, savings],
    transactions: [
      salaryTx('2026-01-05'),
      salaryTx('2026-02-05'),
      salaryTx('2026-03-05'),
      tx({ accountId: 'chk', amount: '300', categoryId: 'food', competenceDate: d('2026-01-12') }),
      tx({ accountId: 'chk', amount: '600', categoryId: 'food', competenceDate: d('2026-02-12') }),
      tx({
        accountId: 'chk',
        amount: '200',
        categoryId: 'home',
        competenceDate: d('2026-03-20'),
        status: 'pending',
      }),
      tx({
        accountId: 'chk',
        amount: '999',
        categoryId: 'food',
        competenceDate: d('2026-02-01'),
        status: 'cancelled',
      }),
      ...transfer('chk', 'sav', '400', '2026-02-20'),
    ],
    recurrences: [salary],
    cards: [visa],
    purchases: [
      purchase({
        cardId: 'visa',
        totalAmount: '300',
        purchaseDate: '2026-03-05',
        installmentCount: 3,
        categoryId: 'shopping',
      }),
    ],
    budgets: [],
    ...overrides,
  };
}

describe('projeção de saldo', () => {
  it('parte do saldo menos o cartão já devido e soma compromissos e estimativas', () => {
    const projection = buildBalanceProjection(data(), today, {
      months: 3,
      scenario: SCENARIO_PRESETS.base,
    });
    // 1000 − 300 − 600 + 3×5000 − 400 (transferência para a poupança) + 400 (entrada).
    expect(projection.accountsBalance.toString()).toBe('15100.00');
    // Dívida do cartão R$ 300, das quais R$ 200 são parcelas futuras.
    expect(projection.cardLiability.toString()).toBe('100.00');
    expect(projection.startingBalance.toString()).toBe('15000.00');
    expect(projection.averages.totalExpenses.toString()).toBe('450.00');

    const [march, april, may] = projection.months;
    // Março (restante): pendente 200 + 450 × 21/31 dias.
    expect(march?.scheduledExpenses.toString()).toBe('200.00');
    expect(march?.estimatedExpenses.toString()).toBe('304.84');
    expect(march?.cardInstallments.isZero()).toBe(true);
    expect(march?.balance.toString()).toBe('14495.16');
    // Abril: salário previsto (recorrência ainda não gerada) − parcela − média.
    expect(april?.scheduledIncome.toString()).toBe('5000.00');
    expect(april?.cardInstallments.toString()).toBe('100.00');
    expect(april?.result.toString()).toBe('4450.00');
    expect(may?.balance.toString()).toBe('23395.16');
    expect(projection.lowest).toMatchObject({ month: '2026-03' });
  });

  it('cenário conservador reduz receitas e aumenta só os gastos variáveis', () => {
    const projection = buildBalanceProjection(data(), today, {
      months: 2,
      scenario: SCENARIO_PRESETS.conservative,
    });
    const april = projection.months[1];
    expect(april?.income.toString()).toBe('4500.00');
    // Parcela do cartão (compromisso) não muda; média 450 × 1,1 = 495.
    expect(april?.expenses.toString()).toBe('595.00');
  });

  it('grande compra simulada entra parcelada a partir do mês escolhido', () => {
    const projection = buildBalanceProjection(data(), today, {
      months: 4,
      scenario: SCENARIO_PRESETS.base,
      purchases: [{ amount: brl('1000'), month: m('2026-04'), installments: 3 }],
    });
    expect(projection.months.map((row) => row.plannedPurchase.toString())).toEqual([
      '0.00',
      '333.34',
      '333.33',
      '333.33',
    ]);
  });

  it('limita o horizonte e funciona sem histórico', () => {
    const empty = buildBalanceProjection(
      { accounts: [], transactions: [], recurrences: [], cards: [], purchases: [], budgets: [] },
      today,
      { months: 999, scenario: SCENARIO_PRESETS.base },
    );
    expect(empty.months).toHaveLength(60);
    expect(empty.averages.months).toEqual([]);
    expect(empty.lowest.balance.isZero()).toBe(true);
  });
});

describe('plano anual e mensal', () => {
  it('separa realizado, agendado e estimado por mês', () => {
    const plan = buildAnnualPlan(data(), today, 2026);
    const [jan, , mar, apr] = plan.months;
    expect(jan).toMatchObject({ status: 'realized' });
    expect(jan?.income.total.toString()).toBe('5000.00');
    expect(jan?.expenses.total.toString()).toBe('300.00');
    expect(jan?.expenses.estimated.isZero()).toBe(true);

    expect(mar?.status).toBe('current');
    // Realizado em março: parcela de 05/03 (100); agendado: pendente de 20/03 (200).
    expect(mar?.expenses.realized.toString()).toBe('100.00');
    expect(mar?.expenses.scheduled.toString()).toBe('200.00');
    expect(mar?.expenses.estimated.toString()).toBe('304.84');

    expect(apr?.status).toBe('forecast');
    expect(apr?.income.scheduled.toString()).toBe('5000.00');
    expect(apr?.expenses.total.toString()).toBe('550.00');
    expect(plan.months).toHaveLength(12);
    // Transferência e cancelado não aparecem em nenhum mês.
    expect(plan.months[1]?.expenses.total.toString()).toBe('600.00');
  });

  it('detalha o mês por categoria com o orçamento mensal', () => {
    const plan = buildMonthPlan(
      data({
        budgets: [
          {
            id: 'b1',
            name: 'Alimentação',
            categoryId: 'food',
            amount: brl('500'),
            period: 'monthly',
            alertThresholdPercent: 80,
            active: true,
          },
        ],
      }),
      today,
      m('2026-04'),
    );
    const food = plan.expensesByCategory.find((line) => line.categoryId === 'food');
    expect(food?.estimated.toString()).toBe('450.00');
    expect(food?.budget?.toString()).toBe('500.00');
    expect(plan.budgeted?.toString()).toBe('500.00');
    expect(plan.incomeByCategory[0]).toMatchObject({ categoryId: 'salary' });
  });
});

describe('simulação de economia', () => {
  it('calcula juros compostos com aportes mensais', () => {
    const result = simulateSavings({
      initial: brl('1000'),
      monthly: brl('100'),
      monthlyRatePercent: 1,
      months: 12,
    });
    expect(result.finalAmount.toString()).toBe('2395.08');
    expect(result.totalContributed.toString()).toBe('2200.00');
    expect(result.earnings.toString()).toBe('195.08');
    expect(result.timeline).toHaveLength(12);
  });

  it('sem rendimento é soma simples', () => {
    const result = simulateSavings({
      initial: Money.zero(),
      monthly: brl('250'),
      monthlyRatePercent: 0,
      months: 4,
    });
    expect(result.finalAmount.toString()).toBe('1000.00');
  });

  it('aporte necessário e meses até o objetivo', () => {
    const monthly = requiredMonthlyContribution({
      target: brl('12000'),
      initial: Money.zero(),
      monthlyRatePercent: 0,
      months: 7,
    });
    // 12000 / 7 = 1714,2857… arredondado para cima.
    expect(monthly.toString()).toBe('1714.29');
    expect(
      requiredMonthlyContribution({
        target: brl('100'),
        initial: brl('200'),
        monthlyRatePercent: 0.5,
        months: 3,
      }).isZero(),
    ).toBe(true);
    expect(
      monthsToReach({
        target: brl('2395'),
        initial: brl('1000'),
        monthly: brl('100'),
        monthlyRatePercent: 1,
      }),
    ).toBe(12);
    expect(
      monthsToReach({
        target: brl('1000000'),
        initial: Money.zero(),
        monthly: brl('1'),
        monthlyRatePercent: 0,
      }),
    ).toBeNull();
  });

  it('rejeita prazos e taxas fora do intervalo', () => {
    expect(() =>
      simulateSavings({
        initial: Money.zero(),
        monthly: brl('1'),
        monthlyRatePercent: 1,
        months: 0,
      }),
    ).toThrow(RangeError);
    expect(() =>
      simulateSavings({
        initial: Money.zero(),
        monthly: brl('1'),
        monthlyRatePercent: 25,
        months: 1,
      }),
    ).toThrow(RangeError);
  });
});
