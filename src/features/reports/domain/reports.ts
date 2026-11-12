import {
  computeAccountBalance,
  computeAccountBalances,
  sumBalances,
} from '@/features/accounts/domain/services/account-balance';
import {
  computeBudgetUsage,
  getBudgetPeriod,
  sumBudgetSpending,
} from '@/features/budgets/domain/services/budget-usage';
import { computeCardDebt } from '@/features/credit-cards/domain/services/invoices';
import { computePortfolio } from '@/features/investments/domain/services/portfolio';
import { collectFlows } from '@/features/planning/domain/flows';
import type { Transaction } from '@/features/transactions/domain/entities/transaction';
import { getAccountEffect } from '@/features/transactions/domain/rules/transaction-effects';
import {
  addMonthsToKey,
  formatDateBR,
  formatMonthLong,
  monthEnd,
  monthStart,
  toMonthKey,
  type IsoDate,
  type MonthKey,
} from '@/lib/dates';
import { Money } from '@/lib/money';

import {
  collectEntries,
  monthsOf,
  type ReportData,
  type ReportEntry,
  type ReportFilters,
} from './report-data';
import {
  leftColumn,
  money,
  percent,
  rightColumn,
  text,
  type ReportRow,
  type ReportTable,
} from './report-table';

export type ReportKind =
  | 'summary'
  | 'monthly'
  | 'expenses_by_category'
  | 'income_by_category'
  | 'by_account'
  | 'cash_flow'
  | 'budget_vs_actual'
  | 'net_worth'
  | 'investments'
  | 'savings_history'
  | 'future_commitments';

export const REPORT_KINDS: readonly ReportKind[] = [
  'summary',
  'monthly',
  'expenses_by_category',
  'income_by_category',
  'by_account',
  'cash_flow',
  'budget_vs_actual',
  'net_worth',
  'investments',
  'savings_history',
  'future_commitments',
];

export const REPORT_INFO: Record<ReportKind, { title: string; description: string; slug: string }> =
  {
    summary: {
      title: 'Resumo e indicadores',
      description: 'Receitas, despesas, taxa de poupança, comprometimento da renda e patrimônio.',
      slug: 'resumo',
    },
    monthly: {
      title: 'Receitas e despesas por mês',
      description: 'Evolução mensal por competência.',
      slug: 'receitas-despesas-mensal',
    },
    expenses_by_category: {
      title: 'Despesas por categoria',
      description: 'Inclui parcelas de cartão; fixas × variáveis pela natureza da categoria.',
      slug: 'despesas-por-categoria',
    },
    income_by_category: {
      title: 'Receitas por categoria',
      description: 'Receitas por competência no período.',
      slug: 'receitas-por-categoria',
    },
    by_account: {
      title: 'Movimentação por conta',
      description: 'Entradas e saídas liquidadas (pela data de pagamento) e saldo no fim.',
      slug: 'por-conta',
    },
    cash_flow: {
      title: 'Fluxo de caixa',
      description: 'Entradas e saídas efetivas das contas, mês a mês.',
      slug: 'fluxo-de-caixa',
    },
    budget_vs_actual: {
      title: 'Orçamento × realizado',
      description: 'Orçamentos mensais ativos, mês a mês.',
      slug: 'orcamento-realizado',
    },
    net_worth: {
      title: 'Evolução patrimonial',
      description: 'Contas + investimentos − dívida de cartões no fim de cada mês.',
      slug: 'evolucao-patrimonial',
    },
    investments: {
      title: 'Evolução dos investimentos',
      description: 'Valor da carteira × valor aplicado no fim de cada mês.',
      slug: 'evolucao-investimentos',
    },
    savings_history: {
      title: 'Histórico de economia',
      description: 'Quanto sobrou de cada mês e o acumulado.',
      slug: 'historico-economia',
    },
    future_commitments: {
      title: 'Compromissos futuros',
      description: 'Contas pendentes, recorrências e parcelas de cartão dos próximos 12 meses.',
      slug: 'compromissos-futuros',
    },
  };

