import type { Account } from '@/features/accounts';
import type { CardPurchase, CreditCard } from '@/features/credit-cards';
import type { Transaction } from '@/features/transactions';
import { asIsoDate, asMonthKey } from '@/lib/dates';
import { Money } from '@/lib/money';

/** Construtores concisos de entidades para testes de regras financeiras. */

export const d = asIsoDate;
export const m = asMonthKey;
export const brl = (value: string) => Money.of(value);

let counter = 0;
const nextId = (prefix: string) => `${prefix}-${++counter}`;

export function account(overrides: Partial<Account> = {}): Account {
  return {
    id: nextId('acc'),
    name: 'Conta',
    type: 'checking',
    institution: null,
    initialBalance: brl('0'),
    initialBalanceDate: d('2026-01-01'),
    archived: false,
    ...overrides,
  };
}

type TxInput = Partial<Omit<Transaction, 'amount'>> & { amount: string; accountId: string };

export function tx(input: TxInput): Transaction {
  const date = input.competenceDate ?? d('2026-01-10');
  const status = input.status ?? 'paid';
  return {
    id: nextId('tx'),
    kind: 'expense',
    description: 'Lançamento',
    categoryId: null,
    competenceDate: date,
    dueDate: date,
    paidDate: status === 'paid' ? date : null,
    status,
    transfer: null,
    cardPayment: null,
    investment: null,
    recurrenceId: null,
    installment: null,
    tags: [],
    notes: null,
    ...input,
    amount: brl(input.amount),
  };
}

/** Par de transferência (saída e entrada) com o mesmo valor. */
export function transfer(from: string, to: string, amount: string, date: string): Transaction[] {
  const id = nextId('trf');
  const base = { kind: 'transfer' as const, amount, competenceDate: d(date) };
  return [
    tx({ ...base, accountId: from, transfer: { id, direction: 'out', counterpartAccountId: to } }),
    tx({ ...base, accountId: to, transfer: { id, direction: 'in', counterpartAccountId: from } }),
  ];
}

export function card(overrides: Partial<CreditCard> = {}): CreditCard {
  return {
    id: nextId('card'),
    name: 'Cartão',
    institution: 'Banco',
    brand: 'visa',
    limit: brl('5000'),
    closingDay: 3,
    dueDay: 10,
    paymentAccountId: 'acc-pay',
    status: 'active',
    ...overrides,
  };
}

type PurchaseInput = Partial<Omit<CardPurchase, 'totalAmount' | 'purchaseDate'>> & {
  cardId: string;
  totalAmount: string;
  purchaseDate: string;
};

export function purchase(input: PurchaseInput): CardPurchase {
  return {
    id: nextId('cp'),
    description: 'Compra',
    categoryId: null,
    installmentCount: 1,
    status: 'active',
    ...input,
    totalAmount: brl(input.totalAmount),
    purchaseDate: d(input.purchaseDate),
  };
}

export function cardPayment(
  creditCard: CreditCard,
  invoiceMonth: string,
  amount: string,
  date: string,
): Transaction {
  return tx({
    kind: 'card_payment',
    accountId: creditCard.paymentAccountId,
    amount,
    competenceDate: d(date),
    cardPayment: { cardId: creditCard.id, invoiceMonth: m(invoiceMonth) },
  });
}
