import { format as formatDateFns } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { addMonths, daysInMonth, getDateParts, toIsoDate, type IsoDate } from './iso-date';

/**
 * Mês de referência "YYYY-MM" (competência, fatura, orçamento mensal).
 * Comparável lexicograficamente, como IsoDate.
 */
declare const monthKeyBrand: unique symbol;
export type MonthKey = string & { readonly [monthKeyBrand]: true };

const MONTH_KEY_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function isMonthKey(value: string): value is MonthKey {
  return MONTH_KEY_PATTERN.test(value);
}

export function asMonthKey(value: string): MonthKey {
  if (!isMonthKey(value)) throw new Error(`Mês inválido: "${value}"`);
  return value;
}

export function toMonthKey(date: IsoDate): MonthKey {
  return date.slice(0, 7) as MonthKey;
}

function monthKeyParts(month: MonthKey): { year: number; month: number } {
  const [year, monthNumber] = month.split('-').map(Number);
  return { year: year ?? 0, month: monthNumber ?? 0 };
}

export function monthStart(month: MonthKey): IsoDate {
  const parts = monthKeyParts(month);
  return toIsoDate({ ...parts, day: 1 });
}

export function monthEnd(month: MonthKey): IsoDate {
  const parts = monthKeyParts(month);
  return toIsoDate({ ...parts, day: daysInMonth(parts.year, parts.month) });
}

/** Dia do mês ajustado ao último dia quando não existe (ex.: dia 31 em fevereiro). */
export function dayOfMonth(month: MonthKey, day: number): IsoDate {
  const parts = monthKeyParts(month);
  return toIsoDate({
    ...parts,
    day: Math.min(Math.max(day, 1), daysInMonth(parts.year, parts.month)),
  });
}

export function addMonthsToKey(month: MonthKey, amount: number): MonthKey {
  return toMonthKey(addMonths(monthStart(month), amount));
}

/** Meses de `start` a `end`, inclusive, em ordem crescente. */
export function monthKeysBetween(start: MonthKey, end: MonthKey): MonthKey[] {
  const months: MonthKey[] = [];
  for (let current = start; current <= end; current = addMonthsToKey(current, 1)) {
    months.push(current);
  }
  return months;
}

/** Quantidade de viradas de mês entre duas datas (31/01 → 01/02 = 1). */
export function differenceInCalendarMonths(later: IsoDate, earlier: IsoDate): number {
  const a = getDateParts(later);
  const b = getDateParts(earlier);
  return (a.year - b.year) * 12 + (a.month - b.month);
}

/** "2026-03" → "mar/26" (eixos de gráfico). */
export function formatMonthShort(month: MonthKey): string {
  const { year, month: monthNumber } = monthKeyParts(month);
  return formatDateFns(new Date(year, monthNumber - 1, 1, 12), 'MMM/yy', { locale: ptBR });
}

/** "2026-03" → "março de 2026". */
export function formatMonthLong(month: MonthKey): string {
  const { year, month: monthNumber } = monthKeyParts(month);
  return formatDateFns(new Date(year, monthNumber - 1, 1, 12), "MMMM 'de' yyyy", { locale: ptBR });
}
