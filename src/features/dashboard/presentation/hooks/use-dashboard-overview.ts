import { keepPreviousData, useQuery } from '@tanstack/react-query';

import type { PeriodSelection } from '../../domain/period';
import { useDashboardServices } from '../context/dashboard-context';

export const dashboardQueryKeys = {
  all: ['dashboard'] as const,
  overview: (selection: PeriodSelection) =>
    [
      'dashboard',
      'overview',
      selection.preset,
      selection.preset === 'custom' ? selection.range.start : null,
      selection.preset === 'custom' ? selection.range.end : null,
    ] as const,
};

/**
 * Visão consolidada para o período. Ao trocar o filtro, os dados anteriores
 * permanecem visíveis — sinalizados como "atualizando" — até a nova resposta.
 */
export function useDashboardOverview(selection: PeriodSelection) {
  const { getOverview } = useDashboardServices();
  return useQuery({
    queryKey: dashboardQueryKeys.overview(selection),
    queryFn: () => getOverview.execute(selection),
    placeholderData: keepPreviousData,
  });
}
