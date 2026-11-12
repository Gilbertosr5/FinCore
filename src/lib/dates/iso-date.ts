import { format as formatDateFns } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Datas de calendário do FinCore (competência, vencimento, pagamento...).
 *
 * Estratégia (ver docs/adr/0004-datas-e-fuso-horario.md):
 * - Datas de calendário são strings ISO "YYYY-MM-DD" (tipo `IsoDate`), sem hora e
 *   sem fuso. Isso elimina bugs de conversão UTC x horário local (ex.: um
 *   vencimento em 01/03 virar 28/02 ao ser serializado com `toISOString()`).
 * - A aritmética de calendário é feita sobre componentes (ano/mês/dia) usando
 *   apenas métodos UTC internamente, portanto independente do fuso da máquina.
 * - "Hoje" é sempre calculado para um fuso IANA explícito (configurável).
 * - Instantes (ex.: createdAt) são outra coisa: strings ISO 8601 com offset.
 */

declare const isoDateBrand: unique symbol;
export type IsoDate = string & { readonly [isoDateBrand]: true };

export interface DateParts {
  year: number;
  /** 1–12 */
  month: number;
  /** 1–31 */
  day: number;
}

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const BR_DATE_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})$/;

export class InvalidDateError extends Error {
  constructor(value: string) {
    super(`Data inválida: "${value}"`);
    this.name = 'InvalidDateError';
  }
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function isValidParts({ year, month, day }: DateParts): boolean {
  return (
    Number.isInteger(year) &&
    Number.isInteger(month) &&
    Number.isInteger(day) &&
    year >= 1000 && // Date.UTC trata anos 0–99 como 1900–1999
    year <= 9999 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth(year, month)
  );
}

const pad = (value: number, length = 2) => String(value).padStart(length, '0');

export function toIsoDate(parts: DateParts): IsoDate {
  if (!isValidParts(parts)) {
    throw new InvalidDateError(`${parts.year}-${parts.month}-${parts.day}`);
  }
  return `${pad(parts.year, 4)}-${pad(parts.month)}-${pad(parts.day)}` as IsoDate;
}

export function isIsoDate(value: string): value is IsoDate {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) return false;
  return isValidParts({ year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) });
}

/** Valida e converte uma string para IsoDate, lançando erro se inválida. */
export function asIsoDate(value: string): IsoDate {
  if (!isIsoDate(value)) throw new InvalidDateError(value);
  return value;
}

export function getDateParts(date: IsoDate): DateParts {
  const [year, month, day] = date.split('-').map(Number);
  return { year: year ?? 0, month: month ?? 0, day: day ?? 0 };
}

/** Data de calendário atual no fuso informado (ex.: 'America/Sao_Paulo'). */
export function todayIn(timeZone: string, now: Date = new Date()): IsoDate {
  // 'en-CA' formata como YYYY-MM-DD.
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return asIsoDate(formatted);
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** "2026-03-01" => "01/03/2026" */
export function formatDateBR(date: IsoDate): string {
  const { year, month, day } = getDateParts(date);
  return `${pad(day)}/${pad(month)}/${pad(year, 4)}`;
}

/** "01/03/2026" => "2026-03-01" (ou null se inválida, ex.: 30/02/2026). */
export function parseDateBR(value: string): IsoDate | null {
  const match = BR_DATE_PATTERN.exec(value.trim());
  if (!match) return null;
  const parts = { day: Number(match[1]), month: Number(match[2]), year: Number(match[3]) };
  return isValidParts(parts) ? toIsoDate(parts) : null;
}

function toUtcDate(date: IsoDate): Date {
  const { year, month, day } = getDateParts(date);
  return new Date(Date.UTC(year, month - 1, day));
}

function fromUtcDate(date: Date): IsoDate {
  return toIsoDate({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  });
}

export function addDays(date: IsoDate, amount: number): IsoDate {
  const utc = toUtcDate(date);
  utc.setUTCDate(utc.getUTCDate() + amount);
  return fromUtcDate(utc);
}

/**
 * Soma meses preservando o dia quando possível e ajustando ao último dia do mês
 * quando necessário: 31/01 + 1 mês = 28/02 (ou 29/02 em ano bissexto).
 */
export function addMonths(date: IsoDate, amount: number): IsoDate {
  const { year, month, day } = getDateParts(date);
  const monthIndex = year * 12 + (month - 1) + amount;
  const targetYear = Math.floor(monthIndex / 12);
  const targetMonth = (monthIndex % 12) + 1;
  return toIsoDate({
    year: targetYear,
    month: targetMonth,
    day: Math.min(day, daysInMonth(targetYear, targetMonth)),
  });
}

export function addYears(date: IsoDate, amount: number): IsoDate {
  return addMonths(date, amount * 12);
}

/** Comparação lexicográfica é válida para o formato ISO de largura fixa. */
export function compareIsoDates(a: IsoDate, b: IsoDate): -1 | 0 | 1 {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function isBefore(a: IsoDate, b: IsoDate): boolean {
  return a < b;
}

export function isAfter(a: IsoDate, b: IsoDate): boolean {
  return a > b;
}

export function isWithinRange(date: IsoDate, start: IsoDate, end: IsoDate): boolean {
  return date >= start && date <= end;
}

export function differenceInDays(later: IsoDate, earlier: IsoDate): number {
  const MS_PER_DAY = 86_400_000;
  return Math.round((toUtcDate(later).getTime() - toUtcDate(earlier).getTime()) / MS_PER_DAY);
}

export function startOfMonth(date: IsoDate): IsoDate {
  const { year, month } = getDateParts(date);
  return toIsoDate({ year, month, day: 1 });
}

export function endOfMonth(date: IsoDate): IsoDate {
  const { year, month } = getDateParts(date);
  return toIsoDate({ year, month, day: daysInMonth(year, month) });
}

/** "2026-03-15" => "março de 2026" */
export function formatMonthYear(date: IsoDate): string {
  const { year, month } = getDateParts(date);
  // Meio-dia local: evita qualquer deslocamento de dia por fuso/horário de verão.
  return formatDateFns(new Date(year, month - 1, 1, 12), "MMMM 'de' yyyy", { locale: ptBR });
}

/** Dia da semana: 0 = domingo … 6 = sábado (calendário, sem fuso). */
export function dayOfWeek(date: IsoDate): number {
  return toUtcDate(date).getUTCDay();
}

/** Domingo da semana que contém a data (semana de domingo a sábado). */
export function startOfWeek(date: IsoDate): IsoDate {
  return addDays(date, -dayOfWeek(date));
}
