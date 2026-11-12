import type { IsoDate } from '@/lib/dates';
import { formatMoney, type Money } from '@/lib/money';

import { auditEntry, type LedgerContext } from './ledger-context';
import type { Transaction } from '../domain/entities/transaction';
import { TransactionError } from '../domain/errors/transaction-error';
import {
  assertUsableAccount,
  assertValidAmount,
  normalizeDescription,
  normalizeNotes,
} from '../domain/rules/transaction-rules';

export interface TransferInput {
  fromAccountId: string;
  toAccountId: string;
  amount: Money;
  date: IsoDate;
  description?: string;
  notes?: string | null;
}

/**
 * Transferência = duas movimentações (saída e entrada) com o mesmo valor,
 * gravadas atomicamente. Datas futuras ficam agendadas (pendentes).
 * Nunca é receita nem despesa (ver ADR 0007).
 */
function buildLegs(
  transferId: string,
  input: TransferInput,
  description: string,
  notes: string | null,
  today: IsoDate,
): Transaction[] {
  const settled = input.date <= today;
  const base = {
    kind: 'transfer' as const,
    description,
    amount: input.amount,
    categoryId: null,
    competenceDate: input.date,
    dueDate: input.date,
    paidDate: settled ? input.date : null,
    status: settled ? ('paid' as const) : ('pending' as const),
    cardPayment: null,
    investment: null,
    recurrenceId: null,
    installment: null,
    tags: [],
    notes,
  };
  return [
    {
      ...base,
      id: `${transferId}_out`,
      accountId: input.fromAccountId,
      transfer: { id: transferId, direction: 'out', counterpartAccountId: input.toAccountId },
    },
    {
      ...base,
      id: `${transferId}_in`,
      accountId: input.toAccountId,
      transfer: { id: transferId, direction: 'in', counterpartAccountId: input.fromAccountId },
    },
  ];
}

async function validate(
  context: LedgerContext,
  input: TransferInput,
  allowArchived: string[] = [],
) {
  if (input.fromAccountId === input.toAccountId) {
    throw new TransactionError(
      'same_account_transfer',
      'Escolha contas de origem e destino diferentes.',
    );
  }
  assertValidAmount(input.amount);
  const [from, to] = await Promise.all([
    context.accounts.findById(input.fromAccountId),
    context.accounts.findById(input.toAccountId),
  ]);
  assertUsableAccount(from ?? undefined, allowArchived.includes(input.fromAccountId));
  assertUsableAccount(to ?? undefined, allowArchived.includes(input.toAccountId));
  const customDescription = input.description?.trim() ?? '';
  return {
    description: normalizeDescription(
      customDescription ? customDescription : 'Transferência entre contas',
    ),
    notes: normalizeNotes(input.notes),
  };
}

export class CreateTransferUseCase {
  constructor(private readonly context: LedgerContext) {}

  async execute(input: TransferInput): Promise<string> {
    const { description, notes } = await validate(this.context, input);
    const transferId = this.context.newId();
    const legs = buildLegs(transferId, input, description, notes, this.context.today());
    await this.context.transactions.commit({ upsert: legs });
    await this.context.audit.append(
      legs.map((leg) =>
        auditEntry(
          this.context,
          'transaction',
          leg.id,
          'created',
          `Transferência de ${formatMoney(input.amount)} registrada.`,
        ),
      ),
    );
    return transferId;
  }
}

export class UpdateTransferUseCase {
  constructor(private readonly context: LedgerContext) {}

  async execute(transferId: string, input: TransferInput): Promise<void> {
    const legs = (await this.context.transactions.findAll()).filter(
      (tx) => tx.transfer?.id === transferId,
    );
    if (legs.length === 0) throw new TransactionError('not_found', 'Transferência não encontrada.');
    const { description, notes } = await validate(
      this.context,
      input,
      legs.map((leg) => leg.accountId),
    );
    const updated = buildLegs(transferId, input, description, notes, this.context.today());
    // Ids das pernas podem ter outro formato (ex.: dados importados): remove as antigas.
    const updatedIds = new Set(updated.map((leg) => leg.id));
    await this.context.transactions.commit({
      upsert: updated,
      remove: legs.map((leg) => leg.id).filter((id) => !updatedIds.has(id)),
    });
    await this.context.audit.append(
      updated.map((leg) =>
        auditEntry(
          this.context,
          'transaction',
          leg.id,
          'updated',
          `Transferência alterada para ${formatMoney(input.amount)}.`,
        ),
      ),
    );
  }
}
