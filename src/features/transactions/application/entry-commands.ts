import { addMonths, type IsoDate } from '@/lib/dates';
import { formatMoney, type Money } from '@/lib/money';

import { auditEntry, type LedgerContext } from './ledger-context';
import { recurrenceHorizon } from './recurrence-scheduler';
import type { Recurrence, RecurrenceFrequency } from '../domain/entities/recurrence';
import type { Transaction } from '../domain/entities/transaction';
import { TransactionError } from '../domain/errors/transaction-error';
import {
  assertCategoryMatches,
  assertPaidDate,
  assertUsableAccount,
  assertValidAmount,
  MAX_INSTALLMENTS,
  normalizeDescription,
  normalizeNotes,
  normalizeTags,
} from '../domain/rules/transaction-rules';
import { buildMissingOccurrences } from '../domain/services/recurrence-schedule';

export interface EntryInput {
  kind: 'income' | 'expense';
  description: string;
  /** Valor do lançamento (no parcelamento: valor TOTAL a ser dividido). */
  amount: Money;
  accountId: string;
  categoryId: string;
  competenceDate: IsoDate;
  /** Padrão: igual à competência. */
  dueDate?: IsoDate | null;
  /** Data de pagamento/recebimento; null = pendente. */
  paidDate: IsoDate | null;
  tags?: string[];
  notes?: string | null;
}

export type Repetition =
  | { type: 'none' }
  | { type: 'installments'; count: number }
  | { type: 'recurring'; frequency: RecurrenceFrequency; endDate: IsoDate | null };

/** Alcance de uma alteração em série (parcelas ou recorrência). */
export type ChangeScope = 'single' | 'following';

const KIND_LABEL = { income: 'Receita', expense: 'Despesa' } as const;

interface PreparedEntry {
  kind: 'income' | 'expense';
  description: string;
  amount: Money;
  accountId: string;
  categoryId: string;
  competenceDate: IsoDate;
  dueDate: IsoDate;
  paidDate: IsoDate | null;
  tags: string[];
  notes: string | null;
}

/** Valida e normaliza a entrada usando as regras do domínio. */
async function prepareEntry(
  context: LedgerContext,
  input: EntryInput,
  options: { allowArchivedAccountId?: string } = {},
): Promise<PreparedEntry> {
  assertValidAmount(input.amount);
  const description = normalizeDescription(input.description);
  const [account, categories] = await Promise.all([
    context.accounts.findById(input.accountId),
    context.categories.findAll(),
  ]);
  assertUsableAccount(account ?? undefined, options.allowArchivedAccountId === input.accountId);
  assertCategoryMatches(
    categories.find((category) => category.id === input.categoryId),
    input.kind,
  );
  if (input.paidDate) assertPaidDate(input.paidDate, context.today());
  const dueDate = input.dueDate ?? input.competenceDate;
  return {
    kind: input.kind,
    description,
    amount: input.amount,
    accountId: input.accountId,
    categoryId: input.categoryId,
    competenceDate: input.competenceDate,
    dueDate,
    paidDate: input.paidDate,
    tags: normalizeTags(input.tags ?? []),
    notes: normalizeNotes(input.notes),
  };
}

function toTransaction(id: string, entry: PreparedEntry): Transaction {
  return {
    id,
    kind: entry.kind,
    description: entry.description,
    amount: entry.amount,
    accountId: entry.accountId,
    categoryId: entry.categoryId,
    competenceDate: entry.competenceDate,
    dueDate: entry.dueDate,
    paidDate: entry.paidDate,
    status: entry.paidDate ? 'paid' : 'pending',
    transfer: null,
    cardPayment: null,
    investment: null,
    recurrenceId: null,
    installment: null,
    tags: entry.tags,
    notes: entry.notes,
  };
}

export function assertEditableEntry(transaction: Transaction | null): Transaction {
  if (!transaction) throw new TransactionError('not_found', 'Lançamento não encontrado.');
  if (transaction.kind === 'card_payment' || transaction.kind === 'investment') {
    throw new TransactionError(
      'not_editable',
      'Este lançamento é gerenciado pelo módulo de cartões ou de investimentos.',
    );
  }
  return transaction;
}

/** Cria receita ou despesa: avulsa, parcelada (valor total dividido) ou recorrente. */
export class CreateEntryUseCase {
  constructor(private readonly context: LedgerContext) {}

  async execute(input: EntryInput, repetition: Repetition = { type: 'none' }): Promise<string[]> {
    const entry = await prepareEntry(this.context, input);
    switch (repetition.type) {
      case 'none':
        return this.createSingle(entry);
      case 'installments':
        return this.createInstallments(entry, repetition.count);
      case 'recurring':
        return this.createRecurring(entry, repetition.frequency, repetition.endDate);
    }
  }

  private async createSingle(entry: PreparedEntry): Promise<string[]> {
    const transaction = toTransaction(this.context.newId(), entry);
    await this.context.transactions.commit({ upsert: [transaction] });
    await this.context.audit.append([
      auditEntry(
        this.context,
        'transaction',
        transaction.id,
        'created',
        `${KIND_LABEL[entry.kind]} de ${formatMoney(entry.amount)} registrada.`,
      ),
    ]);
    return [transaction.id];
  }

