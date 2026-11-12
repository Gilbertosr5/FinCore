import { addDays, addMonths, type IsoDate } from '@/lib/dates';

import type { Recurrence, RecurrenceFrequency } from '../entities/recurrence';
import type { Transaction } from '../entities/transaction';

/**
 * Agenda de recorrências.
 *
 * - A n-ésima ocorrência é calculada SEMPRE a partir da data inicial (não da
 *   ocorrência anterior): mensal a partir de 31/01 → 28/02, 31/03, 30/04...
 *   sem "derivar" o dia.
 * - Quinzenal = a cada 15 dias.
 * - A materialização é idempotente: ocorrências já existentes (mesma
 *   recorrência e data) ou excluídas pelo usuário nunca são recriadas.
 */

const DAY_STEP: Partial<Record<RecurrenceFrequency, number>> = {
  daily: 1,
  weekly: 7,
  biweekly: 15,
};

const MONTH_STEP: Partial<Record<RecurrenceFrequency, number>> = {
  monthly: 1,
  bimonthly: 2,
  quarterly: 3,
  semiannual: 6,
  yearly: 12,
};

/** Limite de segurança contra configurações que gerariam volume excessivo. */
export const MAX_OCCURRENCES_PER_RUN = 1000;

export function occurrenceDate(
  recurrence: Pick<Recurrence, 'frequency' | 'startDate'>,
  index: number,
): IsoDate {
  const days = DAY_STEP[recurrence.frequency];
  if (days !== undefined) return addDays(recurrence.startDate, days * index);
  const months = MONTH_STEP[recurrence.frequency] ?? 1;
  return addMonths(recurrence.startDate, months * index);
}

/** Datas de ocorrência entre a data inicial e min(data final, `until`), inclusive. */
export function listOccurrenceDates(
  recurrence: Pick<Recurrence, 'frequency' | 'startDate' | 'endDate'>,
  until: IsoDate,
): IsoDate[] {
  const limit =
    recurrence.endDate !== null && recurrence.endDate < until ? recurrence.endDate : until;
  const dates: IsoDate[] = [];
  for (let index = 0; index < MAX_OCCURRENCES_PER_RUN; index++) {
    const date = occurrenceDate(recurrence, index);
    if (date > limit) break;
    dates.push(date);
  }
  return dates;
}

export function occurrenceId(recurrenceId: string, date: IsoDate): string {
  return `${recurrenceId}_${date}`;
}

/**
 * Ocorrências que ainda não existem até `until`. Novas ocorrências nascem
 * pendentes; o pagamento é sempre uma ação explícita do usuário.
 */
export function buildMissingOccurrences(
  recurrence: Recurrence,
  existing: readonly Transaction[],
  until: IsoDate,
): Transaction[] {
  const taken = new Set(
    existing.filter((tx) => tx.recurrenceId === recurrence.id).map((tx) => tx.competenceDate),
  );
  for (const date of recurrence.excludedDates) taken.add(date);

  return listOccurrenceDates(recurrence, until)
    .filter((date) => !taken.has(date))
    .map((date) => ({
      id: occurrenceId(recurrence.id, date),
      kind: recurrence.template.kind,
      description: recurrence.template.description,
      amount: recurrence.template.amount,
      accountId: recurrence.template.accountId,
      categoryId: recurrence.template.categoryId,
      competenceDate: date,
      dueDate: date,
      paidDate: null,
      status: 'pending',
      transfer: null,
      cardPayment: null,
      investment: null,
      recurrenceId: recurrence.id,
      installment: null,
      tags: [...recurrence.template.tags],
      notes: recurrence.template.notes,
    }));
}
