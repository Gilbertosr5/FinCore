import type { AccountBalance } from '@/features/accounts/domain/services/account-balance';
import type { BudgetUsage } from '@/features/budgets/domain/services/budget-usage';
import type { CardLimitUsage, Invoice } from '@/features/credit-cards/domain/services/invoices';
import type { GoalProgress } from '@/features/goals/domain/services/goal-progress';
import type { PortfolioSummary } from '@/features/investments/domain/services/portfolio';
import type { Transaction } from '@/features/transactions/domain/entities/transaction';
import type { IsoDate, MonthKey } from '@/lib/dates';
import type { Money } from '@/lib/money';

import type { PeriodTotals } from './financial-entries';
import type { DateRange } from './period';

export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface DashboardAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  description: string;
}

export interface MonthlyPoint {
  month: MonthKey;
  income: Money;
  expenses: Money;
  result: Money;
  /** Soma dos saldos das contas no fim do mês (ou hoje, no mês corrente). */
  accountsBalance: Money;
  investmentsValue: Money;
  investmentsNetInvested: Money;
  cardDebt: Money;
  netWorth: Money;
}

export interface CategorySlice {
  key: string;
  label: string;
  amount: Money;
  /** Participação no total, em pontos percentuais. */
  share: number;
  /**
   * Posição estável na paleta categórica (0–7), derivada da entidade e não do
   * ranking: a mesma categoria mantém a cor em qualquer período. null = neutro.
   */
  colorIndex: number | null;
}

export interface ActivityItem {
  id: string;
  description: string;
  date: IsoDate;
  amount: Money;
  flow: 'in' | 'out' | 'neutral';
  kindLabel: string;
  sourceLabel: string;
  categoryLabel: string | null;
  detail: string | null;
  status: Transaction['status'];
}

export interface UpcomingBill {
  transaction: Transaction;
  accountName: string;
  /** Negativo = vencida há N dias. */
  daysUntilDue: number;
}

export interface UpcomingInvoice {
  invoice: Invoice;
  cardName: string;
  daysUntilDue: number;
}

export interface CardSummary {
  cardId: string;
  name: string;
  limit: Money;
  usage: CardLimitUsage;
}

export interface DashboardOverview {
  today: IsoDate;
  range: DateRange;
  totals: PeriodTotals;
  netWorth: Money;
  accountsBalance: Money;
  accountBalances: AccountBalance[];
  portfolio: PortfolioSummary;
  cardCommitment: Money;
  cards: CardSummary[];
  monthly: MonthlyPoint[];
  expensesByCategory: CategorySlice[];
  allocation: CategorySlice[];
  recentActivity: ActivityItem[];
  upcomingBills: UpcomingBill[];
  upcomingInvoices: UpcomingInvoice[];
  goals: GoalProgress[];
  budgets: BudgetUsage[];
  alerts: DashboardAlert[];
}
