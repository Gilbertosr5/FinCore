import { asIsoDate } from '@/lib/dates';

import { parsePeriodParams, periodToParams } from './use-period-selection';

const params = (query: string) => new URLSearchParams(query);

describe('filtro de período na URL', () => {
  it('padrão é o mês atual', () => {
    expect(parsePeriodParams(params(''))).toEqual({ preset: 'current_month' });
    expect(parsePeriodParams(params('periodo=invalido'))).toEqual({ preset: 'current_month' });
  });

  it('lê presets e período personalizado', () => {
    expect(parsePeriodParams(params('periodo=90d'))).toEqual({ preset: 'last_90_days' });
    expect(parsePeriodParams(params('periodo=personalizado&de=2026-01-01&ate=2026-02-15'))).toEqual(
      {
        preset: 'custom',
        range: { start: '2026-01-01', end: '2026-02-15' },
      },
    );
  });

  it('descarta período personalizado inválido', () => {
    expect(parsePeriodParams(params('periodo=personalizado&de=2026-02-30&ate=2026-03-01'))).toEqual(
      {
        preset: 'current_month',
      },
    );
    expect(parsePeriodParams(params('periodo=personalizado&de=2026-03-01&ate=2026-01-01'))).toEqual(
      {
        preset: 'current_month',
      },
    );
  });

  it('serializa de volta para a URL (ida e volta)', () => {
    const selection = {
      preset: 'custom' as const,
      range: { start: asIsoDate('2026-01-01'), end: asIsoDate('2026-03-31') },
    };
    const query = new URLSearchParams(periodToParams(selection));
    expect(parsePeriodParams(query)).toEqual(selection);
    expect(periodToParams({ preset: 'current_year' })).toEqual({ periodo: 'ano' });
  });
});
