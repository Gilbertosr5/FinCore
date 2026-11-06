import {
  addMonths,
  addMonthsToKey,
  dayOfMonth,
  toMonthKey,
  type IsoDate,
  type MonthKey,
} from '@/lib/dates';
import type { Money } from '@/lib/money';

import type { CardPurchase, CreditCard } from '../entities/credit-card';

/**
 * Calendário de faturas e distribuição de parcelas (ver docs/adr/0007).
 *
 * - A fatura de referência M fecha no dia `closingDay` de M e vence no dia
 *   `dueDay` de M (se dueDay > closingDay) ou de M+1 (caso contrário).
 * - Compra ANTES da data de fechamento entra na fatura do mês; compra NA data de
 *   fechamento ou depois entra na fatura seguinte ("melhor dia de compra").
 * - A parcela i (0-based) vai para a fatura (primeira + i).
 * - Os valores das parcelas vêm de `Money.allocate`: a soma é exatamente o total
 *   e o centavo residual fica nas primeiras parcelas.
 */

export interface InvoiceDates {
  closingDate: IsoDate;
  dueDate: IsoDate;
}

export function getInvoiceDates(
  card: Pick<CreditCard, 'closingDay' | 'dueDay'>,
  month: MonthKey,
): InvoiceDates {
  const closingDate = dayOfMonth(month, card.closingDay);
  const dueMonth = card.dueDay > card.closingDay ? month : addMonthsToKey(month, 1);
  return { closingDate, dueDate: dayOfMonth(dueMonth, card.dueDay) };
}

export function getInvoiceMonthForPurchase(
  card: Pick<CreditCard, 'closingDay' | 'dueDay'>,
  purchaseDate: IsoDate,
): MonthKey {
  const month = toMonthKey(purchaseDate);
  const { closingDate } = getInvoiceDates(card, month);
  return purchaseDate < closingDate ? month : addMonthsToKey(month, 1);
}

export interface CardInstallment {
  purchaseId: string;
  cardId: string;
  categoryId: string | null;
  description: string;
  purchaseDate: IsoDate;
  number: number;
  total: number;
  amount: Money;
  invoiceMonth: MonthKey;
  /** Competência da parcela para relatórios de consumo: data da compra + i meses. */
  competenceDate: IsoDate;
}

/** Parcelas de uma compra. Compras canceladas não geram parcelas. */
export function expandInstallments(
  purchase: CardPurchase,
  card: Pick<CreditCard, 'closingDay' | 'dueDay'>,
): CardInstallment[] {
  if (purchase.status === 'cancelled') return [];
  const firstMonth = getInvoiceMonthForPurchase(card, purchase.purchaseDate);
  return purchase.totalAmount.allocate(purchase.installmentCount).map((amount, index) => ({
    purchaseId: purchase.id,
    cardId: purchase.cardId,
    categoryId: purchase.categoryId,
    description: purchase.description,
    purchaseDate: purchase.purchaseDate,
    number: index + 1,
    total: purchase.installmentCount,
    amount,
    invoiceMonth: addMonthsToKey(firstMonth, index),
    competenceDate: addMonths(purchase.purchaseDate, index),
  }));
}
