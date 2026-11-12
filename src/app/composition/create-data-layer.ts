import type { AxiosInstance } from 'axios';

import type { DataSource } from '@/app/config/app.config';
import { DEMO_SEED_VERSION } from '@/app/demo-data/demo-seed-version';
import { ApiAccountRepository, DemoAccountRepository } from '@/features/accounts';
import { ApiBudgetRepository, DemoBudgetRepository } from '@/features/budgets';
import { ApiCreditCardRepository, DemoCreditCardRepository } from '@/features/credit-cards';
import type { DashboardRepositories } from '@/features/dashboard';
import { ApiGoalRepository, DemoGoalRepository } from '@/features/goals';
import {
  ApiAuditLogRepository,
  DemoAuditLogRepository,
  type AuditLogRepository,
} from '@/features/history';
import {
  ApiInvestmentRepository,
  ApiMarketIndicatorRepository,
  DemoInvestmentRepository,
  DemoMarketIndicatorRepository,
  type MarketIndicatorRepository,
} from '@/features/investments';
import {
  ApiCategoryRepository,
  ApiTransactionRepository,
  DemoCategoryRepository,
  DemoTransactionRepository,
} from '@/features/transactions';
import type { IsoDate } from '@/lib/dates';
import {
  createDemoDataStore,
  type DemoDataStore,
  type DemoSeedFactory,
} from '@/services/storage/demo-data-store';

export interface AppRepositories extends DashboardRepositories {
  audit: AuditLogRepository;
  /** Indicadores de mercado (contrato futuro — indisponível na demonstração). */
  market: MarketIndicatorRepository;
}

export interface DataLayer {
  repositories: AppRepositories;
  /** Presente apenas com VITE_DATA_SOURCE=mock. */
  demoStore: DemoDataStore | null;
}

export const DEMO_DATABASE_NAME = 'fincore-demo';

/**
 * Gerador de dados de demonstração carregado sob demanda: só é baixado quando o
 * banco local precisa ser criado ou restaurado (fora do carregamento inicial).
 */
const lazyDemoSeed: DemoSeedFactory = {
  version: DEMO_SEED_VERSION,
  create: async (referenceDate) =>
    (await import('@/app/demo-data/demo-seed')).createDemoSeed(referenceDate),
};

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
        audit: new ApiAuditLogRepository(http),
        market: new ApiMarketIndicatorRepository(http),
      },
    };
  }

  const store = createDemoDataStore({
    databaseName: options.databaseName ?? DEMO_DATABASE_NAME,
    seed: lazyDemoSeed,
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
      audit: new DemoAuditLogRepository(store),
      market: new DemoMarketIndicatorRepository(),
    },
  };
}
