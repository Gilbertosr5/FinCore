import { createContext, useContext } from 'react';

import type { IsoDate } from '@/lib/dates';

import type { BudgetUseCases } from '../../application/budget-use-cases';

export interface BudgetsServices {
  useCases: BudgetUseCases;
  today: () => IsoDate;
}

export const BudgetsServicesContext = createContext<BudgetsServices | null>(null);

export function useBudgetsServices(): BudgetsServices {
  const services = useContext(BudgetsServicesContext);
  if (!services) throw new Error('useBudgetsServices deve ser usado dentro de <DataProvider>.');
  return services;
}
