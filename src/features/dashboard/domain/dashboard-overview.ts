import { ACCOUNT_TYPE_LABELS, type AccountType } from '@/features/accounts/domain/entities/account';
import {
  computeAccountBalances,
  sumBalances,
  type AccountBalance,
} from '@/features/accounts/domain/services/account-balance';
import {
  computeBudgetUsage,
  getBudgetPeriod,
} from '@/features/budgets/domain/services/budget-usage';
import {
  buildInvoices,
  computeCardDebt,
  computeLimitUsage,
} from '@/features/credit-cards/domain/services/invoices';
import { computeGoalProgress } from '@/features/goals/domain/services/goal-progress';
import type { AssetClass } from '@/features/investments/domain/entities/investment';
import {
  computePortfolio,
  type PortfolioSummary,
} from '@/features/investments/domain/services/portfolio';
import type { Transaction } from '@/features/transactions/domain/entities/transaction';
import { getTransactionDisplayDate } from '@/features/transactions/domain/rules/transaction-effects';
import {
  addDays,
  differenceInDays,
  monthEnd,
  toMonthKey,
  type IsoDate,
  type MonthKey,
} from '@/lib/dates';
import { Money } from '@/lib/money';

import { buildAlerts } from './alerts';
import type { DashboardData } from './dashboard-data';
import {
  entriesInRange,
  getFinancialEntries,
  sumPeriod,
  type FinancialEntry,
} from './financial-entries';
import type {
  ActivityItem,
  CardSummary,
  CategorySlice,
  DashboardOverview,
  MonthlyPoint,
} from './overview-types';
import { getChartMonths, type DateRange } from './period';

const MAX_CATEGORY_SLICES = 6;
const UPCOMING_WINDOW_DAYS = 30;
const RECENT_ACTIVITY_LIMIT = 8;
const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 } as const;

/** Monta o dashboard a partir dos dados de origem. Função pura e determinística. */
export function buildDashboardOverview(
  data: DashboardData,
  range: DateRange,
  today: IsoDate,
): DashboardOverview {
  const entries = getFinancialEntries(data);
  const activeCards = data.cards.filter((card) => card.status !== 'cancelled');
  const categoryName = new Map(data.categories.map((item) => [item.id, item.name]));

  const accountBalances = computeAccountBalances(
    data.accounts.filter((account) => !account.archived),
    data.transactions,
    today,
  );
  const accountsBalance = sumBalances(accountBalances);
  const portfolio = computePortfolio(data.assets, data.movements, data.valuations, today);
  const cardDebtAt = (asOf: IsoDate) =>
    Money.sum(
      data.cards.map((card) => computeCardDebt(card, data.purchases, data.transactions, asOf)),
    );
  const cardCommitment = cardDebtAt(today);

  const cards: CardSummary[] = activeCards.map((card) => ({
    cardId: card.id,
    name: card.name,
    limit: card.limit,
    usage: computeLimitUsage(card, computeCardDebt(card, data.purchases, data.transactions, today)),
  }));

  const monthly = getChartMonths(range, today).map((month) =>
    buildMonthlyPoint(data, entries, month, today, cardDebtAt),
  );

  const budgets = data.budgets
    .filter((budget) => budget.active)
    .map((budget) => {
      const period = getBudgetPeriod(budget, today);
      const spent = Money.sum(
        entriesInRange(entries, period)
          .filter(
            (entry) =>
              entry.type === 'expense' &&
              (budget.categoryId === null || entry.categoryId === budget.categoryId),
          )
          .map((entry) => entry.amount),
      );
      return computeBudgetUsage(budget, spent);
    })
    .sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0));

  const goals = data.goals
    .filter((goal) => goal.status === 'active')
    .map((goal) => computeGoalProgress(goal, data.contributions, today))
    .sort(
      (a, b) =>
        PRIORITY_ORDER[a.goal.priority] - PRIORITY_ORDER[b.goal.priority] || b.percent - a.percent,
    );

  const accountName = new Map(data.accounts.map((item) => [item.id, item.name]));
  const upcomingBills = getUpcomingBills(data.transactions, today).map((transaction) => ({
    transaction,
    accountName: accountName.get(transaction.accountId) ?? 'Conta',
    daysUntilDue: differenceInDays(transaction.dueDate ?? today, today),
  }));

  const upcomingInvoices = activeCards
    .flatMap((card) =>
      buildInvoices(card, data.purchases, data.transactions, today)
        .filter((invoice) => invoice.status !== 'future' && invoice.outstanding.isPositive())
        .map((invoice) => ({
          invoice,
          cardName: card.name,
          daysUntilDue: differenceInDays(invoice.dueDate, today),
        })),
    )
    .sort((a, b) => (a.invoice.dueDate < b.invoice.dueDate ? -1 : 1));

  const netWorth = accountsBalance.add(portfolio.currentValue).subtract(cardCommitment);
  const totals = sumPeriod(entriesInRange(entries, range));

  return {
    today,
    range,
    totals,
    netWorth,
    accountsBalance,
    accountBalances,
    portfolio,
    cardCommitment,
    cards,
    monthly,
    expensesByCategory: groupExpensesByCategory(
      entriesInRange(entries, range),
      categoryName,
      data.categories.filter((item) => item.kind === 'expense').map((item) => item.id),
    ),
    allocation: buildAllocation(accountBalances, portfolio),
    recentActivity: buildRecentActivity(data, today, categoryName, accountName),
    upcomingBills,
    upcomingInvoices,
    goals,
    budgets,
    alerts: buildAlerts({
      accountBalances,
      upcomingBills,
      upcomingInvoices,
      budgets,
      cards,
      totals,
    }),
  };
}

