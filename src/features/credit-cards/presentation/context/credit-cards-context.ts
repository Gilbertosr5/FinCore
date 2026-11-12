import { createContext, useContext } from 'react';

import type { IsoDate } from '@/lib/dates';

import type { CreditCardUseCases } from '../../application/credit-card-use-cases';

export interface CreditCardsServices {
  useCases: CreditCardUseCases;
  today: () => IsoDate;
}

export const CreditCardsServicesContext = createContext<CreditCardsServices | null>(null);

export function useCreditCardsServices(): CreditCardsServices {
  const services = useContext(CreditCardsServicesContext);
  if (!services) {
    throw new Error('useCreditCardsServices deve ser usado dentro de <DataProvider>.');
  }
  return services;
}
