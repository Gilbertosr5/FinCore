import type { AuditEntry, AuditLogRepository } from '@/features/history/domain/audit-entry';
import type { Transaction } from '@/features/transactions/domain/entities/transaction';
import type { TransactionRepository } from '@/features/transactions/domain/repositories/transaction.repository';
import {
  getAccountEffect,
  isSettledBy,
} from '@/features/transactions/domain/rules/transaction-effects';
import { addDays, type IsoDate } from '@/lib/dates';
import { DomainError } from '@/lib/errors/domain-error';
import { formatMoney, Money } from '@/lib/money';

import type { Account, AccountType } from '../domain/entities/account';
import type { AccountRepository } from '../domain/repositories/account.repository';
import { computeAccountBalance } from '../domain/services/account-balance';

export interface AccountContext {
  accounts: AccountRepository;
  transactions: TransactionRepository;
  audit: AuditLogRepository;
  newId: () => string;
  today: () => IsoDate;
  now: () => string;
  /** Garante as ocorrências de recorrências antes de calcular saldos. */
  prepare?: () => Promise<unknown>;
}

export interface AccountInput {
  name: string;
  type: AccountType;
  institution: string | null;
  /** Pode ser negativo (ex.: conta que começa no cheque especial). */
  initialBalance: Money;
  initialBalanceDate: IsoDate;
}

export const ACCOUNT_NAME_MAX_LENGTH = 60;

export class AccountError extends DomainError<'invalid_name' | 'not_found' | 'invalid_balance'> {
  constructor(code: 'invalid_name' | 'not_found' | 'invalid_balance', message: string) {
    super(code, message);
    this.name = 'AccountError';
  }
}

function audit(
  context: AccountContext,
  entityId: string,
  action: AuditEntry['action'],
  summary: string,
): AuditEntry {
  return {
    id: context.newId(),
    entityType: 'account',
    entityId,
    action,
    at: context.now(),
    summary,
  };
}

function normalizeInput(input: AccountInput): AccountInput {
  const name = input.name.trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > ACCOUNT_NAME_MAX_LENGTH) {
    throw new AccountError(
      'invalid_name',
      `O nome da conta deve ter entre 2 e ${ACCOUNT_NAME_MAX_LENGTH} caracteres.`,
    );
  }
  if (input.initialBalance.abs().greaterThan(Money.of('999999999.99'))) {
    throw new AccountError('invalid_balance', 'O saldo inicial excede o máximo permitido.');
  }
  const institution = input.institution?.trim() ?? '';
  return { ...input, name, institution: institution === '' ? null : institution };
}

export class CreateAccountUseCase {
  constructor(private readonly context: AccountContext) {}

  async execute(input: AccountInput): Promise<Account> {
    const normalized = normalizeInput(input);
    const account: Account = { id: this.context.newId(), ...normalized, archived: false };
    await this.context.accounts.save(account);
    await this.context.audit.append([
      audit(
        this.context,
        account.id,
        'created',
        `Conta criada com saldo inicial de ${formatMoney(account.initialBalance)}.`,
      ),
    ]);
    return account;
  }
}

export class UpdateAccountUseCase {
  constructor(private readonly context: AccountContext) {}

  async execute(id: string, input: AccountInput): Promise<void> {
    const current = await this.context.accounts.findById(id);
    if (!current) throw new AccountError('not_found', 'Conta não encontrada.');
    const normalized = normalizeInput(input);
    await this.context.accounts.save({ ...current, ...normalized });
    const balanceChanged =
      !current.initialBalance.equals(normalized.initialBalance) ||
      current.initialBalanceDate !== normalized.initialBalanceDate;
    await this.context.audit.append([
      audit(
        this.context,
        id,
        'updated',
        balanceChanged
          ? `Saldo inicial alterado de ${formatMoney(current.initialBalance)} para ${formatMoney(normalized.initialBalance)}.`
          : 'Dados da conta alterados.',
      ),
    ]);
  }
}

/** Contas arquivadas saem dos totais e das seleções, mas o histórico é preservado. */
export class SetAccountArchivedUseCase {
  constructor(private readonly context: AccountContext) {}

  async execute(id: string, archived: boolean): Promise<void> {
    const current = await this.context.accounts.findById(id);
    if (!current) throw new AccountError('not_found', 'Conta não encontrada.');
    await this.context.accounts.save({ ...current, archived });
    await this.context.audit.append([
      audit(
        this.context,
        id,
        archived ? 'archived' : 'restored',
        archived ? 'Conta arquivada.' : 'Conta restaurada.',
      ),
    ]);
  }
}

export interface AccountSummary {
  account: Account;
  balance: Money;
  /** Saídas pendentes (a pagar) e entradas pendentes (a receber) da conta. */
  pendingOut: Money;
  pendingIn: Money;
  /** Saldo previsto após liquidar os pendentes. */
  projectedBalance: Money;
}

