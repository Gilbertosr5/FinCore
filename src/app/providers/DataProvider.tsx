import { useState, type ReactNode } from 'react';

import { createDataLayer, type DataLayer } from '@/app/composition/create-data-layer';
import { appConfig } from '@/app/config/app.config';
import {
  AccountsServicesContext,
  createAccountUseCases,
  type AccountsServices,
} from '@/features/accounts';
import {
  DashboardServicesContext,
  GetDashboardOverviewUseCase,
  type DashboardServices,
} from '@/features/dashboard';
import { HistoryServicesContext, type HistoryServices } from '@/features/history';
import { DemoDataContext, type DemoDataManager } from '@/features/settings';
import {
  createTransactionUseCases,
  TransactionsServicesContext,
  type CategoryUsageChecker,
  type LedgerContext,
  type TransactionsServices,
} from '@/features/transactions';
import { todayIn, type IsoDate } from '@/lib/dates';
import { apiClient } from '@/services/api/api-client';

interface DataProviderProps {
  children: ReactNode;
  /** Injeções para testes. */
  dataLayer?: DataLayer;
  today?: () => IsoDate;
}

const defaultToday = () => todayIn(appConfig.defaultTimeZone);

/** Identificadores gerados no cliente: gravações idempotentes (ver ADR 0009). */
const newId = () => crypto.randomUUID();
const now = () => new Date().toISOString();

function createServices(layer: DataLayer, today: () => IsoDate) {
  const { repositories } = layer;

  // Categorias também são usadas por compras de cartão e orçamentos.
  const categoryUsageCheckers: CategoryUsageChecker[] = [
    async (id) =>
      (await repositories.creditCards.findPurchases()).some((item) => item.categoryId === id),
    async (id) => (await repositories.budgets.findAll()).some((item) => item.categoryId === id),
  ];

  const ledgerContext: LedgerContext = {
    transactions: repositories.transactions,
    accounts: repositories.accounts,
    categories: repositories.categories,
    audit: repositories.audit,
    newId,
    today,
    now,
  };
  const ledger = createTransactionUseCases(ledgerContext, categoryUsageCheckers);
  const prepare = () => ledger.scheduler.ensure();

  const transactions: TransactionsServices = {
    useCases: ledger,
    categories: repositories.categories,
    today,
  };
  const accounts: AccountsServices = {
    useCases: createAccountUseCases({ ...ledgerContext, prepare }),
    today,
  };
  const dashboard: DashboardServices = {
    getOverview: new GetDashboardOverviewUseCase(repositories, today, prepare),
    today,
    isDemoData: layer.demoStore !== null,
  };
  const history: HistoryServices = { repository: repositories.audit };

  const store = layer.demoStore;
  const demo: DemoDataManager | null = store && {
    getInfo: () => store.getInfo(),
    reset: async () => {
      const info = await store.reset();
      // Dados recriados: as recorrências precisam ser verificadas novamente.
      ledger.scheduler.invalidate();
      return info;
    },
  };

  return { transactions, accounts, dashboard, history, demo };
}

/**
 * Raiz de composição dos dados: cria os repositórios (demonstração ou API) e
 * expõe os casos de uso de cada feature por contexto.
 * A camada de dados vive enquanto a aplicação estiver aberta: não é fechada em
 * desmontagens (o StrictMode desmonta e remonta em desenvolvimento).
 */
export function DataProvider({ children, dataLayer, today = defaultToday }: DataProviderProps) {
  const [services] = useState(() =>
    createServices(
      dataLayer ??
        createDataLayer({
          source: appConfig.dataSource,
          today,
          getHttpClient: () => apiClient,
        }),
      today,
    ),
  );

  return (
    <DashboardServicesContext.Provider value={services.dashboard}>
      <TransactionsServicesContext.Provider value={services.transactions}>
        <AccountsServicesContext.Provider value={services.accounts}>
          <HistoryServicesContext.Provider value={services.history}>
            <DemoDataContext.Provider value={services.demo}>{children}</DemoDataContext.Provider>
          </HistoryServicesContext.Provider>
        </AccountsServicesContext.Provider>
      </TransactionsServicesContext.Provider>
    </DashboardServicesContext.Provider>
  );
}
