import { createContext, useContext } from 'react';

import type { IsoDate } from '@/lib/dates';

import type { TransactionUseCases } from '../../application/transaction-use-cases';
import type { CategoryRepository } from '../../domain/repositories/transaction.repository';

export interface TransactionsServices {
  useCases: TransactionUseCases;
  /** Leitura de categorias (a escrita passa pelos casos de uso). */
  categories: Pick<CategoryRepository, 'findAll'>;
  today: () => IsoDate;
}

export const TransactionsServicesContext = createContext<TransactionsServices | null>(null);

export function useTransactionsServices(): TransactionsServices {
  const services = useContext(TransactionsServicesContext);
  if (!services) {
    throw new Error('useTransactionsServices deve ser usado dentro de <DataProvider>.');
  }
  return services;
}
