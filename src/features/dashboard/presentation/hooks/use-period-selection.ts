import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { isIsoDate } from '@/lib/dates';

import {
  validateCustomRange,
  type DateRange,
  type PeriodPreset,
  type PeriodSelection,
} from '../../domain/period';

/** Valores legíveis na URL (?periodo=mes), permitindo compartilhar e recarregar o filtro. */
const PRESET_PARAM: Record<PeriodPreset, string> = {
  current_month: 'mes',
  last_30_days: '30d',
  last_90_days: '90d',
  current_year: 'ano',
  custom: 'personalizado',
};

const PARAM_PRESET = Object.fromEntries(
  Object.entries(PRESET_PARAM).map(([preset, param]) => [param, preset as PeriodPreset]),
);

export function parsePeriodParams(params: URLSearchParams): PeriodSelection {
  const preset = PARAM_PRESET[params.get('periodo') ?? ''] ?? 'current_month';
  if (preset !== 'custom') return { preset };
  const start = params.get('de') ?? '';
  const end = params.get('ate') ?? '';
  if (isIsoDate(start) && isIsoDate(end)) {
    const range: DateRange = { start, end };
    if (validateCustomRange(range) === null) return { preset, range };
  }
  return { preset: 'current_month' };
}

export function periodToParams(selection: PeriodSelection): Record<string, string> {
  if (selection.preset !== 'custom') return { periodo: PRESET_PARAM[selection.preset] };
  return {
    periodo: PRESET_PARAM.custom,
    de: selection.range.start,
    ate: selection.range.end,
  };
}

export function usePeriodSelection() {
  const [params, setParams] = useSearchParams();
  const selection = useMemo(() => parsePeriodParams(params), [params]);
  const setSelection = useCallback(
    (next: PeriodSelection) => {
      setParams(periodToParams(next), { replace: true });
    },
    [setParams],
  );
  return [selection, setSelection] as const;
}