const sum = (entries: readonly ReportEntry[], type: ReportEntry['type']) =>
  Money.sum(entries.filter((entry) => entry.type === type).map((entry) => entry.amount));

const rate = (part: Money, whole: Money): number | null =>
  whole.isPositive() ? (part.percentageOf(whole)?.toNumber() ?? null) : null;

const monthLabel = (month: MonthKey) => {
  const label = formatMonthLong(month);
  return label.charAt(0).toUpperCase() + label.slice(1);
};

/** Último dia útil para posições: fim do período ou hoje, o que vier antes. */
const asOfDate = (date: IsoDate, today: IsoDate) => (date < today ? date : today);

function netWorthAt(data: ReportData, date: IsoDate) {
  const accounts = sumBalances(computeAccountBalances(data.accounts, data.transactions, date));
  const investments = computePortfolio(data.assets, data.movements, data.valuations, date);
  const cardDebt = Money.sum(
    data.cards.map((card) => computeCardDebt(card, data.purchases, data.transactions, date)),
  );
  return {
    accounts,
    investments: investments.currentValue,
    invested: investments.netInvested,
    cardDebt,
    netWorth: accounts.add(investments.currentValue).subtract(cardDebt),
  };
}

function categoryName(data: ReportData, id: string | null): string {
  if (id === null) return 'Sem categoria';
  return data.categories.find((item) => item.id === id)?.name ?? 'Categoria removida';
}

function isFixed(data: ReportData, id: string | null): boolean {
  return data.categories.find((item) => item.id === id)?.nature === 'fixed';
}

function accountNote(data: ReportData, filters: ReportFilters): string[] {
  if (filters.accountId === null) return [];
  const name = data.accounts.find((item) => item.id === filters.accountId)?.name ?? 'conta';
  return [
    `Filtrado pela conta ${name}: parcelas de cartão não pertencem a uma conta e ficam de fora.`,
  ];
}

export interface ReportIndicators {
  income: Money;
  expenses: Money;
  result: Money;
  savingsRate: number | null;
  fixedExpenses: Money;
  variableExpenses: Money;
  /** Despesas fixas ÷ receitas. */
  commitmentRate: number | null;
  averageMonthlyExpenses: Money;
  months: number;
  asOf: IsoDate;
  netWorth: Money;
  invested: Money;
}

export function computeIndicators(
  data: ReportData,
  filters: ReportFilters,
  today: IsoDate,
): ReportIndicators {
  const entries = collectEntries(data, filters);
  const income = sum(entries, 'income');
  const expenses = sum(entries, 'expense');
  const fixedExpenses = Money.sum(
    entries
      .filter((entry) => entry.type === 'expense' && isFixed(data, entry.categoryId))
      .map((entry) => entry.amount),
  );
  const months = monthsOf(filters).length;
  const asOf = asOfDate(filters.end, today);
  const position = netWorthAt(data, asOf);
  return {
    income,
    expenses,
    result: income.subtract(expenses),
    savingsRate: rate(income.subtract(expenses), income),
    fixedExpenses,
    variableExpenses: expenses.subtract(fixedExpenses),
    commitmentRate: rate(fixedExpenses, income),
    averageMonthlyExpenses: expenses.divide(Math.max(months, 1)),
    months,
    asOf,
    netWorth: position.netWorth,
    invested: position.investments,
  };
}

function summaryReport(data: ReportData, filters: ReportFilters, today: IsoDate): ReportTable {
  const k = computeIndicators(data, filters, today);
  const rows: [string, ReturnType<typeof money>][] = [
    ['Receitas', money(k.income)],
    ['Despesas', money(k.expenses)],
    ['Resultado (receitas − despesas)', money(k.result)],
    ['Taxa de poupança', percent(k.savingsRate)],
    ['Despesas fixas', money(k.fixedExpenses)],
    ['Despesas variáveis', money(k.variableExpenses)],
    ['Comprometimento da renda (fixas ÷ receitas)', percent(k.commitmentRate)],
    [
      `Média mensal de despesas (${k.months} ${k.months === 1 ? 'mês' : 'meses'})`,
      money(k.averageMonthlyExpenses),
    ],
    [`Patrimônio líquido em ${formatDateBR(k.asOf)}`, money(k.netWorth)],
    [`Patrimônio investido em ${formatDateBR(k.asOf)}`, money(k.invested)],
  ];
  return {
    columns: [leftColumn('indicator', 'Indicador'), rightColumn('value', 'Valor')],
    rows: rows.map(([label, value], index) => ({
      id: String(index),
      cells: { indicator: text(label), value },
    })),
    totals: null,
    notes: [
      'Receitas e despesas por competência; transferências, pagamentos de fatura e aplicações não entram.',
      'Patrimônio = contas + investimentos − dívida de cartões (não considera o filtro de conta).',
      ...accountNote(data, filters),
    ],
  };
}

