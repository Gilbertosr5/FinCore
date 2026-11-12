import { History } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';

import { AUDIT_ACTION_LABELS, type AuditEntityType } from '../../domain/audit-entry';
import { useEntityHistory } from '../hooks/use-entity-history';

const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

/** Linha do tempo de alterações de uma entidade (mais recente primeiro). */
export function HistoryTimeline({
  entityType,
  entityId,
}: {
  entityType: AuditEntityType;
  entityId: string;
}) {
  const { data, isPending, isError } = useEntityHistory(entityType, entityId);

  if (isPending) return <Skeleton className="h-16 w-full" />;
  if (isError) {
    return <p className="text-sm text-destructive">Não foi possível carregar o histórico.</p>;
  }
  if (data.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="Sem alterações registradas"
        description="Lançamentos importados ou de demonstração não têm histórico."
        className="py-4"
      />
    );
  }
  return (
    <ol className="flex flex-col gap-3 border-l border-border pl-4">
      {data.map((entry) => (
        <li key={entry.id} className="relative text-sm">
          <span
            aria-hidden="true"
            className="absolute top-1.5 -left-[21px] size-2 rounded-full bg-primary"
          />
          <p className="font-medium">{AUDIT_ACTION_LABELS[entry.action]}</p>
          <p className="text-muted-foreground">{entry.summary}</p>
          <time dateTime={entry.at} className="text-xs text-muted-foreground">
            {dateTime.format(new Date(entry.at))}
          </time>
        </li>
      ))}
    </ol>
  );
}
