import type { Transaction } from '@/features/transactions/domain/entities/transaction';
import type { IsoDate, MonthKey } from '@/lib/dates';
import { Money } from '@/lib/money';

import {
  expandInstallments,
  getInvoiceDates,
  getInvoiceMonthForPurchase,
  type CardInstallment,
} from './invoice-schedule';
import type { CardPurchase, CreditCard } from '../entities/credit-card';

export type InvoiceStatus = 'future' | 'open' | 'closed' | 'partially_paid' | 'paid' | 'overdue';

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  future: 'Futura',
  open: 'Aberta',
  closed: 'Fechada',
  partially_paid: 'Parcialmente paga',
  paid: 'Paga',
  overdue: 'Vencida',
};

export interface Invoice {
  cardId: string;
  month: MonthKey;
  closingDate: IsoDate;
  dueDate: IsoDate;
  total: Money;
  paid: Money;
  outstanding: Money;
  status: InvoiceStatus;
  installments: CardInstallment[];
}

/** Pagamentos de fatura válidos (liquidados) de um cartão. */
export function getCardPayments(
  cardId: string,
  transactions: readonly Transaction[],
): Transaction[] {
  return transactions.filter(
    (tx) =>
      tx.kind === 'card_payment' &&
      tx.status === 'paid' &&
      tx.paidDate !== null &&
      tx.cardPayment?.cardId === cardId,
  );
}

export function getCardInstallments(
  card: CreditCard,
  purchases: readonly CardPurchase[],
): CardInstallment[] {
  return purchases
    .filter((purchase) => purchase.cardId === card.id)
    .flatMap((purchase) => expandInstallments(purchase, card));
}

function resolveStatus(
  dates: { closingDate: IsoDate; dueDate: IsoDate },
  total: Money,
  paid: Money,
  today: IsoDate,
  isCurrentOpen: boolean,
): InvoiceStatus {
  if (!total.isZero() && paid.greaterThanOrEqual(total)) return 'paid';
  if (today < dates.closingDate) return isCurrentOpen ? 'open' : 'future';
  // Fatura fechada sem nenhum valor: nada a pagar.
  if (total.isZero()) return 'paid';
  if (today > dates.dueDate) return 'overdue';
  return paid.isPositive() ? 'partially_paid' : 'closed';
}

/** Mês da fatura aberta hoje: é nela que uma compra feita hoje entraria. */
export function getOpenInvoiceMonth(
  card: Pick<CreditCard, 'closingDay' | 'dueDay'>,
  today: IsoDate,
): MonthKey {
  return getInvoiceMonthForPurchase(card, today);
}

function assembleInvoice(
  card: CreditCard,
  month: MonthKey,
  installments: readonly CardInstallment[],
  payments: readonly Transaction[],
  today: IsoDate,
): Invoice {
  const currency = card.limit.currency;
  const dates = getInvoiceDates(card, month);
  const monthInstallments = installments.filter((item) => item.invoiceMonth === month);
  const total = Money.sum(
    monthInstallments.map((item) => item.amount),
    currency,
  );
  const paid = Money.sum(
    payments.filter((tx) => tx.cardPayment?.invoiceMonth === month).map((tx) => tx.amount),
    currency,
  );
  const isCurrentOpen = month === getOpenInvoiceMonth(card, today);
  return {
    cardId: card.id,
    month,
    ...dates,
    total,
    paid,
    outstanding: total.subtract(paid).max(Money.zero(currency)),
    status: resolveStatus(dates, total, paid, today, isCurrentOpen),
    installments: monthInstallments,
  };
}

/**
 * Faturas de um cartão, derivadas das parcelas e dos pagamentos. Nunca são
 * armazenadas: não há como o total da fatura divergir das compras.
 * A fatura aberta é a do mês em que uma compra feita hoje entraria.
 */
export function buildInvoices(
  card: CreditCard,
  purchases: readonly CardPurchase[],
  transactions: readonly Transaction[],
  today: IsoDate,
): Invoice[] {
  const installments = getCardInstallments(card, purchases);
  const payments = getCardPayments(card.id, transactions);
  const months = [
    ...new Set([
      ...installments.map((item) => item.invoiceMonth),
      ...payments.flatMap((tx) => (tx.cardPayment ? [tx.cardPayment.invoiceMonth] : [])),
    ]),
  ].sort();
  return months.map((month) => assembleInvoice(card, month, installments, payments, today));
}

/** Fatura de um mês específico, mesmo que vazia (ex.: fatura aberta sem compras). */
export function buildInvoiceForMonth(
  card: CreditCard,
  purchases: readonly CardPurchase[],
  transactions: readonly Transaction[],
  month: MonthKey,
  today: IsoDate,
): Invoice {
  return assembleInvoice(
    card,
    month,
    getCardInstallments(card, purchases),
    getCardPayments(card.id, transactions),
    today,
  );
}

/**
 * Dívida do cartão em uma data = parcelas de compras feitas até a data − pagamentos
 * liquidados até a data. Inclui parcelas futuras: é o limite comprometido.
 */
export function computeCardDebt(
  card: CreditCard,
  purchases: readonly CardPurchase[],
  transactions: readonly Transaction[],
  asOf: IsoDate,
): Money {
  const currency = card.limit.currency;
  const purchased = Money.sum(
    getCardInstallments(card, purchases)
      .filter((item) => item.purchaseDate <= asOf)
      .map((item) => item.amount),
    currency,
  );
  const paid = Money.sum(
    getCardPayments(card.id, transactions)
      .filter((tx) => tx.paidDate !== null && tx.paidDate <= asOf)
      .map((tx) => tx.amount),
    currency,
  );
  return purchased.subtract(paid).max(Money.zero(currency));
}

export interface CardLimitUsage {
  used: Money;
  available: Money;
  /** Percentual do limite utilizado (null se limite zero). */
  percentUsed: number | null;
}

export function computeLimitUsage(card: CreditCard, debt: Money): CardLimitUsage {
  const percent = debt.percentageOf(card.limit);
  return {
    used: debt,
    available: card.limit.subtract(debt),
    percentUsed: percent === null ? null : percent.toNumber(),
  };
}