function monthlyReport(data: ReportData, filters: ReportFilters): ReportTable {
  const entries = collectEntries(data, filters);
  const rows = monthsOf(filters).map((month): ReportRow => {
    const own = entries.filter((entry) => toMonthKey(entry.date) === month);
    const income = sum(own, 'income');
    const expenses = sum(own, 'expense');
    return {
      id: month,
      cells: {
        month: text(monthLabel(month)),
        income: money(income),
        expenses: money(expenses),
        result: money(income.subtract(expenses)),
        rate: percent(rate(income.subtract(expenses), income)),
      },
    };
  });
  const income = sum(entries, 'income');
  const expenses = sum(entries, 'expense');
  return {
    columns: [
      leftColumn('month', 'Mês'),
      rightColumn('income', 'Receitas'),
      rightColumn('expenses', 'Despesas'),
      rightColumn('result', 'Resultado'),
      rightColumn('rate', 'Taxa de poupança'),
    ],
    rows,
    totals: {
      id: 'total',
      cells: {
        month: text('Total'),
        income: money(income),
        expenses: money(expenses),
        result: money(income.subtract(expenses)),
        rate: percent(rate(income.subtract(expenses), income)),
      },
    },
    notes: accountNote(data, filters),
  };
}

function byCategoryReport(
  data: ReportData,
  filters: ReportFilters,
  type: ReportEntry['type'],
): ReportTable {
  const entries = collectEntries(data, filters).filter((entry) => entry.type === type);
  const total = Money.sum(entries.map((entry) => entry.amount));
  const totals = new Map<string | null, Money>();
  for (const entry of entries) {
    totals.set(entry.categoryId, (totals.get(entry.categoryId) ?? Money.zero()).add(entry.amount));
  }
  const expense = type === 'expense';
  const rows = [...totals.entries()]
    .sort((a, b) => b[1].compare(a[1]))
    .map(([categoryId, value]): ReportRow => ({
      id: categoryId ?? 'none',
      cells: {
        category: text(categoryName(data, categoryId)),
        ...(expense ? { nature: text(isFixed(data, categoryId) ? 'Fixa' : 'Variável') } : {}),
        value: money(value),
        share: percent(rate(value, total)),
      },
    }));
  return {
    columns: [
      leftColumn('category', 'Categoria'),
      ...(expense ? [leftColumn('nature', 'Natureza')] : []),
      rightColumn('value', 'Valor'),
      rightColumn('share', '% do total'),
    ],
    rows,
    totals: {
      id: 'total',
      cells: {
        category: text('Total'),
        ...(expense ? { nature: text('') } : {}),
        value: money(total),
        share: percent(total.isPositive() ? 100 : null),
      },
    },
    notes: accountNote(data, filters),
  };
}

/** Efeito liquidado no período (pela data de pagamento). */
function settledIn(tx: Transaction, start: IsoDate, end: IsoDate): boolean {
  return tx.status === 'paid' && tx.paidDate !== null && tx.paidDate >= start && tx.paidDate <= end;
}

