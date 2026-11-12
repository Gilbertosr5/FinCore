import type { IsoDate } from '@/lib/dates';
import type { Money } from '@/lib/money';

export type RecurrenceFrequency =
  'daily' | 'weekly' | 'biweekly' | 'monthly' | 'bimonthly' | 'quarterly' | 'semiannual' | 'yearly';

export const RECURRENCE_FREQUENCY_LABELS: Record<RecurrenceFrequency, string> = {
  daily: 'Diária',
  weekly: 'Semanal',
  biweekly: 'Quinzenal (a cada 15 dias)',
  monthly: 'Mensal',
  bimonthly: 'Bimestral',
  quarterly: 'Trimestral',
  semiannual: 'Semestral',
  yearly: 'Anual',
};

/** Modelo usado para gerar cada ocorrência da recorrência. */
export interface RecurrenceTemplate {
  kind: 'income' | 'expense';
  description: string;
  amount: Money;
  accountId: string;
  categoryId: string | null;
  tags: string[];
  notes: string | null;
}

/**
 * Lançamento recorrente. As ocorrências são materializadas como transações
 * comuns (id determinístico `${id}_${data}`), sempre de forma idempotente:
 * nunca há duas ocorrências na mesma data.
 */
export interface Recurrence {
  id: string;
  frequency: RecurrenceFrequency;
  startDate: IsoDate;
  /** Última data possível (inclusive); null = sem data final. */
  endDate: IsoDate | null;
  template: RecurrenceTemplate;
  /** Datas de ocorrências excluídas pelo usuário (não são recriadas). */
  excludedDates: IsoDate[];
}
