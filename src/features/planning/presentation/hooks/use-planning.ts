import { useQuery } from '@tanstack/react-query';

import { QUERY_ROOTS } from '@/lib/query-keys';

import { usePlanningServices } from '../context/planning-context';

export const planningQueryKeys = {
  snapshot: [QUERY_ROOTS.planning, 'snapshot'] as const,
};

/** Dados de origem do planejamento (invalidados por qualquer alteração financeira). */
export function usePlanningSnapshot() {
  const { load } = usePlanningServices();
  return useQuery({ queryKey: planningQueryKeys.snapshot, queryFn: () => load.execute() });
}
