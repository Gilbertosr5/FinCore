import type { AppRepositories } from '@/app/composition/create-data-layer';
import { accountToRecord } from '@/features/accounts';
import { budgetToRecord } from '@/features/budgets';
import { cardPurchaseToRecord, creditCardToRecord } from '@/features/credit-cards';
import { goalContributionToRecord, goalToRecord } from '@/features/goals';
import {
  assetToRecord,
  assetValuationToRecord,
  investmentMovementToRecord,
} from '@/features/investments';
import { categoryToRecord, recurrenceToRecord, transactionToRecord } from '@/features/transactions';

export const EXPORT_FORMAT = 'fincore-export';
export const EXPORT_VERSION = 1;

export interface UserDataExport {
  format: typeof EXPORT_FORMAT;
  version: typeof EXPORT_VERSION;
  exportedAt: string;
  /** Origem dos dados: demonstração (IndexedDB) ou API. */
  source: 'demo' | 'api';
  data: Record<string, unknown[]>;
}

/**
 * Exporta todos os dados financeiros do usuário em JSON, no mesmo formato dos
 * DTOs da API (valores monetários como texto decimal, datas ISO). Gerado no
 * navegador; nada é enviado a servidores. Não inclui credenciais nem o
 * histórico de alterações (auditoria).
 */
export async function exportUserData(
  repositories: AppRepositories,
  source: UserDataExport['source'],
  now: () => string,
): Promise<UserDataExport> {
  const [
    accounts,
    categories,
    transactions,
    recurrences,
    creditCards,
    cardPurchases,
    budgets,
    goals,
    goalContributions,
    assets,
    investmentMovements,
    assetValuations,
  ] = await Promise.all([
    repositories.accounts.findAll(),
    repositories.categories.findAll(),
    repositories.transactions.findAll(),
    repositories.transactions.findRecurrences(),
    repositories.creditCards.findAll(),
    repositories.creditCards.findPurchases(),
    repositories.budgets.findAll(),
    repositories.goals.findAll(),
    repositories.goals.findContributions(),
    repositories.investments.findAssets(),
    repositories.investments.findMovements(),
    repositories.investments.findValuations(),
  ]);
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: now(),
    source,
    data: {
      accounts: accounts.map(accountToRecord),
      categories: categories.map(categoryToRecord),
      transactions: transactions.map(transactionToRecord),
      recurrences: recurrences.map(recurrenceToRecord),
      creditCards: creditCards.map(creditCardToRecord),
      cardPurchases: cardPurchases.map(cardPurchaseToRecord),
      budgets: budgets.map(budgetToRecord),
      goals: goals.map(goalToRecord),
      goalContributions: goalContributions.map(goalContributionToRecord),
      assets: assets.map(assetToRecord),
      investmentMovements: investmentMovements.map(investmentMovementToRecord),
      assetValuations: assetValuations.map(assetValuationToRecord),
    },
  };
}
