import { useQuery } from '@tanstack/react-query';

import { QUERY_ROOTS } from '@/lib/query-keys';

import { useReportsServices } from '../context/reports-context';

export const reportQueryKeys = {
  snapshot: [QUERY_ROOTS.reports, 'snapshot'] as const,
};

export function useReportSnapshot() {
  const { load } = useReportsServices();
  return useQuery({ queryKey: reportQueryKeys.snapshot, queryFn: () => load.execute() });
}
