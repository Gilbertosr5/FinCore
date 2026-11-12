import { createContext, useContext } from 'react';

import type { LoadPlanningDataUseCase } from '../../application/load-planning-data';

export interface PlanningServices {
  load: LoadPlanningDataUseCase;
}

export const PlanningServicesContext = createContext<PlanningServices | null>(null);

export function usePlanningServices(): PlanningServices {
  const services = useContext(PlanningServicesContext);
  if (!services) throw new Error('usePlanningServices deve ser usado dentro de <DataProvider>.');
  return services;
}