  private async createInstallments(entry: PreparedEntry, count: number): Promise<string[]> {
    if (!Number.isInteger(count) || count < 2 || count > MAX_INSTALLMENTS) {
      throw new TransactionError(
        'invalid_installments',
        `O número de parcelas deve estar entre 2 e ${MAX_INSTALLMENTS}.`,
      );
    }
    const groupId = this.context.newId();
    // Soma das parcelas = valor total exato (centavo residual nas primeiras).
    const transactions = entry.amount.allocate(count).map((amount, index) => ({
      ...toTransaction(this.context.newId(), {
        ...entry,
        amount,
        competenceDate: addMonths(entry.competenceDate, index),
        dueDate: addMonths(entry.dueDate, index),
        // Somente a primeira parcela pode nascer liquidada.
        paidDate: index === 0 ? entry.paidDate : null,
      }),
      installment: { groupId, number: index + 1, total: count },
    }));
    await this.context.transactions.commit({ upsert: transactions });
    await this.context.audit.append(
      transactions.map((transaction) =>
        auditEntry(
          this.context,
          'transaction',
          transaction.id,
          'created',
          `Parcela ${transaction.installment.number}/${count} de ${formatMoney(transaction.amount)} (total ${formatMoney(entry.amount)}).`,
        ),
      ),
    );
    return transactions.map((transaction) => transaction.id);
  }

  private async createRecurring(
    entry: PreparedEntry,
    frequency: RecurrenceFrequency,
    endDate: IsoDate | null,
  ): Promise<string[]> {
    if (endDate !== null && endDate < entry.competenceDate) {
      throw new TransactionError(
        'invalid_recurrence',
        'A data final da recorrência deve ser igual ou posterior à data inicial.',
      );
    }
    const recurrence: Recurrence = {
      id: this.context.newId(),
      frequency,
      startDate: entry.competenceDate,
      endDate,
      template: {
        kind: entry.kind,
        description: entry.description,
        amount: entry.amount,
        accountId: entry.accountId,
        categoryId: entry.categoryId,
        tags: entry.tags,
        notes: entry.notes,
      },
      excludedDates: [],
    };
    const occurrences = buildMissingOccurrences(
      recurrence,
      [],
      recurrenceHorizon(this.context.today()),
    ).map((occurrence, index) =>
      index === 0 && entry.paidDate
        ? { ...occurrence, status: 'paid' as const, paidDate: entry.paidDate }
        : occurrence,
    );
    await this.context.transactions.commit({
      upsertRecurrences: [recurrence],
      upsert: occurrences,
    });
    await this.context.audit.append([
      auditEntry(
        this.context,
        'recurrence',
        recurrence.id,
        'created',
        `Recorrência criada com ${occurrences.length} ocorrência(s) iniciais.`,
      ),
    ]);
    return occurrences.map((occurrence) => occurrence.id);
  }
}

/**
 * Edita receita/despesa. Em séries, `following` aplica a alteração a esta e às
 * próximas ocorrências/parcelas ainda pendentes (as já pagas são preservadas).
 */
export class UpdateEntryUseCase {
  constructor(private readonly context: LedgerContext) {}

  async execute(id: string, input: EntryInput, scope: ChangeScope = 'single'): Promise<void> {
    const current = assertEditableEntry(await this.context.transactions.findById(id));
    if (current.kind === 'transfer') {
      throw new TransactionError('not_editable', 'Use a edição de transferência.');
    }
    const entry = await prepareEntry(this.context, input, {
      allowArchivedAccountId: current.accountId,
    });
    const updated: Transaction = {
      ...toTransaction(current.id, entry),
      recurrenceId: current.recurrenceId,
      installment: current.installment,
    };

    const upsert: Transaction[] = [updated];
    const upsertRecurrences: Recurrence[] = [];

    if (scope === 'following' && (current.installment ?? current.recurrenceId)) {
      const all = await this.context.transactions.findAll();
      const followers = all.filter(
        (tx) =>
          tx.id !== current.id &&
          tx.status === 'pending' &&
          (current.installment
            ? tx.installment?.groupId === current.installment.groupId &&
              tx.installment.number > current.installment.number
            : tx.recurrenceId === current.recurrenceId &&
              tx.competenceDate > current.competenceDate),
      );
      for (const follower of followers) {
        upsert.push({
          ...follower,
          kind: entry.kind,
          description: entry.description,
          amount: entry.amount,
          accountId: entry.accountId,
          categoryId: entry.categoryId,
          tags: entry.tags,
          notes: entry.notes,
        });
      }
      if (current.recurrenceId) {
        const recurrence = (await this.context.transactions.findRecurrences()).find(
          (item) => item.id === current.recurrenceId,
        );
        if (recurrence) {
          upsertRecurrences.push({
            ...recurrence,
            template: {
              ...recurrence.template,
              kind: entry.kind,
              description: entry.description,
              amount: entry.amount,
              accountId: entry.accountId,
              categoryId: entry.categoryId,
              tags: entry.tags,
              notes: entry.notes,
            },
          });
        }
      }
    }

    await this.context.transactions.commit({ upsert, upsertRecurrences });
    await this.context.audit.append(
      upsert.map((tx) =>
        auditEntry(
          this.context,
          'transaction',
          tx.id,
          'updated',
          tx.id === current.id
            ? describeChanges(current, updated)
            : 'Alterado junto com a série (esta e as próximas).',
        ),
      ),
    );
  }
}

function describeChanges(before: Transaction, after: Transaction): string {
  const changes: string[] = [];
  if (!before.amount.equals(after.amount)) {
    changes.push(`valor ${formatMoney(before.amount)} → ${formatMoney(after.amount)}`);
  }
  if (before.description !== after.description) changes.push('descrição');
  if (before.categoryId !== after.categoryId) changes.push('categoria');
  if (before.accountId !== after.accountId) changes.push('conta');
  if (before.competenceDate !== after.competenceDate || before.dueDate !== after.dueDate) {
    changes.push('datas');
  }
  if (before.status !== after.status) changes.push('situação');
  return changes.length > 0
    ? `Alterado: ${changes.join(', ')}.`
    : 'Salvo sem alterações relevantes.';
}
