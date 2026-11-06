import { useState, type ReactNode } from 'react';

import { createDataLayer, type DataLayer } from '@/app/composition/create-data-layer';
import { appConfig } from '@/app/config/app.config';
import {
  DashboardServicesContext,
  GetDashboardOverviewUseCase,
  type DashboardServices,
} from '@/features/dashboard';
import { DemoDataContext, type DemoDataManager } from '@/features/settings';
import { todayIn, type IsoDate } from '@/lib/dates';
import { apiClient } from '@/services/api/api-client';

interface DataProviderProps {
  children: ReactNode;
  /** Injeções para testes. */
  dataLayer?: DataLayer;
  today?: () => IsoDate;
}

const defaultToday = () => todayIn(appConfig.defaultTimeZone);

/**
 * Raiz de composição dos dados: cria os repositórios (demonstração ou API) e
 * expõe os casos de uso de cada feature por contexto.
 */
export function DataProvider({ children, dataLayer, today = defaultToday }: DataProviderProps) {
  const [services] = useState(() => {
    const layer =
      dataLayer ??
      createDataLayer({
        source: appConfig.dataSource,
        today,
        getHttpClient: () => apiClient,
      });
    const dashboard: DashboardServices = {
      getOverview: new GetDashboardOverviewUseCase(layer.repositories, today),
      today,
      isDemoData: layer.demoStore !== null,
    };
    const demo: DemoDataManager | null = layer.demoStore;
    // A camada de dados vive enquanto a aplicação estiver aberta: não é fechada
    // em desmontagens (o StrictMode desmonta e remonta em desenvolvimento).
    return { dashboard, demo };
  });

  return (
    <DashboardServicesContext.Provider value={services.dashboard}>
      <DemoDataContext.Provider value={services.demo}>{children}</DemoDataContext.Provider>
    </DashboardServicesContext.Provider>
  );
}
