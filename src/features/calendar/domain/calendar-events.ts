import type { Account } from '@/features/accounts/domain/entities/account';
import type { CardPurchase, CreditCard } from '@/features/credit-cards/domain/entities/credit-card';
import { getInvoiceDates } from '@/features/credit-cards/domain/services/invoice-schedule';
import { buildInvoiceForMonth } from '@/features/credit-cards/domain/services/invoices';
import type { Goal, GoalContribution } from '@/features/goals/domain/entities/goal';
import { computeGoalProgress } from '@/features/goals/domain/services/goal-progress';
import type { Recurrence } from '@/features/transactions/domain/entities/recurrence';
import type { Transaction } from '@/features/transactions/domain/entities/transaction';
import { buildMissingOccurrences } from '@/features/transactions/domain/services/recurrence-schedule';
import {
  addMonthsToKey,
  formatDateBR,
  monthKeysBetween,
  toMonthKey,
  type IsoDate,
} from '@/lib/dates';
import { formatMoney, Money } from '@/lib/money';

/**
 * Calendário financeiro (ADR 0013): eventos DERIVADOS dos módulos — nada é
 * armazenado. Contas a pagar/receber e transferências vêm dos lançamentos,
 * previsões das recorrências ainda não geradas, vencimentos das faturas e
 * prazos das metas.
 */

export type CalendarEventType = 'payable' | 'receivable' | 'transfer' | 'invoice' | 'goal';

export const CALENDAR_EVENT_TYPE_LABELS: Record<CalendarEventType, string> = {
  payable: 'Contas a pagar',
  receivable: 'Contas a receber',
  transfer: 'Transferências',
  invoice: 'Faturas de cartão',
  goal: 'Prazos de metas',
};

/** done = pago/recebido/atingida; forecast = previsão (recorrência futura, fatura aberta). */
export type CalendarEventStatus = 'done' | 'pending' | 'overdue' | 'forecast';

export const CALENDAR_STATUS_LABELS: Record<CalendarEventStatus, string> = {
  done: 'Realizado',
  pending: 'Pendente',
  overdue: 'Vencido',
  forecast: 'Previsto',
};

export interface CalendarEventLink {
  module: 'transactions' | 'credit-cards' | 'goals';
  entityId: string | null;
}

export interface CalendarEvent {
  id: string;
  date: IsoDate;
  type: CalendarEventType;
  status: CalendarEventStatus;
  title: string;
  amount: Money | null;
  detail: string | null;
  link: CalendarEventLink;
}

export interface CalendarData {
  accounts: Account[];
  transactions: Transaction[];
  recurrences: Recurrence[];
  cards: CreditCard[];
  purchases: CardPurchase[];
  goals: Goal[];
  contributions: GoalContribution[];
}

export interface CalendarRange {
  start: IsoDate;
  end: IsoDate;
}

const TYPE_ORDER: Record<CalendarEventType, number> = {
  invoice: 0,
  payable: 1,
  receivable: 2,
  transfer: 3,
  goal: 4,
};

function transactionEvents(
  data: CalendarData,
  range: CalendarRange,
  today: IsoDate,
): CalendarEvent[] {
  const accountName = new Map(data.accounts.map((item) => [item.id, item.name]));
  const virtual = data.recurrences.flatMap((recurrence) =>
    buildMissingOccurrences(recurrence, data.transactions, range.end),
  );
  const virtualIds = new Set(virtual.map((tx) => tx.id));

  return [...data.transactions, ...virtual].flatMap((tx): CalendarEvent[] => {
    if (tx.status === 'cancelled') return [];
    // Faturas têm evento próprio; aplicações/resgates não são compromissos.
    if (tx.kind === 'card_payment' || tx.kind === 'investment') return [];
    // Transferência aparece uma vez (perna de saída).
    if (tx.kind === 'transfer' && tx.transfer?.direction !== 'out') return [];
    const date =
      tx.status === 'paid' ? (tx.paidDate ?? tx.competenceDate) : (tx.dueDate ?? tx.competenceDate);
    if (date < range.start || date > range.end) return [];

    const forecast = virtualIds.has(tx.id);
    const status: CalendarEventStatus =
      tx.status === 'paid' ? 'done' : forecast ? 'forecast' : date < today ? 'overdue' : 'pending';
    const type: CalendarEventType =
      tx.kind === 'income' ? 'receivable' : tx.kind === 'transfer' ? 'transfer' : 'payable';
    const account = accountName.get(tx.accountId) ?? 'Conta';
    const detail =
      tx.kind === 'transfer' && tx.transfer
        ? `${account} → ${accountName.get(tx.transfer.counterpartAccountId) ?? 'outra conta'}`
        : [
            account,
            tx.installment ? `parcela ${tx.installment.number}/${tx.installment.total}` : null,
            tx.recurrenceId ? 'recorrente' : null,
          ]
            .filter(Boolean)
            .join(' · ');
    return [
      {
        id: `tx:${tx.id}`,
        date,
        type,
        status,
        title: tx.description,
        amount: tx.amount,
        detail,
        link: { module: 'transactions', entityId: forecast ? null : tx.id },
      },
    ];
  });
}

