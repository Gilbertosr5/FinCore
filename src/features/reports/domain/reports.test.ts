import type { Budget } from '@/features/budgets/domain/entities/budget';
import type { Category } from '@/features/transactions/domain/entities/category';
import type { Recurrence } from '@/features/transactions/domain/entities/recurrence';

import { collectEntries, type ReportData, type ReportFilters } from './report-data';
import type { ReportCell, ReportTable } from './report-table';
import { buildReport, computeIndicators } from './reports';
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
 * Hoje = 10/03/2026. Período = jan–mar/2026.
 * Corrente R$ 1.000 (01/01); poupança R$ 0.
 * Jan: salário 5.000; aluguel (fixa) 1.500; mercado (variável) 500.
 * Fev: salário 5.000; aluguel 1.500; compra no cartão 600 em 3x (comp. fev, mar, abr).
 * Mar: salário 5.000 pendente (15/03); transferência 1.000 para a poupança;
 *      pagamento de fatura 200; despesa cancelada 999.
 */
const today = d('2026-03-10');
const categories: Category[] = [
  { id: 'salary', name: 'Salário', kind: 'income', nature: 'fixed' },
  { id: 'rent', name: 'Moradia', kind: 'expense', nature: 'fixed' },
  { id: 'food', name: 'Alimentação', kind: 'expense', nature: 'variable' },
];
const visa = card({ id: 'visa', closingDay: 3, dueDay: 10, paymentAccountId: 'chk' });

function data(overrides: Partial<ReportData> = {}): ReportData {
  return {
    accounts: [
      account({ id: 'chk', name: 'Corrente', initialBalance: brl('1000') }),
      account({ id: 'sav', name: 'Poupança' }),
    ],
    categories,
    transactions: [
      tx({
        kind: 'income',
        accountId: 'chk',
        amount: '5000',
        categoryId: 'salary',
        competenceDate: d('2026-01-05'),
      }),
      tx({ accountId: 'chk', amount: '1500', categoryId: 'rent', competenceDate: d('2026-01-10') }),
      tx({ accountId: 'chk', amount: '500', categoryId: 'food', competenceDate: d('2026-01-20') }),
      tx({
        kind: 'income',
        accountId: 'chk',
        amount: '5000',
        categoryId: 'salary',
        competenceDate: d('2026-02-05'),
      }),
      tx({ accountId: 'chk', amount: '1500', categoryId: 'rent', competenceDate: d('2026-02-10') }),
      tx({
        kind: 'income',
        accountId: 'chk',
        amount: '5000',
        categoryId: 'salary',
        competenceDate: d('2026-03-15'),
        status: 'pending',
      }),
      ...transfer('chk', 'sav', '1000', '2026-03-02'),
      cardPayment(visa, '2026-03', '200', '2026-03-09'),
      tx({
        accountId: 'chk',
        amount: '999',
        categoryId: 'food',
        competenceDate: d('2026-03-03'),
        status: 'cancelled',
      }),
    ],
    recurrences: [],
    cards: [visa],
    purchases: [
      purchase({
        cardId: 'visa',
        totalAmount: '600',
        purchaseDate: '2026-02-10',
        installmentCount: 3,
        categoryId: 'food',
      }),
    ],
    budgets: [],
    assets: [],
    movements: [],
    valuations: [],
    ...overrides,
  };
}

const quarter: ReportFilters = { start: d('2026-01-01'), end: d('2026-03-31'), accountId: null };

const moneyOf = (cell: ReportCell | undefined) =>
  cell?.kind === 'money'
    ? cell.value.toString()
    : cell?.kind === 'percent'
      ? cell.value
      : cell?.value;
const column = (table: ReportTable, key: string) =>
  table.rows.map((row) => moneyOf(row.cells[key]));

describe('entradas dos relatórios', () => {
  it('competência: inclui parcelas de cartão; ignora transferências, faturas e cancelados', () => {
    const entries = collectEntries(data(), quarter);
    expect(entries.filter((entry) => entry.type === 'income')).toHaveLength(3);
    const expenses = entries.filter((entry) => entry.type === 'expense');
    // aluguel ×2, mercado, parcelas de fev e mar (abr fica fora do período).
    expect(expenses.map((entry) => entry.amount.toString()).sort()).toEqual([
      '1500.00',
      '1500.00',
      '200.00',
      '200.00',
      '500.00',
    ]);
  });

  it('filtro de conta deixa as parcelas de cartão de fora', () => {
    const entries = collectEntries(data(), { ...quarter, accountId: 'chk' });
    expect(entries.some((entry) => entry.accountId === null)).toBe(false);
  });
});

