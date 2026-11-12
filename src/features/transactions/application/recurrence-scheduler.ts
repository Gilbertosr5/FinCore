import { addMonths, endOfMonth, type IsoDate } from '@/lib/dates';

import type { LedgerContext } from './ledger-context';
import type { Recurrence } from '../domain/entities/recurrence';
import type { Transaction } from '../domain/entities/transaction';
import { buildMissingOccurrences } from '../domain/services/recurrence-schedule';

/** Ocorrências são geradas até o fim do mês seguinte ao atual. */
export function recurrenceHorizon(today: IsoDate): IsoDate {
  return endOfMonth(addMonths(today, 1));
}

export function missingOccurrences(
  recurrences: readonly Recurrence[],
  transactions: readonly Transaction[],
  until: IsoDate,
): Transaction[] {
  return recurrences.flatMap((recurrence) =>
    buildMissingOccurrences(recurrence, transactions, until),
  );
}

/**
 * Garante que as ocorrências das recorrências existam até o horizonte.
 * Idempotente (ids determinísticos) e executado no máximo uma vez por dia —
 * chamadas simultâneas compartilham a mesma execução.
 */
export class RecurrenceScheduler {
  private lastRunDate: IsoDate | null = null;
  private inFlight: Promise<number> | null = null;

  constructor(private readonly context: Pick<LedgerContext, 'transactions' | 'today'>) {}

  /** Retorna quantas ocorrências foram criadas. */
  ensure(): Promise<number> {
    const today = this.context.today();
    if (this.lastRunDate === today) return Promise.resolve(0);
    this.inFlight ??= this.run(today).finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  /** Força nova verificação (após alterar recorrências ou restaurar dados). */
  invalidate(): void {
    this.lastRunDate = null;
  }

  private async run(today: IsoDate): Promise<number> {
    const [recurrences, transactions] = await Promise.all([
      this.context.transactions.findRecurrences(),
      this.context.transactions.findAll(),
    ]);
    const created = missingOccurrences(recurrences, transactions, recurrenceHorizon(today));
    if (created.length > 0) await this.context.transactions.commit({ upsert: created });
    this.lastRunDate = today;
    return created.length;
  }
}
