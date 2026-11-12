import { Money } from '@/lib/money';

import type { DashboardData } from './dashboard-data';
import { buildDashboardOverview } from './dashboard-overview';
import { resolvePeriod } from './period';
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

/*
 * Cenário conferível à mão (hoje = 20/03/2026, período = março):
 * - Conta corrente: saldo inicial 2.000; salário 5.000; aplicação 1.000 (fev);
 *   transferência 1.000 para a poupança; pagamento de fatura 300.
 * - Cartão (fecha dia 3, vence dia 10): compra 300 em jan (fatura de fev, paga);
 *   compra 600 em 3x em 01/03 (faturas mar/abr/mai).
 * - Despesas de conta em março: aluguel 1.500 (pendente, vence 25/03), conta
 *   200 vencida (15/03) e uma despesa cancelada de 999.
 */
const today = d('2026-03-20');
const checking = account({ id: 'checking', name: 'Corrente', initialBalance: brl('2000') });
const savings = account({ id: 'savings', name: 'Poupança', type: 'savings' });
const visa = card({ id: 'visa', name: 'Visa', paymentAccountId: 'checking', limit: brl('2000') });

const data: DashboardData = {
  accounts: [checking, savings],
  categories: [
    { id: 'salary', name: 'Salário', kind: 'income', nature: 'fixed' },
    { id: 'housing', name: 'Moradia', kind: 'expense', nature: 'fixed' },
    { id: 'leisure', name: 'Lazer', kind: 'expense', nature: 'variable' },
  ],
  transactions: [
    tx({
      kind: 'income',
      accountId: 'checking',
      amount: '5000',
      categoryId: 'salary',
      competenceDate: d('2026-03-05'),
    }),
    tx({
      accountId: 'checking',
      amount: '1500',
      categoryId: 'housing',
      status: 'pending',
      competenceDate: d('2026-03-25'),
    }),
    tx({
      description: 'Conta atrasada',
      accountId: 'checking',
      amount: '200',
      status: 'pending',
      competenceDate: d('2026-03-15'),
    }),
    tx({
      accountId: 'checking',
      amount: '999',
      categoryId: 'leisure',
      status: 'cancelled',
      competenceDate: d('2026-03-10'),
    }),
    tx({
      kind: 'investment',
      accountId: 'checking',
      amount: '1000',
      competenceDate: d('2026-02-01'),
      investment: { assetId: 'cdb', direction: 'application' },
    }),
    ...transfer('checking', 'savings', '1000', '2026-03-06'),
    cardPayment(visa, '2026-02', '300', '2026-03-10'),
  ],
  cards: [visa],
  purchases: [
    purchase({
      cardId: 'visa',
      totalAmount: '300',
      purchaseDate: '2026-01-20',
      categoryId: 'leisure',
    }),
    purchase({
      cardId: 'visa',
      totalAmount: '600',
      purchaseDate: '2026-03-01',
      installmentCount: 3,
      categoryId: 'leisure',
    }),
  ],
  budgets: [
    {
      id: 'b-housing',
      name: 'Moradia',
      categoryId: 'housing',
      amount: brl('1600'),
      period: 'monthly',
      alertThresholdPercent: 80,
      active: true,
    },
    {
      id: 'b-off',
      name: 'Inativo',
      categoryId: null,
      amount: brl('1'),
      period: 'monthly',
      alertThresholdPercent: 80,
      active: false,
    },
  ],
  goals: [],
  contributions: [],
  assets: [
    { id: 'cdb', name: 'CDB', ticker: null, assetClass: 'cdb', institution: 'Banco', notes: null },
  ],
  movements: [
    {
      id: 'm1',
      assetId: 'cdb',
      type: 'contribution',
      date: d('2026-02-01'),
      quantity: null,
      transactionId: null,
      amount: brl('1000'),
    },
  ],
  valuations: [
    { id: 'v1', assetId: 'cdb', date: d('2026-02-28'), value: brl('1050'), source: 'manual' },
  ],
};

