import type { Goal, GoalContribution } from '@/features/goals/domain/entities/goal';
import type { Recurrence } from '@/features/transactions/domain/entities/recurrence';
import { asMonthKey } from '@/lib/dates';

import { buildCalendarEvents, summarizeEvents, type CalendarData } from './calendar-events';
import { buildMonthGrid, buildWeek } from './calendar-grid';
import {
  account,
  brl,
  card,
  cardPayment,
  d,
  purchase,
  transfer,
  tx,
} from '../../../../tests/helpers/finance-fixtures';

/* Hoje = 10/03/2026; intervalo = março de 2026. */
const today = d('2026-03-10');
const march = { start: d('2026-03-01'), end: d('2026-03-31') };
const visa = card({ id: 'visa', name: 'Visa', closingDay: 3, dueDay: 10, paymentAccountId: 'chk' });

const rent: Recurrence = {
  id: 'rec-rent',
  frequency: 'monthly',
  startDate: d('2026-01-25'),
  endDate: null,
  template: {
    kind: 'expense',
    description: 'Aluguel',
    amount: brl('1500'),
    accountId: 'chk',
    categoryId: null,
    tags: [],
    notes: null,
  },
  excludedDates: [],
};

const goal: Goal = {
  id: 'g1',
  name: 'Viagem',
  description: null,
  category: 'travel',
  targetAmount: brl('1000'),
  startDate: d('2026-01-01'),
  targetDate: d('2026-03-20'),
  priority: 'high',
  accountId: null,
  status: 'active',
};

function data(overrides: Partial<CalendarData> = {}): CalendarData {
  const contributions: GoalContribution[] = [
    {
      id: 'c1',
      goalId: 'g1',
      date: d('2026-02-01'),
      amount: brl('400'),
      type: 'deposit',
      transferId: null,
    },
  ];
  return {
    accounts: [account({ id: 'chk', name: 'Corrente' }), account({ id: 'sav', name: 'Poupança' })],
    transactions: [
      tx({
        id: 'paid',
        accountId: 'chk',
        amount: '100',
        competenceDate: d('2026-03-02'),
        description: 'Mercado',
      }),
      tx({
        id: 'late',
        accountId: 'chk',
        amount: '80',
        competenceDate: d('2026-03-05'),
        status: 'pending',
        description: 'Luz',
      }),
      tx({
        id: 'soon',
        kind: 'income',
        accountId: 'chk',
        amount: '3000',
        competenceDate: d('2026-03-15'),
        status: 'pending',
        description: 'Freela',
      }),
      tx({
        id: 'cancelled',
        accountId: 'chk',
        amount: '999',
        competenceDate: d('2026-03-12'),
        status: 'cancelled',
      }),
      ...transfer('chk', 'sav', '200', '2026-03-18'),
      cardPayment(visa, '2026-02', '50', '2026-02-10'),
    ],
    recurrences: [rent],
    cards: [visa],
    purchases: [purchase({ cardId: 'visa', totalAmount: '300', purchaseDate: '2026-02-20' })],
    goals: [goal],
    contributions,
    ...overrides,
  };
}

describe('eventos do calendário', () => {
  it('deriva contas, transferências, recorrências, faturas e metas do intervalo', () => {
    const events = buildCalendarEvents(data(), march, today);
    const byId = new Map(events.map((event) => [event.id, event]));

    expect(byId.get('tx:paid')).toMatchObject({ type: 'payable', status: 'done' });
    expect(byId.get('tx:late')).toMatchObject({ type: 'payable', status: 'overdue' });
    expect(byId.get('tx:soon')).toMatchObject({ type: 'receivable', status: 'pending' });
    expect(byId.has('tx:cancelled')).toBe(false);
    // Transferência uma única vez (perna de saída).
    expect(events.filter((event) => event.type === 'transfer')).toHaveLength(1);
    expect(events.find((event) => event.type === 'transfer')?.detail).toBe('Corrente → Poupança');
    // Recorrência ainda não gerada vira previsão.
    expect(byId.get('tx:rec-rent_2026-03-25')).toMatchObject({
      type: 'payable',
      status: 'forecast',
      title: 'Aluguel',
    });
    // Fatura de março (compra de 20/02 após o fechamento de 03/02) vence 10/03.
    expect(byId.get('invoice:visa:2026-03')).toMatchObject({
      date: '2026-03-10',
      status: 'pending',
    });
    expect(byId.get('invoice:visa:2026-03')?.amount?.toString()).toBe('300.00');
    // Pagamento de fatura não duplica como conta a pagar.
    expect(events.some((event) => event.title.startsWith('Pagamento'))).toBe(false);
    expect(byId.get('goal:g1')).toMatchObject({ date: '2026-03-20', status: 'pending' });
    expect(byId.get('goal:g1')?.amount?.toString()).toBe('600.00');
    // Ordenados por data.
    expect(events.map((event) => event.date)).toEqual(
      [...events.map((event) => event.date)].sort(),
    );
  });

  it('fatura paga aparece como realizada e metas atingidas como concluídas', () => {
    const events = buildCalendarEvents(
      data({
        transactions: [cardPayment(visa, '2026-03', '300', '2026-03-09')],
        contributions: [
          {
            id: 'c1',
            goalId: 'g1',
            date: d('2026-02-01'),
            amount: brl('1000'),
            type: 'deposit',
            transferId: null,
          },
        ],
      }),
      march,
      today,
    );
    expect(events.find((event) => event.type === 'invoice')?.status).toBe('done');
    expect(events.find((event) => event.type === 'goal')).toMatchObject({
      status: 'done',
      amount: null,
    });
  });

  it('resume a pagar, a receber e vencidos (sem realizados)', () => {
    const totals = summarizeEvents(buildCalendarEvents(data(), march, today));
    // Luz 80 + aluguel 1.500 + fatura 300.
    expect(totals.toPay.toString()).toBe('1880.00');
    expect(totals.toReceive.toString()).toBe('3000.00');
    expect(totals.overdueCount).toBe(1);
  });
});

describe('grade do calendário', () => {
  it('mês em semanas de domingo a sábado, cobrindo todos os dias', () => {
    const weeks = buildMonthGrid(asMonthKey('2026-03'));
    expect(weeks[0]?.[0]).toBe('2026-03-01'); // 01/03/2026 é domingo
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks.at(-1)).toContain('2026-03-31');
    const february = buildMonthGrid(asMonthKey('2026-02'));
    expect(february).toHaveLength(4); // fev/2026 começa no domingo e tem 28 dias
  });

  it('semana que contém a data', () => {
    expect(buildWeek(d('2026-03-11'))).toEqual([
      '2026-03-08',
      '2026-03-09',
      '2026-03-10',
      '2026-03-11',
      '2026-03-12',
      '2026-03-13',
      '2026-03-14',
    ]);
  });
});