describe('indicadores', () => {
  it('taxa de poupança, comprometimento da renda e média mensal', () => {
    const k = computeIndicators(data(), quarter, today);
    expect(k.income.toString()).toBe('15000.00');
    expect(k.expenses.toString()).toBe('3900.00');
    expect(k.result.toString()).toBe('11100.00');
    expect(k.savingsRate).toBe(74);
    expect(k.fixedExpenses.toString()).toBe('3000.00');
    expect(k.variableExpenses.toString()).toBe('900.00');
    expect(k.commitmentRate).toBe(20);
    expect(k.averageMonthlyExpenses.toString()).toBe('1300.00');
    expect(k.asOf).toBe('2026-03-10');
    // Contas: 1.000 + 10.000 − 3.500 − 200 (fatura) = 7.300; cartão: 600 − 200 = 400.
    expect(k.netWorth.toString()).toBe('6900.00');
  });
});

describe('relatórios', () => {
  it('por mês, com totais que batem com os indicadores', () => {
    const table = buildReport('monthly', data(), quarter, today);
    expect(column(table, 'income')).toEqual(['5000.00', '5000.00', '5000.00']);
    expect(column(table, 'expenses')).toEqual(['2000.00', '1700.00', '200.00']);
    expect(moneyOf(table.totals?.cells.result)).toBe('11100.00');
  });

  it('despesas por categoria: ordenadas, com natureza e participação', () => {
    const table = buildReport('expenses_by_category', data(), quarter, today);
    expect(table.rows.map((row) => moneyOf(row.cells.category))).toEqual([
      'Moradia',
      'Alimentação',
    ]);
    expect(table.rows.map((row) => moneyOf(row.cells.nature))).toEqual(['Fixa', 'Variável']);
    expect(column(table, 'value')).toEqual(['3000.00', '900.00']);
    expect(moneyOf(table.totals?.cells.value)).toBe('3900.00');
  });

  it('por conta: entradas e saídas liquidadas, inclusive transferências', () => {
    const table = buildReport('by_account', data(), quarter, today);
    const [checking, savings] = table.rows;
    expect(moneyOf(checking?.cells.inflow)).toBe('10000.00');
    // 1.500 + 500 + 1.500 + 1.000 (transferência) + 200 (fatura).
    expect(moneyOf(checking?.cells.outflow)).toBe('4700.00');
    expect(moneyOf(savings?.cells.inflow)).toBe('1000.00');
    expect(moneyOf(table.totals?.cells.balance)).toBe('7300.00');
  });

  it('fluxo de caixa: sem transferências internas; com conta filtrada, elas contam', () => {
    const all = buildReport('cash_flow', data(), quarter, today);
    expect(column(all, 'outflow')).toEqual(['2000.00', '1500.00', '200.00']);
    const filtered = buildReport('cash_flow', data(), { ...quarter, accountId: 'chk' }, today);
    expect(column(filtered, 'outflow')).toEqual(['2000.00', '1500.00', '1200.00']);
    expect(moneyOf(filtered.rows[2]?.cells.balance)).toBe('6300.00');
  });

  it('orçamento × realizado usa as mesmas regras dos orçamentos', () => {
    const budget: Budget = {
      id: 'b1',
      name: 'Alimentação',
      categoryId: 'food',
      amount: brl('400'),
      period: 'monthly',
      alertThresholdPercent: 80,
      active: true,
    };
    const table = buildReport('budget_vs_actual', data({ budgets: [budget] }), quarter, today);
    expect(column(table, 'actual')).toEqual(['500.00', '200.00', '200.00']);
    expect(table.rows.map((row) => moneyOf(row.cells.status))).toEqual([
      'Excedido',
      'Dentro do limite',
      'Dentro do limite',
    ]);
  });

  it('evolução patrimonial desconta a dívida do cartão', () => {
    const table = buildReport('net_worth', data(), quarter, today);
    expect(column(table, 'cards')).toEqual(['0.00', '600.00', '400.00']);
    expect(column(table, 'netWorth')).toEqual(['4000.00', '6900.00', '6900.00']);
  });

  it('histórico de economia acumula o resultado', () => {
    const table = buildReport('savings_history', data(), quarter, today);
    expect(column(table, 'accumulated')).toEqual(['3000.00', '6300.00', '11100.00']);
  });

  it('compromissos futuros: pendentes, recorrências previstas e parcelas', () => {
    const rent: Recurrence = {
      id: 'rec',
      frequency: 'monthly',
      startDate: d('2026-04-10'),
      endDate: null,
      template: {
        kind: 'expense',
        description: 'Aluguel',
        amount: brl('1500'),
        accountId: 'chk',
        categoryId: 'rent',
        tags: [],
        notes: null,
      },
      excludedDates: [],
    };
    const table = buildReport('future_commitments', data({ recurrences: [rent] }), quarter, today);
    expect(table.rows).toHaveLength(12);
    expect(column(table, 'cards').slice(0, 3)).toEqual(['0.00', '200.00', '0.00']);
    expect(column(table, 'bills').slice(0, 2)).toEqual(['0.00', '1500.00']);
  });

  it('resumo exibe os indicadores em linhas', () => {
    const table = buildReport('summary', data(), quarter, today);
    expect(table.rows[3]?.cells.value).toEqual({ kind: 'percent', value: 74 });
    expect(table.notes.length).toBeGreaterThan(0);
  });
});