function invoiceEvents(data: CalendarData, range: CalendarRange, today: IsoDate): CalendarEvent[] {
  // Faturas que vencem no intervalo: o vencimento pode cair no mês seguinte ao de referência.
  const months = monthKeysBetween(
    addMonthsToKey(toMonthKey(range.start), -1),
    toMonthKey(range.end),
  );
  return data.cards.flatMap((card) =>
    months.flatMap((month): CalendarEvent[] => {
      const { dueDate } = getInvoiceDates(card, month);
      if (dueDate < range.start || dueDate > range.end) return [];
      const invoice = buildInvoiceForMonth(card, data.purchases, data.transactions, month, today);
      if (invoice.total.isZero() && invoice.paid.isZero()) return [];
      const status: CalendarEventStatus =
        invoice.status === 'paid'
          ? 'done'
          : invoice.status === 'overdue'
            ? 'overdue'
            : invoice.status === 'open' || invoice.status === 'future'
              ? 'forecast'
              : 'pending';
      return [
        {
          id: `invoice:${card.id}:${month}`,
          date: dueDate,
          type: 'invoice',
          status,
          title: `Fatura ${card.name}`,
          amount: status === 'done' ? invoice.total : invoice.outstanding,
          detail: `${invoice.installments.length} ${invoice.installments.length === 1 ? 'lançamento' : 'lançamentos'} · fecha em ${formatDateBR(invoice.closingDate)}`,
          link: { module: 'credit-cards', entityId: card.id },
        },
      ];
    }),
  );
}

function goalEvents(data: CalendarData, range: CalendarRange, today: IsoDate): CalendarEvent[] {
  return data.goals.flatMap((goal): CalendarEvent[] => {
    if (goal.status === 'cancelled' || goal.targetDate === null) return [];
    if (goal.targetDate < range.start || goal.targetDate > range.end) return [];
    const progress = computeGoalProgress(goal, data.contributions, today);
    const reached = !progress.remaining.isPositive() || goal.status === 'completed';
    return [
      {
        id: `goal:${goal.id}`,
        date: goal.targetDate,
        type: 'goal',
        status: reached ? 'done' : goal.targetDate < today ? 'overdue' : 'pending',
        title: `Prazo da meta ${goal.name}`,
        amount: reached ? null : progress.remaining,
        detail: reached
          ? 'Meta atingida'
          : `Faltam ${formatMoney(progress.remaining)} de ${formatMoney(goal.targetAmount)}`,
        link: { module: 'goals', entityId: goal.id },
      },
    ];
  });
}

/** Todos os eventos do intervalo, ordenados por data e tipo. */
export function buildCalendarEvents(
  data: CalendarData,
  range: CalendarRange,
  today: IsoDate,
): CalendarEvent[] {
  return [
    ...transactionEvents(data, range, today),
    ...invoiceEvents(data, range, today),
    ...goalEvents(data, range, today),
  ].sort((a, b) =>
    a.date === b.date
      ? TYPE_ORDER[a.type] - TYPE_ORDER[b.type] || a.title.localeCompare(b.title, 'pt-BR')
      : a.date < b.date
        ? -1
        : 1,
  );
}

export interface CalendarTotals {
  /** A pagar (pendente + vencido + previsto) no intervalo: contas e faturas. */
  toPay: Money;
  toReceive: Money;
  overdueCount: number;
}

/** Totais dos eventos ainda não realizados. */
export function summarizeEvents(events: readonly CalendarEvent[]): CalendarTotals {
  const open = events.filter((event) => event.status !== 'done' && event.amount !== null);
  return {
    toPay: Money.sum(
      open
        .filter((event) => event.type === 'payable' || event.type === 'invoice')
        .flatMap((event) => (event.amount ? [event.amount] : [])),
    ),
    toReceive: Money.sum(
      open
        .filter((event) => event.type === 'receivable')
        .flatMap((event) => (event.amount ? [event.amount] : [])),
    ),
    overdueCount: events.filter((event) => event.status === 'overdue').length,
  };
}
