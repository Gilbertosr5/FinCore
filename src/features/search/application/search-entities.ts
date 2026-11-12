import {
  accountStatementPath,
  assetPath,
  creditCardPath,
  goalPath,
  ROUTES,
} from '@/constants/routes';
import type { AccountRepository } from '@/features/accounts/domain/repositories/account.repository';
import type { BudgetRepository } from '@/features/budgets/domain/repositories/budget.repository';
import type { CreditCardRepository } from '@/features/credit-cards/domain/repositories/credit-card.repository';
import type { GoalRepository } from '@/features/goals/domain/repositories/goal.repository';
import type { InvestmentRepository } from '@/features/investments/domain/repositories/investment.repository';
import type { TransactionRepository } from '@/features/transactions/domain/repositories/transaction.repository';
import { getTransactionDisplayDate } from '@/features/transactions/domain/rules/transaction-effects';
import { formatDateBR, toMonthKey } from '@/lib/dates';
import { formatMoney } from '@/lib/money';

/** Mesmo formato do contrato do componente de busca (camada de apresentação). */
export interface EntitySearchResult {
  id: string;
  label: string;
  description: string;
  href: string;
  module: 'transactions' | 'accounts' | 'credit-cards' | 'budgets' | 'goals' | 'investments';
}

export interface SearchContext {
  accounts: AccountRepository;
  transactions: TransactionRepository;
  cards: CreditCardRepository;
  budgets: BudgetRepository;
  goals: GoalRepository;
  investments: InvestmentRepository;
}

export const MIN_SEARCH_LENGTH = 2;
export const MAX_TRANSACTION_RESULTS = 6;

/** Sem acentos e sem diferenciar maiúsculas ("orcamento" encontra "Orçamento"). */
export function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/**
 * Busca global de entidades: contas, cartões, metas, ativos, orçamentos e os
 * lançamentos mais recentes cuja descrição contém o termo. Lê os repositórios
 * (com a API, um endpoint de busca no servidor pode substituir esta leitura).
 */
export class SearchEntitiesUseCase {
  constructor(private readonly context: SearchContext) {}

  async execute(rawTerm: string): Promise<EntitySearchResult[]> {
    const term = normalizeSearch(rawTerm);
    if (term.length < MIN_SEARCH_LENGTH) return [];
    const matches = (...texts: (string | null | undefined)[]) =>
      texts.some((text) => text && normalizeSearch(text).includes(term));

    const [accounts, cards, goals, assets, budgets, transactions] = await Promise.all([
      this.context.accounts.findAll(),
      this.context.cards.findAll(),
      this.context.goals.findAll(),
      this.context.investments.findAssets(),
      this.context.budgets.findAll(),
      this.context.transactions.findAll(),
    ]);

    const results: EntitySearchResult[] = [
      ...accounts
        .filter((item) => matches(item.name, item.institution))
        .map((item) => ({
          id: `account:${item.id}`,
          label: item.name,
          description: `Conta${item.institution ? ` · ${item.institution}` : ''}${item.archived ? ' · arquivada' : ''}`,
          href: accountStatementPath(item.id),
          module: 'accounts' as const,
        })),
      ...cards
        .filter((item) => matches(item.name, item.institution))
        .map((item) => ({
          id: `card:${item.id}`,
          label: item.name,
          description: `Cartão${item.institution ? ` · ${item.institution}` : ''}`,
          href: creditCardPath(item.id),
          module: 'credit-cards' as const,
        })),
      ...goals
        .filter((item) => matches(item.name, item.description))
        .map((item) => ({
          id: `goal:${item.id}`,
          label: item.name,
          description: `Meta · ${formatMoney(item.targetAmount)}`,
          href: goalPath(item.id),
          module: 'goals' as const,
        })),
      ...assets
        .filter((item) => matches(item.name, item.ticker, item.institution))
        .map((item) => ({
          id: `asset:${item.id}`,
          label: item.ticker ? `${item.ticker} — ${item.name}` : item.name,
          description: `Investimento${item.institution ? ` · ${item.institution}` : ''}`,
          href: assetPath(item.id),
          module: 'investments' as const,
        })),
      ...budgets
        .filter((item) => matches(item.name))
        .map((item) => ({
          id: `budget:${item.id}`,
          label: item.name,
          description: `Orçamento · ${formatMoney(item.amount)}`,
          href: ROUTES.budgets,
          module: 'budgets' as const,
        })),
    ];

    // Lançamentos: os mais recentes; transferências aparecem uma vez (perna de saída).
    const transactionResults = transactions
      .filter(
        (tx) =>
          tx.status !== 'cancelled' &&
          tx.transfer?.direction !== 'in' &&
          matches(tx.description, ...tx.tags),
      )
      .sort((a, b) => (getTransactionDisplayDate(a) < getTransactionDisplayDate(b) ? 1 : -1))
      .slice(0, MAX_TRANSACTION_RESULTS)
      .map((tx) => {
        const date = getTransactionDisplayDate(tx);
        return {
          id: `tx:${tx.id}`,
          label: tx.description,
          description: `Lançamento · ${formatDateBR(date)} · ${formatMoney(tx.amount)}`,
          href: `${ROUTES.transactions}?mes=${toMonthKey(date)}&q=${encodeURIComponent(tx.description)}`,
          module: 'transactions' as const,
        };
      });

    return [...results, ...transactionResults];
  }
}
