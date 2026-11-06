import type { IsoDate } from '@/lib/dates';
import { Money } from '@/lib/money';

import type { Transaction } from '../entities/transaction';

/**
 * Regras centrais de contabilização. Toda soma de saldo, receita ou despesa da
 * aplicação deve passar por estas funções, para que transferências, pagamentos
 * de fatura e lançamentos cancelados nunca sejam contados indevidamente.
 */

export function isActive(transaction: Transaction): boolean {
  return transaction.status !== 'cancelled';
}

/** Liquidada até a data informada (inclusive). */
export function isSettledBy(transaction: Transaction, asOf: IsoDate): boolean {
  return (
    transaction.status === 'paid' && transaction.paidDate !== null && transaction.paidDate <= asOf
  );
}

/**
 * Efeito no saldo da conta (positivo = entrada). Somente lançamentos liquidados
 * até `asOf` alteram o saldo; pendentes e cancelados têm efeito zero.
 */
export function getAccountEffect(transaction: Transaction, asOf: IsoDate): Money {
  if (!isSettledBy(transaction, asOf)) return Money.zero(transaction.amount.currency);
  switch (transaction.kind) {
    case 'income':
      return transaction.amount;
    case 'expense':
    case 'card_payment':
      return transaction.amount.negate();
    case 'transfer':
      return transaction.transfer?.direction === 'in'
        ? transaction.amount
        : transaction.amount.negate();
    case 'investment':
      return transaction.investment?.direction === 'redemption'
        ? transaction.amount
        : transaction.amount.negate();
  }
}

/** Receita para o resultado financeiro (regime de competência). */
export function countsAsIncome(transaction: Transaction): boolean {
  return transaction.kind === 'income' && isActive(transaction);
}

/**
 * Despesa de consumo vinda de conta (regime de competência). Transferências,
 * pagamentos de fatura e aplicações em investimentos nunca são despesa.
 */
export function countsAsExpense(transaction: Transaction): boolean {
  return transaction.kind === 'expense' && isActive(transaction);
}

/** Data usada para ordenar e exibir a movimentação. */
export function getTransactionDisplayDate(transaction: Transaction): IsoDate {
  return transaction.paidDate ?? transaction.dueDate ?? transaction.competenceDate;
}