const overview = buildDashboardOverview(
  data,
  resolvePeriod({ preset: 'current_month' }, today),
  today,
);

describe('dashboard — indicadores', () => {
  it('receitas e despesas por competência, sem transferências, pagamento de fatura nem cancelados', () => {
    expect(overview.totals.income.toString()).toBe('5000.00');
    // 1.500 aluguel + 200 conta vencida + 200 (1ª parcela do cartão)
    expect(overview.totals.expenses.toString()).toBe('1900.00');
    expect(overview.totals.expensesPending.toString()).toBe('1700.00');
    expect(overview.totals.result.toString()).toBe('3100.00');
    expect(overview.totals.savingsRate).toBe(62);
  });

  it('saldo das contas considera apenas lançamentos liquidados até hoje', () => {
    expect(overview.accountBalances.map((item) => item.balance.toString())).toEqual([
      '4700.00',
      '1000.00',
    ]);
    expect(overview.accountsBalance.toString()).toBe('5700.00');
  });

  it('patrimônio líquido = contas + investimentos − dívida do cartão', () => {
    expect(overview.portfolio.currentValue.toString()).toBe('1050.00');
    expect(overview.cardCommitment.toString()).toBe('600.00');
    expect(overview.netWorth.toString()).toBe('6150.00');
    expect(overview.cards[0]?.usage.percentUsed).toBe(30);
  });

  it('despesas por categoria somam o total e trazem participação', () => {
    expect(
      overview.expensesByCategory.map((slice) => [
        slice.label,
        slice.amount.toString(),
        slice.share,
      ]),
    ).toEqual([
      ['Moradia', '1500.00', 78.95],
      ['Sem categoria', '200.00', 10.53],
      ['Lazer', '200.00', 10.53],
    ]);
    expect(Money.sum(overview.expensesByCategory.map((slice) => slice.amount)).toString()).toBe(
      overview.totals.expenses.toString(),
    );
  });
});

describe('dashboard — listas e alertas', () => {
  it('próximas contas: vencidas primeiro, depois as que vencem em até 30 dias', () => {
    expect(
      overview.upcomingBills.map((bill) => [bill.transaction.amount.toString(), bill.daysUntilDue]),
    ).toEqual([
      ['200.00', -5],
      ['1500.00', 5],
    ]);
  });

  it('faturas: março vencida (sem pagamento) e abril aberta', () => {
    expect(
      overview.upcomingInvoices.map(({ invoice }) => [
        invoice.month,
        invoice.status,
        invoice.outstanding.toString(),
      ]),
    ).toEqual([
      ['2026-03', 'overdue', '200.00'],
      ['2026-04', 'open', '200.00'],
    ]);
  });

  it('orçamentos ativos com uso calculado; inativos ignorados', () => {
    expect(overview.budgets).toHaveLength(1);
    expect(overview.budgets[0]?.status).toBe('warning');
  });

  it('alertas críticos vêm primeiro', () => {
    const ids = overview.alerts.map((alert) => alert.id);
    expect(ids).toContain('overdue-bills');
    expect(ids).toContain('invoice-overdue-visa-2026-03');
    expect(ids).toContain('budget-warning-b-housing');
    expect(overview.alerts[0]?.severity).toBe('critical');
    expect(overview.alerts.at(-1)?.severity).not.toBe('critical');
  });

  it('movimentações recentes: transferência aparece uma vez; pendentes e canceladas não', () => {
    const descriptions = overview.recentActivity.map((item) => item.kindLabel);
    expect(descriptions.filter((label) => label === 'Transferência')).toHaveLength(1);
    expect(overview.recentActivity.some((item) => item.status !== 'paid')).toBe(false);
    expect(overview.recentActivity[0]?.date).toBe('2026-03-10');
  });

  it('série mensal termina no mês atual com o mesmo patrimônio do indicador', () => {
    const last = overview.monthly.at(-1);
    expect(overview.monthly).toHaveLength(6);
    expect(last?.month).toBe('2026-03');
    expect(last?.netWorth.toString()).toBe(overview.netWorth.toString());
  });
});
