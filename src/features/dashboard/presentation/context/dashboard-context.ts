import { createContext, useContext } from 'react';

import type { IsoDate } from '@/lib/dates';

import type { GetDashboardOverviewUseCase } from '../../application/get-dashboard-overview.use-case';

export interface DashboardServices {
  getOverview: GetDashboardOverviewUseCase;
  today: () => IsoDate;
  /** Dados de demonstração (exibe aviso na interface). */
  isDemoData: boolean;
}

export const DashboardServicesContext = createContext<DashboardServices | null>(null);

export function useDashboardServices(): DashboardServices {
  const services = useContext(DashboardServicesContext);
  if (!services) throw new Error('useDashboardServices deve ser usado dentro de <DataProvider>.');
  return services;
}
