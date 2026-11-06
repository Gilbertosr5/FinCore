import type { AxiosInstance } from 'axios';

import type { DataSource } from '@/app/config/app.config';
import { demoSeedFactory } from '@/app/demo-data/demo-seed';
import { ApiAccountRepository, DemoAccountRepository } from '@/features/accounts';
import { ApiBudgetRepository, DemoBudgetRepository } from '@/features/budgets';
import { ApiCreditCardRepository, DemoCreditCardRepository } from '@/features/credit-cards';
import type { DashboardRepositories } from '@/features/dashboard';
import { ApiGoalRepository, DemoGoalRepository } from '@/features/goals';
import { ApiInvestmentRepository, DemoInvestmentRepository } from '@/features/investments';
import {
  ApiCategoryRepository,
  ApiTransactionRepository,
  DemoCategoryRepository,
  DemoTransactionRepository,
} from '@/features/transactions';
import type { IsoDate } from '@/lib/dates';
import { createDemoDataStore, type DemoDataStore } from '@/services/storage/demo-data-store';

export type AppRepositories = DashboardRepositories;

export interface DataLayer {
  repositories: AppRepositories;
  /** Presente apenas com VITE_DATA_SOURCE=mock. */
  demoStore: DemoDataStore | null;
}

export const DEMO_DATABASE_NAME = 'fincore-demo';

interface CreateDataLayerOptions {
  source: DataSource;
  today: () => IsoDate;
  /** Necessário quando source = 'api'. */
  getHttpClient: () => AxiosInstance;
  databaseName?: string;
}

/**
 * Ponto único de composição da camada de dados: escolhe as implementações de
 * todos os repositórios conforme VITE_DATA_SOURCE. Páginas e casos de uso
 * dependem apenas dos contratos.
 */
export function createDataLayer(options: CreateDataLayerOptions): DataLayer {
  if (options.source === 'api') {
    const http = options.getHttpClient();
    return {
      demoStore: null,
      repositories: {
        accounts: new ApiAccountRepository(http),
        categories: new ApiCategoryRepository(http),
        transactions: new ApiTransactionRepository(http),
        creditCards: new ApiCreditCardRepository(http),
        budgets: new ApiBudgetRepository(http),
        goals: new ApiGoalRepository(http),
        investments: new ApiInvestmentRepository(http),
      },
    };
  }

  const store = createDemoDataStore({
    databaseName: options.databaseName ?? DEMO_DATABASE_NAME,
    seed: demoSeedFactory,
    getReferenceDate: options.today,
  });
  return {
    demoStore: store,
    repositories: {
      accounts: new DemoAccountRepository(store),
      categories: new DemoCategoryRepository(store),
      transactions: new DemoTransactionRepository(store),
      creditCards: new DemoCreditCardRepository(store),
      budgets: new DemoBudgetRepository(store),
      goals: new DemoGoalRepository(store),
      investments: new DemoInvestmentRepository(store),
    },
  };
}
