import type { Transaction } from '@/features/transactions/domain/entities/transaction';
import { getAccountEffect } from '@/features/transactions/domain/rules/transaction-effects';
import type { IsoDate } from '@/lib/dates';
import { Money } from '@/lib/money';

import type { Account } from '../entities/account';

/**
 * Saldo da conta em uma data: saldo inicial (posição no início do dia
 * `initialBalanceDate`) + efeitos das movimentações liquidadas da própria conta
 * desde então até a data (inclusive). Compras no cartão não afetam o saldo —
 * apenas o pagamento da fatura.
 * Antes da data do saldo inicial a conta não existe: saldo zero.
 */
export function computeAccountBalance(
  account: Account,
  transactions: readonly Transaction[],
  asOf: IsoDate,
): Money {
  if (asOf < account.initialBalanceDate) return Money.zero(account.initialBalance.currency);
  return transactions
    .filter(
      (tx) =>
        tx.accountId === account.id &&
        (tx.paidDate ?? tx.competenceDate) >= account.initialBalanceDate,
    )
    .reduce((balance, tx) => balance.add(getAccountEffect(tx, asOf)), account.initialBalance);
}

export interface AccountBalance {
  account: Account;
  balance: Money;
}

export function computeAccountBalances(
  accounts: readonly Account[],
  transactions: readonly Transaction[],
  asOf: IsoDate,
): AccountBalance[] {
  return accounts.map((account) => ({
    account,
    balance: computeAccountBalance(account, transactions, asOf),
  }));
}

export function sumBalances(balances: readonly AccountBalance[]): Money {
  return Money.sum(balances.map((item) => item.balance));
}
