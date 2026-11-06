import { asIsoDate } from '@/lib/dates';

import { getChartMonths, resolvePeriod, validateCustomRange } from './period';

const d = asIsoDate;
const today = d('2026-11-06');

describe('períodos do dashboard', () => {
  it.each([
    [{ preset: 'current_month' as const }, '2026-11-01', '2026-11-30'],
    [{ preset: 'last_30_days' as const }, '2026-10-08', '2026-11-06'],
    [{ preset: 'last_90_days' as const }, '2026-08-09', '2026-11-06'],
    [{ preset: 'current_year' as const }, '2026-01-01', '2026-12-31'],
  ])('%o vai de %s a %s', (selection, start, end) => {
    expect(resolvePeriod(selection, today)).toEqual({ start, end });
  });

  it('período personalizado é usado como informado', () => {
    const range = { start: d('2026-02-10'), end: d('2026-03-05') };
    expect(resolvePeriod({ preset: 'custom', range }, today)).toEqual(range);
  });

  it('valida intervalo personalizado', () => {
    expect(validateCustomRange({ start: d('2026-03-01'), end: d('2026-02-01') })).toMatch(
      /anterior/,
    );
    expect(validateCustomRange({ start: d('2020-01-01'), end: d('2026-01-02') })).toMatch(/5 anos/);
    expect(validateCustomRange({ start: d('2026-01-01'), end: d('2026-01-01') })).toBeNull();
  });

  describe('meses dos gráficos', () => {
    it('mês atual mostra pelo menos 6 meses até o mês corrente', () => {
      const months = getChartMonths(resolvePeriod({ preset: 'current_month' }, today), today);
      expect(months).toEqual(['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11']);
    });

    it('ano atual vai de janeiro ao mês corrente (sem meses futuros)', () => {
      const months = getChartMonths(resolvePeriod({ preset: 'current_year' }, today), today);
      expect(months[0]).toBe('2026-01');
      expect(months.at(-1)).toBe('2026-11');
    });

    it('limita a 24 meses em períodos longos', () => {
      const months = getChartMonths({ start: d('2020-01-01'), end: d('2026-11-06') }, today);
      expect(months).toHaveLength(24);
      expect(months.at(-1)).toBe('2026-11');
    });

    it('período passado termina no mês final do período', () => {
      const months = getChartMonths({ start: d('2025-01-01'), end: d('2025-03-31') }, today);
      expect(months.at(-1)).toBe('2025-03');
      expect(months).toHaveLength(6);
    });
  });
});