function pendingEffect(transaction: Transaction): Money {
  // Efeito que o lançamento terá quando for liquidado.
  return getAccountEffect(
    { ...transaction, status: 'paid', paidDate: transaction.competenceDate },
    transaction.competenceDate,
  );
}

export class ListAccountsUseCase {
  constructor(private readonly context: AccountContext) {}

  async execute(): Promise<AccountSummary[]> {
    await this.context.prepare?.();
    const today = this.context.today();
    const [accounts, transactions] = await Promise.all([
      this.context.accounts.findAll(),
      this.context.transactions.findAll(),
    ]);
    return accounts
      .map((account) => {
        const pending = transactions.filter(
          (tx) => tx.accountId === account.id && tx.status === 'pending',
        );
        const effects = pending.map(pendingEffect);
        const pendingIn = Money.sum(effects.filter((value) => value.isPositive()));
        const pendingOut = Money.sum(effects.filter((value) => value.isNegative())).abs();
        const balance = computeAccountBalance(account, transactions, today);
        return {
          account,
          balance,
          pendingIn,
          pendingOut,
          projectedBalance: balance.add(pendingIn).subtract(pendingOut),
        };
      })
      .sort(
        (a, b) =>
          Number(a.account.archived) - Number(b.account.archived) ||
          a.account.name.localeCompare(b.account.name, 'pt-BR'),
      );
  }
}

export interface StatementLine {
  transaction: Transaction;
  /** Efeito no saldo (positivo = entrada). */
  effect: Money;
  /** Saldo após este lançamento. */
  balance: Money;
}

export interface AccountStatement {
  account: Account;
  start: IsoDate;
  end: IsoDate;
  openingBalance: Money;
  closingBalance: Money;
  totalIn: Money;
  totalOut: Money;
  lines: StatementLine[];
  /** Pendentes com vencimento no período (não afetam o saldo). */
  pending: Transaction[];
}

/**
 * Extrato: movimentações LIQUIDADAS no período, pela data de pagamento, com
 * saldo acumulado. Pendentes são listados à parte; cancelados não aparecem.
 */
export class GetAccountStatementUseCase {
  constructor(private readonly context: AccountContext) {}

  async execute(accountId: string, start: IsoDate, end: IsoDate): Promise<AccountStatement> {
    await this.context.prepare?.();
    const [account, transactions] = await Promise.all([
      this.context.accounts.findById(accountId),
      this.context.transactions.findAll(),
    ]);
    if (!account) throw new AccountError('not_found', 'Conta não encontrada.');
    const own = transactions.filter((tx) => tx.accountId === accountId);
    const today = this.context.today();
    const effectiveEnd = end < today ? end : today;

    const openingBalance = computeAccountBalance(account, own, addDays(start, -1));
    const settled = own
      .filter(
        (tx) =>
          isSettledBy(tx, effectiveEnd) &&
          tx.paidDate !== null &&
          tx.paidDate >= start &&
          tx.paidDate >= account.initialBalanceDate,
      )
      .sort((a, b) =>
        (a.paidDate ?? '') === (b.paidDate ?? '')
          ? a.id.localeCompare(b.id)
          : (a.paidDate ?? '') < (b.paidDate ?? '')
            ? -1
            : 1,
      );

    let running = openingBalance;
    const lines = settled.map((transaction) => {
      const effect = getAccountEffect(transaction, effectiveEnd);
      running = running.add(effect);
      return { transaction, effect, balance: running };
    });

    return {
      account,
      start,
      end,
      openingBalance,
      closingBalance: running,
      totalIn: Money.sum(lines.map((line) => line.effect).filter((value) => value.isPositive())),
      totalOut: Money.sum(
        lines.map((line) => line.effect).filter((value) => value.isNegative()),
      ).abs(),
      lines,
      pending: own
        .filter(
          (tx) =>
            tx.status === 'pending' &&
            (tx.dueDate ?? tx.competenceDate) >= start &&
            (tx.dueDate ?? tx.competenceDate) <= end,
        )
        .sort((a, b) => ((a.dueDate ?? '') < (b.dueDate ?? '') ? -1 : 1)),
    };
  }
}

export interface AccountUseCases {
  list: ListAccountsUseCase;
  statement: GetAccountStatementUseCase;
  create: CreateAccountUseCase;
  update: UpdateAccountUseCase;
  setArchived: SetAccountArchivedUseCase;
}

export function createAccountUseCases(context: AccountContext): AccountUseCases {
  return {
    list: new ListAccountsUseCase(context),
    statement: new GetAccountStatementUseCase(context),
    create: new CreateAccountUseCase(context),
    update: new UpdateAccountUseCase(context),
    setArchived: new SetAccountArchivedUseCase(context),
  };
}
