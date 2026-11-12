import { createContext, useContext } from 'react';

import type { IsoDate } from '@/lib/dates';

import type { GetCalendarEventsUseCase } from '../../application/load-calendar-data';

export interface CalendarServices {
  events: GetCalendarEventsUseCase;
  today: () => IsoDate;
}

export const CalendarServicesContext = createContext<CalendarServices | null>(null);

export function useCalendarServices(): CalendarServices {
  const services = useContext(CalendarServicesContext);
  if (!services) throw new Error('useCalendarServices deve ser usado dentro de <DataProvider>.');
  return services;
}
