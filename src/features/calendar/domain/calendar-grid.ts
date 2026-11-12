import {
  addDays,
  monthEnd,
  monthStart,
  startOfWeek,
  type IsoDate,
  type MonthKey,
} from '@/lib/dates';

/** Semanas (domingo a sábado) que cobrem o mês: sempre 7 dias por linha. */
export function buildMonthGrid(month: MonthKey): IsoDate[][] {
  const first = startOfWeek(monthStart(month));
  const last = monthEnd(month);
  const weeks: IsoDate[][] = [];
  for (let start = first; start <= last; start = addDays(start, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, index) => addDays(start, index)));
  }
  return weeks;
}

/** Dias da semana (domingo a sábado) que contém a data. */
export function buildWeek(date: IsoDate): IsoDate[] {
  const first = startOfWeek(date);
  return Array.from({ length: 7 }, (_, index) => addDays(first, index));
}

export const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;
export const WEEKDAY_LONG = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
] as const;
