import { createContext, useContext } from 'react';

import type { IsoDate } from '@/lib/dates';

import type { GoalUseCases } from '../../application/goal-use-cases';

export interface GoalsServices {
  useCases: GoalUseCases;
  today: () => IsoDate;
}

export const GoalsServicesContext = createContext<GoalsServices | null>(null);

export function useGoalsServices(): GoalsServices {
  const services = useContext(GoalsServicesContext);
  if (!services) throw new Error('useGoalsServices deve ser usado dentro de <DataProvider>.');
  return services;
}