function buildMonthlyPoint(
  data: DashboardData,
  entries: readonly FinancialEntry[],
  month: MonthKey,
  today: IsoDate,
  cardDebtAt: (asOf: IsoDate) => Money,
): MonthlyPoint {
  const end = monthEnd(month);
  const asOf = end < today ? end : today;
  const monthEntries = entries.filter((entry) => toMonthKey(entry.date) === month);
  const { income, expenses, result } = sumPeriod(monthEntries);
  const accountsBalance = sumBalances(
    computeAccountBalances(data.accounts, data.transactions, asOf),
  );
  const portfolio = computePortfolio(data.assets, data.movements, data.valuations, asOf);
  const cardDebt = cardDebtAt(asOf);
  return {
    month,
    income,
    expenses,
    result,
    accountsBalance,
    investmentsValue: portfolio.currentValue,
    investmentsNetInvested: portfolio.netInvested,
    cardDebt,
    netWorth: accountsBalance.add(portfolio.currentValue).subtract(cardDebt),
  };
}

/** Despesas pendentes vencidas ou com vencimento nos próximos 30 dias. */
function getUpcomingBills(transactions: readonly Transaction[], today: IsoDate): Transaction[] {
  const limit = addDays(today, UPCOMING_WINDOW_DAYS);
  return transactions
    .filter(
      (tx) =>
        tx.kind === 'expense' &&
        tx.status === 'pending' &&
        tx.dueDate !== null &&
        tx.dueDate <= limit,
    )
    .sort((a, b) => ((a.dueDate ?? '') < (b.dueDate ?? '') ? -1 : 1));
}

function groupExpensesByCategory(
  entries: readonly FinancialEntry[],
  categoryName: Map<string, string>,
  expenseCategoryOrder: readonly string[],
): CategorySlice[] {
  const totals = new Map<string, Money>();
  for (const entry of entries) {
    if (entry.type !== 'expense') continue;
    const key = entry.categoryId ?? 'uncategorized';
    totals.set(key, (totals.get(key) ?? Money.zero()).add(entry.amount));
  }
  const sorted = [...totals.entries()].sort((a, b) => b[1].compare(a[1]));
  const head = sorted.slice(0, MAX_CATEGORY_SLICES);
  const tail = sorted.slice(MAX_CATEGORY_SLICES);
  const slices = head.map(([key, amount]) => ({
    key,
    label: key === 'uncategorized' ? 'Sem categoria' : (categoryName.get(key) ?? 'Categoria'),
    amount,
    colorIndex: paletteIndex(expenseCategoryOrder.indexOf(key)),
  }));
  if (tail.length > 0) {
    slices.push({
      key: 'others',
      label: 'Outras',
      amount: Money.sum(tail.map(([, value]) => value)),
      colorIndex: null,
    });
  }
  return withShares(slices);
}

type AllocationGroup =
  | 'liquidity'
  | 'savings'
  | 'broker_cash'
  | 'fixed_income'
  | 'variable_income'
  | 'crypto'
  | 'other_investments';

const ALLOCATION_LABELS: Record<AllocationGroup, string> = {
  liquidity: 'Contas e dinheiro',
  savings: ACCOUNT_TYPE_LABELS.savings,
  broker_cash: 'Saldo em corretora',
  fixed_income: 'Renda fixa',
  variable_income: 'Renda variável',
  crypto: 'Criptomoedas',
  other_investments: 'Outros investimentos',
};

const ALLOCATION_ORDER: readonly AllocationGroup[] = [
  'liquidity',
  'savings',
  'broker_cash',
  'fixed_income',
  'variable_income',
  'crypto',
  'other_investments',
];