function byAccountReport(data: ReportData, filters: ReportFilters, today: IsoDate): ReportTable {
  const asOf = asOfDate(filters.end, today);
  const accounts = data.accounts.filter(
    (account) => filters.accountId === null || account.id === filters.accountId,
  );
  const rows = accounts
    .map((account) => {
      const effects = data.transactions
        .filter((tx) => tx.accountId === account.id && settledIn(tx, filters.start, filters.end))
        .map((tx) => getAccountEffect(tx, filters.end));
      const inflow = Money.sum(effects.filter((value) => value.isPositive()));
      const outflow = Money.sum(effects.filter((value) => value.isNegative())).abs();
      return {
        account,
        inflow,
        outflow,
        balance: computeAccountBalance(account, data.transactions, asOf),
      };
    })
    .filter((item) => !item.account.archived || !item.inflow.isZero() || !item.outflow.isZero())
    .map((item): ReportRow => ({
      id: item.account.id,
      cells: {
        account: text(
          item.account.archived ? `${item.account.name} (arquivada)` : item.account.name,
        ),
        inflow: money(item.inflow),
        outflow: money(item.outflow),
        change: money(item.inflow.subtract(item.outflow)),
        balance: money(item.balance),
      },
    }));
  const cell = (key: string) =>
    Money.sum(
      rows.map((row) => {
        const value = row.cells[key];
        return value?.kind === 'money' ? value.value : Money.zero();
      }),
    );
  return {
    columns: [
      leftColumn('account', 'Conta'),
      rightColumn('inflow', 'Entradas'),
      rightColumn('outflow', 'Saídas'),
      rightColumn('change', 'Variação'),
      rightColumn('balance', `Saldo em ${formatDateBR(asOf)}`),
    ],
    rows,
    totals: {
      id: 'total',
      cells: {
        account: text('Total'),
        inflow: money(cell('inflow')),
        outflow: money(cell('outflow')),
        change: money(cell('change')),
        balance: money(cell('balance')),
      },
    },
    notes: ['Inclui transferências, pagamentos de fatura e aplicações (movimentam as contas).'],
  };
}

/** Meses do período até o mês atual (relatórios de posição não têm futuro). */
function pastMonths(filters: ReportFilters, today: IsoDate): MonthKey[] {
  const current = toMonthKey(today);
  return monthsOf(filters).filter((month) => month <= current);
}

function cashFlowReport(data: ReportData, filters: ReportFilters, today: IsoDate): ReportTable {
  const scope = data.accounts.filter(
    (account) => filters.accountId === null || account.id === filters.accountId,
  );
  const ids = new Set(scope.map((account) => account.id));
  const allAccounts = filters.accountId === null;
  let totalIn = Money.zero();
  let totalOut = Money.zero();
  const rows = pastMonths(filters, today).map((month): ReportRow => {
    const start = monthStart(month) < filters.start ? filters.start : monthStart(month);
    const end = monthEnd(month) > filters.end ? filters.end : monthEnd(month);
    const effects = data.transactions
      .filter(
        (tx) =>
          ids.has(tx.accountId) &&
          settledIn(tx, start, end) &&
          // Com todas as contas, transferências internas se anulam: ficam de fora.
          !(allAccounts && tx.kind === 'transfer'),
      )
      .map((tx) => getAccountEffect(tx, end));
    const inflow = Money.sum(effects.filter((value) => value.isPositive()));
    const outflow = Money.sum(effects.filter((value) => value.isNegative())).abs();
    totalIn = totalIn.add(inflow);
    totalOut = totalOut.add(outflow);
    const balance = sumBalances(
      computeAccountBalances(scope, data.transactions, asOfDate(end, today)),
    );
    return {
      id: month,
      cells: {
        month: text(monthLabel(month)),
        inflow: money(inflow),
        outflow: money(outflow),
        net: money(inflow.subtract(outflow)),
        balance: money(balance),
      },
    };
  });
  return {
    columns: [
      leftColumn('month', 'Mês'),
      rightColumn('inflow', 'Entradas'),
      rightColumn('outflow', 'Saídas'),
      rightColumn('net', 'Saldo do mês'),
      rightColumn('balance', 'Saldo das contas no fim'),
    ],
    rows,
    totals: {
      id: 'total',
      cells: {
        month: text('Total'),
        inflow: money(totalIn),
        outflow: money(totalOut),
        net: money(totalIn.subtract(totalOut)),
        balance: text(''),
      },
    },
    notes: [
      'Movimentos liquidados pela data de pagamento; meses futuros não aparecem.',
      allAccounts
        ? 'Transferências entre suas contas não entram; pagamentos de fatura e aplicações são saídas.'
        : 'Com uma conta filtrada, transferências contam como entrada/saída da conta.',
    ],
  };
}

