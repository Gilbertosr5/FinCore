import type { AccountRepository } from '@/features/accounts/domain/repositories/account.repository';
import type { BudgetRepository } from '@/features/budgets/domain/repositories/budget.repository';
import type { CreditCardRepository } from '@/features/credit-cards/domain/repositories/credit-card.repository';
import type { GoalRepository } from '@/features/goals/domain/repositories/goal.repository';
import type { InvestmentRepository } from '@/features/investments/domain/repositories/investment.repository';
import type {
  CategoryRepository,
  TransactionRepository,
} from '@/features/transactions/domain/repositories/transaction.repository';
import type { IsoDate } from '@/lib/dates';
import { DomainError } from '@/lib/errors/domain-error';

import { buildDashboardOverview } from '../domain/dashboard-overview';
import type { DashboardOverview } from '../domain/overview-types';
import { resolvePeriod, validateCustomRange, type PeriodSelection } from '../domain/period';

/** Repositórios lidos pelo dashboard (portas; a implementação é escolhida na composição). */
export interface DashboardRepositories {
  accounts: AccountRepository;
  categories: CategoryRepository;
  transactions: TransactionRepository;
  creditCards: CreditCardRepository;
  budgets: BudgetRepository;
  goals: GoalRepository;
  investments: InvestmentRepository;
}

export class GetDashboardOverviewUseCase {
  constructor(
    private readonly repositories: DashboardRepositories,
    /** Data atual no fuso do usuário (injetável para testes). */
    private readonly today: () => IsoDate,
  ) {}

  async execute(selection: PeriodSelection): Promise<DashboardOverview> {
    if (selection.preset === 'custom') {
      const error = validateCustomRange(selection.range);
      if (error) throw new DomainError('invalid_period', error);
    }
    const today = this.today();
    const { accounts, categories, transactions, creditCards, budgets, goals, investments } =
      this.repositories;

    const [
      accountList,
      categoryList,
      transactionList,
      cards,
      purchases,
      budgetList,
      goalList,
      contributions,
      assets,
      movements,
      valuations,
    ] = await Promise.all([
      accounts.findAll(),
      categories.findAll(),
      transactions.findAll(),
      creditCards.findAll(),
      creditCards.findPurchases(),
      budgets.findAll(),
      goals.findAll(),
      goals.findContributions(),
      investments.findAssets(),
      investments.findMovements(),
      investments.findValuations(),
    ]);

    return buildDashboardOverview(
      {
        accounts: accountList,
        categories: categoryList,
        transactions: transactionList,
        cards,
        purchases,
        budgets: budgetList,
        goals: goalList,
        contributions,
        assets,
        movements,
        valuations,
      },
      resolvePeriod(selection, today),
      today,
    );
  }
}
