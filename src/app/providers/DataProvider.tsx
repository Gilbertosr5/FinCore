import { useState, type ReactNode } from 'react';

import { createDataLayer, type DataLayer } from '@/app/composition/create-data-layer';
import { appConfig } from '@/app/config/app.config';
import {
  AccountsServicesContext,
  createAccountUseCases,
  type AccountsServices,
} from '@/features/accounts';
import {
  BudgetsServicesContext,
  createBudgetUseCases,
  type BudgetsServices,
} from '@/features/budgets';
import {
  createCreditCardUseCases,
  CreditCardsServicesContext,
  type CreditCardsServices,
} from '@/features/credit-cards';
import {
  DashboardServicesContext,
  GetDashboardOverviewUseCase,
  type DashboardServices,
} from '@/features/dashboard';
import { createGoalUseCases, GoalsServicesContext, type GoalsServices } from '@/features/goals';
import { HistoryServicesContext, type HistoryServices } from '@/features/history';
import {
  createInvestmentUseCases,
  InvestmentsServicesContext,
  type InvestmentsServices,
} from '@/features/investments';
import {
  LoadPlanningDataUseCase,
  PlanningServicesContext,
  type PlanningServices,
} from '@/features/planning';
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
  const planning: PlanningServices = {
    load: new LoadPlanningDataUseCase({
      ...ledgerContext,
      cards: repositories.creditCards,
      budgets: repositories.budgets,
      prepare,
    }),
  };
  const investments: InvestmentsServices = {
    useCases: createInvestmentUseCases({
      ...ledgerContext,
      investments: repositories.investments,
      market: repositories.market,
      // Aplicações, resgates e proventos com conta viram lançamentos gerenciados.
      ledger: ledger.investments,
    }),
    today,
  };
  const goals: GoalsServices = {
    useCases: createGoalUseCases({
      ...ledgerContext,
      goals: repositories.goals,
      // Aportes com movimento de dinheiro viram transferências do livro de lançamentos.
      transfers: {
        create: (input) => ledger.createTransfer.execute(input),
        remove: async (transferId) => {
          const legs = (await repositories.transactions.findAll()).filter(
            (tx) => tx.transfer?.id === transferId,
          );
          const [leg] = legs;
          // Já excluída pelo usuário em Transações: nada a fazer.
          if (leg) await ledger.remove.execute(leg.id);
        },
      },
    }),
    today,
  };
  const creditCards: CreditCardsServices = {
    useCases: createCreditCardUseCases({
      ...ledgerContext,
      cards: repositories.creditCards,
      prepare,
    }),
    today,
  };
  const budgets: BudgetsServices = {
    useCases: createBudgetUseCases({
      ...ledgerContext,
      budgets: repositories.budgets,
      cards: repositories.creditCards,
      prepare,
    }),
    today,
  };

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

  return {
    transactions,
    accounts,
    creditCards,
    budgets,
    goals,
    investments,
    planning,
    dashboard,
    history,
    demo,
  };
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
          <CreditCardsServicesContext.Provider value={services.creditCards}>
            <BudgetsServicesContext.Provider value={services.budgets}>
              <GoalsServicesContext.Provider value={services.goals}>
                <PlanningServicesContext.Provider value={services.planning}>
                  <InvestmentsServicesContext.Provider value={services.investments}>
                    <HistoryServicesContext.Provider value={services.history}>
                      <DemoDataContext.Provider value={services.demo}>
                        {children}
                      </DemoDataContext.Provider>
                    </HistoryServicesContext.Provider>
                  </InvestmentsServicesContext.Provider>
                </PlanningServicesContext.Provider>
              </GoalsServicesContext.Provider>
            </BudgetsServicesContext.Provider>
          </CreditCardsServicesContext.Provider>
        </AccountsServicesContext.Provider>
      </TransactionsServicesContext.Provider>
    </DashboardServicesContext.Provider>
  );
}
