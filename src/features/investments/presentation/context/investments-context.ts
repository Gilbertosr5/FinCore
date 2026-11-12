import { createContext, useContext } from 'react';

import type { IsoDate } from '@/lib/dates';

import type { InvestmentUseCases } from '../../application/investment-use-cases';

export interface InvestmentsServices {
  useCases: InvestmentUseCases;
  today: () => IsoDate;
}

export const InvestmentsServicesContext = createContext<InvestmentsServices | null>(null);

export function useInvestmentsServices(): InvestmentsServices {
  const services = useContext(InvestmentsServicesContext);
  if (!services) {
    throw new Error('useInvestmentsServices deve ser usado dentro de <DataProvider>.');
  }
  return services;
}
