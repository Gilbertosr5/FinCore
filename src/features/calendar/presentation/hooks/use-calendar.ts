import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { QUERY_ROOTS } from '@/lib/query-keys';

import type { CalendarRange } from '../../domain/calendar-events';
import { useCalendarServices } from '../context/calendar-context';

export const calendarQueryKeys = {
  events: (range: CalendarRange) =>
    [QUERY_ROOTS.calendar, 'events', range.start, range.end] as const,
};

/** Eventos do intervalo; ao navegar, o intervalo anterior fica visível até a resposta. */
export function useCalendarEvents(range: CalendarRange) {
  const { events } = useCalendarServices();
  return useQuery({
    queryKey: calendarQueryKeys.events(range),
    queryFn: () => events.execute(range),
    placeholderData: keepPreviousData,
  });
}
