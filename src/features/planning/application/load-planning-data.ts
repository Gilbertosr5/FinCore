import type { AccountRepository } from '@/features/accounts/domain/repositories/account.repository';
import type { BudgetRepository } from '@/features/budgets/domain/repositories/budget.repository';
import type { CreditCardRepository } from '@/features/credit-cards/domain/repositories/credit-card.repository';
import type {
  CategoryRepository,
  TransactionRepository,
} from '@/features/transactions/domain/repositories/transaction.repository';
import type { IsoDate } from '@/lib/dates';

import type { PlanningData } from '../domain/flows';

export interface PlanningContext {
  accounts: AccountRepository;
  transactions: TransactionRepository;
  cards: CreditCardRepository;
  budgets: BudgetRepository;
  categories: CategoryRepository;
  today: () => IsoDate;
  /** Garante as ocorrências de recorrências antes de ler os lançamentos. */
  prepare?: () => Promise<unknown>;
}

export interface PlanningSnapshot {
  today: IsoDate;
  data: PlanningData;
  /** id → nome (receitas e despesas). */
  categoryNames: Record<string, string>;
}

/**
 * Lê uma vez tudo o que o planejamento precisa. Projeções, cenários e
 * simulações são calculados na hora (funções puras do domínio), sem nova leitura
 * a cada ajuste do usuário — e nada é gravado: são estimativas.
 */
export class LoadPlanningDataUseCase {
  constructor(private readonly context: PlanningContext) {}

  async execute(): Promise<PlanningSnapshot> {
    await this.context.prepare?.();
    const [accounts, transactions, recurrences, cards, purchases, budgets, categories] =
      await Promise.all([
        this.context.accounts.findAll(),
        this.context.transactions.findAll(),
        this.context.transactions.findRecurrences(),
        this.context.cards.findAll(),
        this.context.cards.findPurchases(),
        this.context.budgets.findAll(),
        this.context.categories.findAll(),
      ]);
    return {
      today: this.context.today(),
      data: { accounts, transactions, recurrences, cards, purchases, budgets },
      categoryNames: Object.fromEntries(categories.map((item) => [item.id, item.name])),
    };
  }
}
