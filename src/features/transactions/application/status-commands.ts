import { addDays, formatDateBR, type IsoDate } from '@/lib/dates';

import { assertEditableEntry, type ChangeScope } from './entry-commands';
import { auditEntry, type LedgerContext } from './ledger-context';
import type { Recurrence } from '../domain/entities/recurrence';
import type { Transaction } from '../domain/entities/transaction';
import { TransactionError } from '../domain/errors/transaction-error';
import { assertPaidDate } from '../domain/rules/transaction-rules';

/**
 * Lançamentos afetados por uma ação:
 * - transferência: sempre as duas pernas;
 * - `following` em parcelamento: esta e as parcelas seguintes;
 * - `following` em recorrência: esta e as ocorrências posteriores;
 * - caso contrário: somente o lançamento.
 */
export function resolveAffected(
  target: Transaction,
  all: readonly Transaction[],
  scope: ChangeScope,
): Transaction[] {
  if (target.transfer) return all.filter((tx) => tx.transfer?.id === target.transfer?.id);
  if (scope === 'following' && target.installment) {
    const { groupId, number } = target.installment;
    return all.filter(
      (tx) => tx.installment?.groupId === groupId && tx.installment.number >= number,
    );
  }
  if (scope === 'following' && target.recurrenceId) {
    return all.filter(
      (tx) => tx.recurrenceId === target.recurrenceId && tx.competenceDate >= target.competenceDate,
    );
  }
  return [target];
}

async function loadTarget(context: LedgerContext, id: string) {
  const target = assertEditableEntry(await context.transactions.findById(id));
  const all = await context.transactions.findAll();
  return { target, all };
}

/** Encerra a recorrência na véspera de `date` (ou a remove, se nunca começou). */
function stopRecurrenceBefore(
  recurrences: readonly Recurrence[],
  recurrenceId: string,
  date: IsoDate,
): { upsert: Recurrence[]; remove: string[] } {
  const recurrence = recurrences.find((item) => item.id === recurrenceId);
  if (!recurrence) return { upsert: [], remove: [] };
  const endDate = addDays(date, -1);
  if (endDate < recurrence.startDate) return { upsert: [], remove: [recurrence.id] };
  return { upsert: [{ ...recurrence, endDate }], remove: [] };
}

/** Marca como pago (despesa) ou recebido (receita/transferência). */
export class MarkAsPaidUseCase {
  constructor(private readonly context: LedgerContext) {}

  async execute(id: string, paidDate: IsoDate): Promise<void> {
    assertPaidDate(paidDate, this.context.today());
    const { target, all } = await loadTarget(this.context, id);
    if (target.status === 'cancelled') {
      throw new TransactionError(
        'invalid_status_change',
        'Lançamentos cancelados não podem ser liquidados. Reative-o antes.',
      );
    }
    const affected = resolveAffected(target, all, 'single').map((tx) => ({
      ...tx,
      status: 'paid' as const,
      paidDate,
    }));
    await this.context.transactions.commit({ upsert: affected });
    await this.context.audit.append(
      affected.map((tx) =>
        auditEntry(
          this.context,
          'transaction',
          tx.id,
          'paid',
          `${tx.kind === 'income' ? 'Recebido' : 'Pago'} em ${formatDateBR(paidDate)}.`,
        ),
      ),
    );
  }
}

/** Volta a pendente (desfaz pagamento ou reativa um lançamento cancelado). */
export class MarkAsPendingUseCase {
  constructor(private readonly context: LedgerContext) {}

  async execute(id: string): Promise<void> {
    const { target, all } = await loadTarget(this.context, id);
    const action = target.status === 'cancelled' ? 'restored' : 'unpaid';
    const affected = resolveAffected(target, all, 'single').map((tx) => ({
      ...tx,
      status: 'pending' as const,
      paidDate: null,
    }));
    await this.context.transactions.commit({ upsert: affected });
    await this.context.audit.append(
      affected.map((tx) =>
        auditEntry(
          this.context,
          'transaction',
          tx.id,
          action,
          action === 'restored' ? 'Lançamento reativado como pendente.' : 'Pagamento desfeito.',
        ),
      ),
    );
  }
}

/**
 * Cancela: o lançamento permanece no histórico, sem efeito em saldo ou
 * indicadores. Em séries com `following`, cancela as próximas pendentes e
 * encerra a recorrência.
 */
export class CancelTransactionUseCase {
  constructor(private readonly context: LedgerContext) {}

  async execute(id: string, scope: ChangeScope = 'single'): Promise<void> {
    const { target, all } = await loadTarget(this.context, id);
    const affected = resolveAffected(target, all, scope)
      .filter((tx) => tx.id === target.id || tx.transfer !== null || tx.status !== 'paid')
      .map((tx) => ({ ...tx, status: 'cancelled' as const, paidDate: null }));

    let recurrenceChanges = { upsert: [] as Recurrence[], remove: [] as string[] };
    if (scope === 'following' && target.recurrenceId) {
      recurrenceChanges = stopRecurrenceBefore(
        await this.context.transactions.findRecurrences(),
        target.recurrenceId,
        target.competenceDate,
      );
    }

    await this.context.transactions.commit({
      upsert: affected,
      upsertRecurrences: recurrenceChanges.upsert,
      removeRecurrences: recurrenceChanges.remove,
    });
    await this.context.audit.append(
      affected.map((tx) =>
        auditEntry(this.context, 'transaction', tx.id, 'cancelled', 'Lançamento cancelado.'),
      ),
    );
  }
}

/**
 * Exclui definitivamente. Ocorrência única de recorrência é registrada como
 * exceção (não volta a ser gerada); `following` encerra a recorrência.
 * Lançamentos já pagos de uma série só são excluídos se forem o alvo.
 */
export class DeleteTransactionUseCase {
  constructor(private readonly context: LedgerContext) {}

  async execute(id: string, scope: ChangeScope = 'single'): Promise<void> {
    const { target, all } = await loadTarget(this.context, id);
    const affected = resolveAffected(target, all, scope).filter(
      (tx) => tx.id === target.id || tx.transfer !== null || tx.status !== 'paid',
    );

    const upsertRecurrences: Recurrence[] = [];
    const removeRecurrences: string[] = [];
    if (target.recurrenceId) {
      const recurrences = await this.context.transactions.findRecurrences();
      if (scope === 'following') {
        const stop = stopRecurrenceBefore(recurrences, target.recurrenceId, target.competenceDate);
        upsertRecurrences.push(...stop.upsert);
        removeRecurrences.push(...stop.remove);
      } else {
        const recurrence = recurrences.find((item) => item.id === target.recurrenceId);
        if (recurrence) {
          upsertRecurrences.push({
            ...recurrence,
            excludedDates: [...new Set([...recurrence.excludedDates, target.competenceDate])],
          });
        }
      }
    }

    await this.context.transactions.commit({
      remove: affected.map((tx) => tx.id),
      upsertRecurrences,
      removeRecurrences,
    });
    await this.context.audit.append(
      affected.map((tx) =>
        auditEntry(this.context, 'transaction', tx.id, 'deleted', `Excluído: ${tx.description}.`),
      ),
    );
  }
}