function budgetReport(data: ReportData, filters: ReportFilters): ReportTable {
  const months = monthsOf(filters);
  const first = months[0];
  const last = months.at(-1);
  const entries =
    first && last
      ? collectEntries(data, { start: monthStart(first), end: monthEnd(last), accountId: null })
      : [];
  const budgets = data.budgets.filter((budget) => budget.active && budget.period === 'monthly');
  const STATUS = { ok: 'Dentro do limite', warning: 'Atenção', exceeded: 'Excedido' } as const;
  const rows = months.flatMap((month) =>
    budgets.map((budget): ReportRow => {
      const usage = computeBudgetUsage(
        budget,
        sumBudgetSpending(budget, entries, getBudgetPeriod(budget, monthStart(month))),
      );
      return {
        id: `${month}:${budget.id}`,
        cells: {
          month: text(monthLabel(month)),
          budget: text(budget.name),
          planned: money(budget.amount),
          actual: money(usage.spent),
          percent: percent(usage.percent),
          status: text(STATUS[usage.status]),
        },
      };
    }),
  );
  return {
    columns: [
      leftColumn('month', 'Mês'),
      leftColumn('budget', 'Orçamento'),
      rightColumn('planned', 'Planejado'),
      rightColumn('actual', 'Realizado'),
      rightColumn('percent', '% usado'),
      leftColumn('status', 'Situação'),
    ],
    rows,
    totals: null,
    notes: [
      'Orçamentos mensais ativos, com o limite atual; mês inteiro de cada competência.',
      'Não considera o filtro de conta (orçamentos valem para todas as contas e cartões).',
    ],
  };
}

function netWorthReport(data: ReportData, filters: ReportFilters, today: IsoDate): ReportTable {
  return {
    columns: [
      leftColumn('month', 'Mês'),
      rightColumn('accounts', 'Contas'),
      rightColumn('investments', 'Investimentos'),
      rightColumn('cards', 'Dívida de cartões'),
      rightColumn('netWorth', 'Patrimônio líquido'),
    ],
    rows: pastMonths(filters, today).map((month): ReportRow => {
      const position = netWorthAt(data, asOfDate(monthEnd(month), today));
      return {
        id: month,
        cells: {
          month: text(monthLabel(month)),
          accounts: money(position.accounts),
          investments: money(position.investments),
          cards: money(position.cardDebt),
          netWorth: money(position.netWorth),
        },
      };
    }),
    totals: null,
    notes: [
      'Posição no fim de cada mês (ou hoje, no mês atual). Investimentos pelo valor atual informado ou estimado.',
    ],
  };
}

function investmentsReport(data: ReportData, filters: ReportFilters, today: IsoDate): ReportTable {
  return {
    columns: [
      leftColumn('month', 'Mês'),
      rightColumn('value', 'Valor da carteira'),
      rightColumn('invested', 'Aplicado líquido'),
      rightColumn('result', 'Diferença'),
    ],
    rows: pastMonths(filters, today).map((month): ReportRow => {
      const position = netWorthAt(data, asOfDate(monthEnd(month), today));
      return {
        id: month,
        cells: {
          month: text(monthLabel(month)),
          value: money(position.investments),
          invested: money(position.invested),
          result: money(position.investments.subtract(position.invested)),
        },
      };
    }),
    totals: null,
    notes: [
      'Valores manuais ou estimados (sem cotações automáticas). Diferença não é rentabilidade ponderada no tempo.',
    ],
  };
}

