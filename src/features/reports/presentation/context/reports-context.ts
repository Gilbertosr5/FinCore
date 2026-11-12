import { createContext, useContext } from 'react';

import type { LoadReportDataUseCase } from '../../application/load-report-data';

export interface ReportsServices {
  load: LoadReportDataUseCase;
  /** Dados de demonstração: o PDF exportado é identificado como tal. */
  isDemoData: boolean;
}

export const ReportsServicesContext = createContext<ReportsServices | null>(null);

export function useReportsServices(): ReportsServices {
  const services = useContext(ReportsServicesContext);
  if (!services) throw new Error('useReportsServices deve ser usado dentro de <DataProvider>.');
  return services;
}
