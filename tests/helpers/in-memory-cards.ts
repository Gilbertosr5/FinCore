import { createBudgetUseCases, type Budget, type BudgetRepository } from '@/features/budgets';
import {
  createCreditCardUseCases,
  type CardPurchase,
  type CreditCard,
  type CreditCardRepository,
} from '@/features/credit-cards';
import { asIsoDate } from '@/lib/dates';
import { Money } from '@/lib/money';

import { createInMemoryLedger } from './in-memory-ledger';

type LedgerOptions = Parameters<typeof createInMemoryLedger>[0];

/**
 * Livro em memória + repositórios de cartões e orçamentos, para testar os casos
 * de uso da Fase 5 sem IndexedDB nem HTTP.
 */
export function createInMemoryFinance(
  options: LedgerOptions & {
    cards?: CreditCard[];
    purchases?: CardPurchase[];
    budgets?: Budget[];
  } = {},
) {
  const ledger = createInMemoryLedger(options);
  const cards = new Map((options.cards ?? [defaultCard()]).map((c) => [c.id, c]));
  const purchases = new Map((options.purchases ?? []).map((p) => [p.id, p]));
  const budgets = new Map((options.budgets ?? []).map((b) => [b.id, b]));

  const cardRepository: CreditCardRepository = {
    findAll: () => Promise.resolve([...cards.values()]),
    findById: (id) => Promise.resolve(cards.get(id) ?? null),
    save: (card) => {
      cards.set(card.id, card);
      return Promise.resolve();
    },
    remove: (id) => {
      cards.delete(id);
      return Promise.resolve();
    },
    findPurchases: () => Promise.resolve([...purchases.values()]),
    findPurchaseById: (id) => Promise.resolve(purchases.get(id) ?? null),
    savePurchase: (purchase) => {
      purchases.set(purchase.id, purchase);
      return Promise.resolve();
    },
  };
  const budgetRepository: BudgetRepository = {
    findAll: () => Promise.resolve([...budgets.values()]),
    findById: (id) => Promise.resolve(budgets.get(id) ?? null),
    save: (budget) => {
      budgets.set(budget.id, budget);
      return Promise.resolve();
    },
    remove: (id) => {
      budgets.delete(id);
      return Promise.resolve();
    },
  };

  const prepare = () => ledger.ledger.scheduler.ensure();
  return {
    ...ledger,
    cards: createCreditCardUseCases({ ...ledger.context, cards: cardRepository, prepare }),
    budgets: createBudgetUseCases({
      ...ledger.context,
      budgets: budgetRepository,
      cards: cardRepository,
      prepare,
    }),
    finance: { cards, purchases, budgets },
    /** Saldo atual de uma conta (via caso de uso de contas). */
    async balanceOf(accountId: string): Promise<Money> {
      const summaries = await ledger.accounts.list.execute();
      const found = summaries.find((item) => item.account.id === accountId);
      if (!found) throw new Error(`conta ${accountId} não encontrada`);
      return found.balance;
    },
  };
}

/** Cartão padrão: fecha dia 3, vence dia 10, paga pela conta "checking". */
export function defaultCard(overrides: Partial<CreditCard> = {}): CreditCard {
  return {
    id: 'card',
    name: 'Cartão Teste',
    institution: 'Banco',
    brand: 'visa',
    limit: Money.of('5000'),
    closingDay: 3,
    dueDay: 10,
    paymentAccountId: 'checking',
    status: 'active',
    ...overrides,
  };
}

export const day = asIsoDate;
