import { useQuery } from '@tanstack/react-query';

import { QUERY_ROOTS } from '@/lib/query-keys';

import type { AuditEntityType } from '../../domain/audit-entry';
import { useHistoryServices } from '../context/history-context';

export function useEntityHistory(entityType: AuditEntityType, entityId: string | null) {
  const { repository } = useHistoryServices();
  return useQuery({
    queryKey: [QUERY_ROOTS.history, entityType, entityId],
    queryFn: () => repository.findByEntity(entityType, entityId ?? ''),
    enabled: entityId !== null,
  });
}
