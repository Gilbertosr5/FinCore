import { CalendarCheck } from 'lucide-react';
import { Link } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { Badge } from '@/components/ui/badge';
import { creditCardPath, goalPath, ROUTES } from '@/constants/routes';
import { toMonthKey } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';

import { EVENT_ICONS, EVENT_TONES } from './event-style';
import {
  CALENDAR_STATUS_LABELS,
  type CalendarEvent,
  type CalendarEventStatus,
} from '../../domain/calendar-events';

const STATUS_VARIANT: Record<
  CalendarEventStatus,
  'success' | 'secondary' | 'destructive' | 'outline'
> = {
  done: 'success',
  pending: 'secondary',
  overdue: 'destructive',
  forecast: 'outline',
};

function eventHref(event: CalendarEvent): string {
  switch (event.link.module) {
    case 'credit-cards':
      return event.link.entityId ? creditCardPath(event.link.entityId) : ROUTES.creditCards;
    case 'goals':
      return event.link.entityId ? goalPath(event.link.entityId) : ROUTES.goals;
    case 'transactions':
      return `${ROUTES.transactions}?mes=${toMonthKey(event.date)}`;
  }
}

export function EventList({ events }: { events: readonly CalendarEvent[] }) {
  if (events.length === 0) {
    return (
      <EmptyState
        icon={CalendarCheck}
        title="Nenhum evento"
        description="Nada previsto para este dia com os filtros atuais."
        className="py-6"
      />
    );
  }
  return (
    <ul className="divide-y divide-border">
      {events.map((event) => {
        const Icon = EVENT_ICONS[event.type];
        return (
          <li key={event.id}>
            <Link
              to={eventHref(event)}
              className="flex items-start gap-3 rounded-md px-1 py-2 text-sm outline-none hover:bg-accent focus-visible:bg-accent"
            >
              <Icon
                aria-hidden="true"
                className={cn('mt-0.5 size-4 shrink-0', EVENT_TONES[event.type])}
              />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-medium">{event.title}</span>
                {event.detail && (
                  <span className="truncate text-xs text-muted-foreground">{event.detail}</span>
                )}
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                {event.amount && (
                  <span className="font-medium tabular-nums">{formatMoney(event.amount)}</span>
                )}
                <Badge variant={STATUS_VARIANT[event.status]}>
                  {CALENDAR_STATUS_LABELS[event.status]}
                </Badge>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