function savingsReport(data: ReportData, filters: ReportFilters): ReportTable {
  const entries = collectEntries(data, filters);
  let accumulated = Money.zero();
  const rows = monthsOf(filters).map((month): ReportRow => {
    const own = entries.filter((entry) => toMonthKey(entry.date) === month);
    const income = sum(own, 'income');
    const saved = income.subtract(sum(own, 'expense'));
    accumulated = accumulated.add(saved);
    return {
      id: month,
      cells: {
        month: text(monthLabel(month)),
        income: money(income),
        saved: money(saved),
        rate: percent(rate(saved, income)),
        accumulated: money(accumulated),
      },
    };
  });
  return {
    columns: [
      leftColumn('month', 'Mês'),
      rightColumn('income', 'Receitas'),
      rightColumn('saved', 'Economia'),
      rightColumn('rate', 'Taxa de poupança'),
      rightColumn('accumulated', 'Economia acumulada'),
    ],
    rows,
    totals: null,
    notes: ['Economia = receitas − despesas por competência.', ...accountNote(data, filters)],
  };
}

export const FUTURE_MONTHS = 12;

function futureReport(data: ReportData, filters: ReportFilters, today: IsoDate): ReportTable {
  const current = toMonthKey(today);
  const last = addMonthsToKey(current, FUTURE_MONTHS - 1);
  const flows = collectFlows(data, monthEnd(last)).filter((flow) => flow.type === 'expense');
  const accountFilter = (flow: (typeof flows)[number]) => filters.accountId === null || !flow.card;
  let totalBills = Money.zero();
  let totalCards = Money.zero();
  const rows = Array.from({ length: FUTURE_MONTHS }, (_, index): ReportRow => {
    const month = addMonthsToKey(current, index);
    const end = monthEnd(month);
    const bills = Money.sum(
      flows
        .filter(
          (flow) =>
            !flow.card &&
            flow.pending &&
            accountFilter(flow) &&
            (index === 0 ? flow.date <= end : toMonthKey(flow.date) === month),
        )
        .map((flow) => flow.amount),
    );
    const cards =
      filters.accountId !== null
        ? Money.zero()
        : Money.sum(
            flows
              .filter((flow) => flow.card && flow.date > today && toMonthKey(flow.date) === month)
              .map((flow) => flow.amount),
          );
    totalBills = totalBills.add(bills);
    totalCards = totalCards.add(cards);
    return {
      id: month,
      cells: {
        month: text(monthLabel(month)),
        bills: money(bills),
        cards: money(cards),
        total: money(bills.add(cards)),
      },
    };
  });
  return {
    columns: [
      leftColumn('month', 'Mês'),
      rightColumn('bills', 'Contas pendentes e recorrentes'),
      rightColumn('cards', 'Parcelas de cartão'),
      rightColumn('total', 'Total'),
    ],
    rows,
    totals: {
      id: 'total',
      cells: {
        month: text('Total'),
        bills: money(totalBills),
        cards: money(totalCards),
        total: money(totalBills.add(totalCards)),
      },
    },
    notes: [
      `Próximos ${FUTURE_MONTHS} meses a partir de hoje (o período escolhido não se aplica). O mês atual inclui pendentes vencidos.`,
      'Parcelas de cartão por competência; recorrências futuras ainda não geradas entram como previsão.',
      ...accountNote(data, filters),
    ],
  };
}

/** Monta o relatório escolhido. Funções puras: mesmo dado → mesma tabela. */
export function buildReport(
  kind: ReportKind,
  data: ReportData,
  filters: ReportFilters,
  today: IsoDate,
): ReportTable {
  switch (kind) {
    case 'summary':
      return summaryReport(data, filters, today);
    case 'monthly':
      return monthlyReport(data, filters);
    case 'expenses_by_category':
      return byCategoryReport(data, filters, 'expense');
    case 'income_by_category':
      return byCategoryReport(data, filters, 'income');
    case 'by_account':
      return byAccountReport(data, filters, today);
    case 'cash_flow':
      return cashFlowReport(data, filters, today);
    case 'budget_vs_actual':
      return budgetReport(data, filters);
    case 'net_worth':
      return netWorthReport(data, filters, today);
    case 'investments':
      return investmentsReport(data, filters, today);
    case 'savings_history':
      return savingsReport(data, filters);
    case 'future_commitments':
      return futureReport(data, filters, today);
  }
}