const ACCOUNT_GROUP: Record<AccountType, AllocationGroup> = {
  checking: 'liquidity',
  cash: 'liquidity',
  digital_wallet: 'liquidity',
  other: 'liquidity',
  savings: 'savings',
  investment: 'broker_cash',
};

const ASSET_GROUP: Record<AssetClass, AllocationGroup> = {
  fixed_income: 'fixed_income',
  treasury: 'fixed_income',
  cdb: 'fixed_income',
  lci: 'fixed_income',
  lca: 'fixed_income',
  stocks: 'variable_income',
  reits: 'variable_income',
  etf: 'variable_income',
  funds: 'other_investments',
  crypto: 'crypto',
  other: 'other_investments',
};

/** Distribuição do patrimônio bruto (ativos positivos), agrupada em até 7 fatias. */
function buildAllocation(
  balances: readonly AccountBalance[],
  portfolio: PortfolioSummary,
): CategorySlice[] {
  const totals = new Map<AllocationGroup, Money>();
  const add = (group: AllocationGroup, value: Money) => {
    if (!value.isPositive()) return;
    totals.set(group, (totals.get(group) ?? Money.zero()).add(value));
  };
  balances.forEach((item) => {
    add(ACCOUNT_GROUP[item.account.type], item.balance);
  });
  portfolio.byClass.forEach((item) => {
    add(ASSET_GROUP[item.assetClass], item.value);
  });
  return withShares(
    [...totals.entries()]
      .sort((a, b) => b[1].compare(a[1]))
      .map(([key, amount]) => ({
        key,
        label: ALLOCATION_LABELS[key],
        amount,
        colorIndex: ALLOCATION_ORDER.indexOf(key),
      })),
  );
}

const PALETTE_SIZE = 8;

function paletteIndex(position: number): number | null {
  return position < 0 ? null : position % PALETTE_SIZE;
}

function withShares(slices: Omit<CategorySlice, 'share'>[]): CategorySlice[] {
  const total = Money.sum(slices.map((item) => item.amount));
  return slices.map((item) => ({
    ...item,
    share: item.amount.percentageOf(total)?.toNumber() ?? 0,
  }));
}

const KIND_LABELS: Record<Transaction['kind'], string> = {
  income: 'Receita',
  expense: 'Despesa',
  transfer: 'Transferência',
  card_payment: 'Pagamento de fatura',
  investment: 'Investimento',
};

function buildRecentActivity(
  data: DashboardData,
  today: IsoDate,
  categoryName: Map<string, string>,
  accountName: Map<string, string>,
): ActivityItem[] {
  const fromAccounts = data.transactions
    // Transferências aparecem uma vez (perna de saída), não duas.
    .filter(
      (tx) =>
        tx.status === 'paid' &&
        getTransactionDisplayDate(tx) <= today &&
        tx.transfer?.direction !== 'in',
    )
    .map((tx): ActivityItem => ({
      id: tx.id,
      description: tx.description,
      date: getTransactionDisplayDate(tx),
      amount: tx.amount,
      flow:
        tx.kind === 'income'
          ? 'in'
          : tx.kind === 'expense' || tx.kind === 'card_payment'
            ? 'out'
            : 'neutral',
      kindLabel: KIND_LABELS[tx.kind],
      sourceLabel: accountName.get(tx.accountId) ?? 'Conta',
      categoryLabel: tx.categoryId ? (categoryName.get(tx.categoryId) ?? null) : null,
      detail:
        tx.transfer !== null
          ? `${tx.transfer.direction === 'out' ? 'Para' : 'De'} ${accountName.get(tx.transfer.counterpartAccountId) ?? 'outra conta'}`
          : null,
      status: tx.status,
    }));

  const cardName = new Map(data.cards.map((card) => [card.id, card.name]));
  const fromCards = data.purchases
    .filter((purchase) => purchase.status === 'active' && purchase.purchaseDate <= today)
    .map((purchase): ActivityItem => ({
      id: purchase.id,
      description: purchase.description,
      date: purchase.purchaseDate,
      amount: purchase.totalAmount,
      flow: 'out',
      kindLabel: 'Compra no cartão',
      sourceLabel: cardName.get(purchase.cardId) ?? 'Cartão',
      categoryLabel: purchase.categoryId ? (categoryName.get(purchase.categoryId) ?? null) : null,
      detail: purchase.installmentCount > 1 ? `Em ${purchase.installmentCount}x` : null,
      status: 'paid',
    }));

  return [...fromAccounts, ...fromCards]
    .sort((a, b) => (a.date === b.date ? (a.id < b.id ? 1 : -1) : a.date < b.date ? 1 : -1))
    .slice(0, RECENT_ACTIVITY_LIMIT);
}
