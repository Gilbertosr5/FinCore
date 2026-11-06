import {
  addDays,
  addMonthsToKey,
  differenceInDays,
  endOfMonth,
  getDateParts,
  monthKeysBetween,
  startOfMonth,
  toIsoDate,
  toMonthKey,
  type IsoDate,
  type MonthKey,
} from '@/lib/dates';

export type PeriodPreset =
  'current_month' | 'last_30_days' | 'last_90_days' | 'current_year' | 'custom';

export const PERIOD_PRESET_LABELS: Record<PeriodPreset, string> = {
  current_month: 'Mês atual',
  last_30_days: 'Últimos 30 dias',
  last_90_days: 'Últimos 90 dias',
  current_year: 'Ano atual',
  custom: 'Personalizado',
};

export interface DateRange {
  start: IsoDate;
  end: IsoDate;
}

export type PeriodSelection =
  { preset: Exclude<PeriodPreset, 'custom'> } | { preset: 'custom'; range: DateRange };

export const MAX_CUSTOM_RANGE_DAYS = 5 * 366;

/** Mensagem de erro para um intervalo personalizado inválido, ou null se válido. */
export function validateCustomRange(range: DateRange): string | null {
  if (range.start > range.end) return 'A data inicial deve ser anterior ou igual à data final.';
  if (differenceInDays(range.end, range.start) > MAX_CUSTOM_RANGE_DAYS) {
    return 'O período personalizado pode ter no máximo 5 anos.';
  }
  return null;
}

/**
 * Converte a seleção em intervalo de datas (inclusive).
 * Mês e ano atuais vão até o último dia do período, incluindo lançamentos
 * pendentes já previstos (regime de competência).
 */
export function resolvePeriod(selection: PeriodSelection, today: IsoDate): DateRange {
  switch (selection.preset) {
    case 'current_month':
      return { start: startOfMonth(today), end: endOfMonth(today) };
    case 'last_30_days':
      return { start: addDays(today, -29), end: today };
    case 'last_90_days':
      return { start: addDays(today, -89), end: today };
    case 'current_year': {
      const { year } = getDateParts(today);
      return {
        start: toIsoDate({ year, month: 1, day: 1 }),
        end: toIsoDate({ year, month: 12, day: 31 }),
      };
    }
    case 'custom':
      return selection.range;
  }
}

const MIN_CHART_MONTHS = 6;
const MAX_CHART_MONTHS = 24;

/**
 * Meses exibidos nos gráficos de evolução: do mês inicial do período até o mês
 * final (limitado ao mês atual, pois não há histórico futuro), com no mínimo 6
 * e no máximo 24 meses.
 */
export function getChartMonths(range: DateRange, today: IsoDate): MonthKey[] {
  const currentMonth = toMonthKey(today);
  const rangeEnd = toMonthKey(range.end);
  const end = rangeEnd < currentMonth ? rangeEnd : currentMonth;
  let start = toMonthKey(range.start);
  if (start > end) start = end;
  const minStart = addMonthsToKey(end, -(MIN_CHART_MONTHS - 1));
  const maxStart = addMonthsToKey(end, -(MAX_CHART_MONTHS - 1));
  if (start > minStart) start = minStart;
  if (start < maxStart) start = maxStart;
  return monthKeysBetween(start, end);
}
