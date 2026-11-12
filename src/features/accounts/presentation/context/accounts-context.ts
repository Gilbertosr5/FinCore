import { createContext, useContext } from 'react';

import type { IsoDate } from '@/lib/dates';

import type { AccountUseCases } from '../../application/account-use-cases';

export interface AccountsServices {
  useCases: AccountUseCases;
  today: () => IsoDate;
}

export const AccountsServicesContext = createContext<AccountsServices | null>(null);

export function useAccountsServices(): AccountsServices {
  const services = useContext(AccountsServicesContext);
  if (!services) throw new Error('useAccountsServices deve ser usado dentro de <DataProvider>.');
  return services;
}
