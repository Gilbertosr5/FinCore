import type { AccountBalance } from '@/features/accounts/domain/services/account-balance';
import type { BudgetUsage } from '@/features/budgets/domain/services/budget-usage';
import { formatDateBR, formatMonthLong } from '@/lib/dates';
import { formatMoney, formatPercent, Money } from '@/lib/money';

import type { PeriodTotals } from './financial-entries';
import type {
  AlertSeverity,
  CardSummary,
  DashboardAlert,
  UpcomingBill,
  UpcomingInvoice,
} from './overview-types';

interface AlertInput {
  accountBalances: readonly AccountBalance[];
  upcomingBills: readonly UpcomingBill[];
  upcomingInvoices: readonly UpcomingInvoice[];
  budgets: readonly BudgetUsage[];
  cards: readonly CardSummary[];
  totals: PeriodTotals;
}

const SEVERITY_ORDER: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
const BILL_SOON_DAYS = 3;
const INVOICE_SOON_DAYS = 5;
const CARD_LIMIT_WARNING_PERCENT = 80;

/** Alertas financeiros derivados do estado atual, do mais grave ao informativo. */
export function buildAlerts(input: AlertInput): DashboardAlert[] {
  const alerts: DashboardAlert[] = [];

  for (const { account, balance } of input.accountBalances) {
    if (balance.isNegative()) {
      alerts.push({
        id: `negative-${account.id}`,
        severity: 'critical',
        title: `Saldo negativo em ${account.name}`,
        description: `Saldo atual de ${formatMoney(balance)}.`,
      });
    }
  }

  const overdueBills = input.upcomingBills.filter((bill) => bill.daysUntilDue < 0);
  if (overdueBills.length > 0) {
    const total = Money.sum(overdueBills.map((bill) => bill.transaction.amount));
    alerts.push({
      id: 'overdue-bills',
      severity: 'critical',
      title:
        overdueBills.length === 1 ? '1 conta vencida' : `${overdueBills.length} contas vencidas`,
      description: `Total de ${formatMoney(total)} em atraso.`,
    });
  }

  const soonBills = input.upcomingBills.filter(
    (bill) => bill.daysUntilDue >= 0 && bill.daysUntilDue <= BILL_SOON_DAYS,
  );
  if (soonBills.length > 0) {
    const total = Money.sum(soonBills.map((bill) => bill.transaction.amount));
    alerts.push({
      id: 'bills-due-soon',
      severity: 'warning',
      title:
        soonBills.length === 1
          ? '1 conta vence nos próximos 3 dias'
          : `${soonBills.length} contas vencem nos próximos 3 dias`,
      description: `Total de ${formatMoney(total)}.`,
    });
  }

  for (const { invoice, cardName, daysUntilDue } of input.upcomingInvoices) {
    const month = formatMonthLong(invoice.month);
    if (invoice.status === 'overdue') {
      alerts.push({
        id: `invoice-overdue-${invoice.cardId}-${invoice.month}`,
        severity: 'critical',
        title: `Fatura vencida — ${cardName}`,
        description: `Fatura de ${month}: ${formatMoney(invoice.outstanding)} em aberto desde ${formatDateBR(invoice.dueDate)}.`,
      });
    } else if (invoice.status !== 'open' && daysUntilDue <= INVOICE_SOON_DAYS) {
      alerts.push({
        id: `invoice-due-${invoice.cardId}-${invoice.month}`,
        severity: 'info',
        title: `Fatura ${cardName} vence ${daysUntilDue === 0 ? 'hoje' : `em ${daysUntilDue} dia${daysUntilDue === 1 ? '' : 's'}`}`,
        description: `${formatMoney(invoice.outstanding)} — vencimento em ${formatDateBR(invoice.dueDate)}.`,
      });
    }
  }

  for (const usage of input.budgets) {
    if (usage.status === 'exceeded') {
      alerts.push({
        id: `budget-exceeded-${usage.budget.id}`,
        severity: 'critical',
        title: `Orçamento de ${usage.budget.name} excedido`,
        description: `${formatMoney(usage.excess)} acima do limite de ${formatMoney(usage.budget.amount)}.`,
      });
    } else if (usage.status === 'warning' && usage.percent !== null) {
      alerts.push({
        id: `budget-warning-${usage.budget.id}`,
        severity: 'warning',
        title: `Orçamento de ${usage.budget.name} em ${formatPercent(Math.floor(usage.percent))}`,
        description: `Restam ${formatMoney(usage.remaining)} de ${formatMoney(usage.budget.amount)}.`,
      });
    }
  }

  for (const card of input.cards) {
    if (card.usage.percentUsed !== null && card.usage.percentUsed >= CARD_LIMIT_WARNING_PERCENT) {
      alerts.push({
        id: `card-limit-${card.cardId}`,
        severity: 'warning',
        title: `Limite do ${card.name} quase esgotado`,
        description: `${formatPercent(Math.round(card.usage.percentUsed))} utilizado; disponível ${formatMoney(card.usage.available)}.`,
      });
    }
  }

  if (input.totals.result.isNegative()) {
    alerts.push({
      id: 'negative-result',
      severity: 'warning',
      title: 'Despesas acima das receitas no período',
      description: `Resultado de ${formatMoney(input.totals.result)}.`,
    });
  }

  return alerts.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}
