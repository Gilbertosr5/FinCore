import type { AccountRepository } from '@/features/accounts/domain/repositories/account.repository';
import type { BudgetRepository } from '@/features/budgets/domain/repositories/budget.repository';
import type { CreditCardRepository } from '@/features/credit-cards/domain/repositories/credit-card.repository';
import type { InvestmentRepository } from '@/features/investments/domain/repositories/investment.repository';
import type {
  CategoryRepository,
  TransactionRepository,
} from '@/features/transactions/domain/repositories/transaction.repository';
import type { IsoDate } from '@/lib/dates';

import type { ReportData } from '../domain/report-data';

export interface ReportsContext {
  accounts: AccountRepository;
  categories: CategoryRepository;
  transactions: TransactionRepository;
  cards: CreditCardRepository;
  budgets: BudgetRepository;
  investments: InvestmentRepository;
  today: () => IsoDate;
  prepare?: () => Promise<unknown>;
}

export interface ReportSnapshot {
  today: IsoDate;
  data: ReportData;
}

/**
 * Lê uma vez os dados de todos os módulos; os relatórios são funções puras
 * sobre eles (trocar de relatório ou filtro não relê o armazenamento).
 */
export class LoadReportDataUseCase {
  constructor(private readonly context: ReportsContext) {}

  async execute(): Promise<ReportSnapshot> {
    await this.context.prepare?.();
    const [
      accounts,
      categories,
      transactions,
      recurrences,
      cards,
      purchases,
      budgets,
      assets,
      movements,
      valuations,
    ] = await Promise.all([
      this.context.accounts.findAll(),
      this.context.categories.findAll(),
      this.context.transactions.findAll(),
      this.context.transactions.findRecurrences(),
      this.context.cards.findAll(),
      this.context.cards.findPurchases(),
      this.context.budgets.findAll(),
      this.context.investments.findAssets(),
      this.context.investments.findMovements(),
      this.context.investments.findValuations(),
    ]);
    return {
      today: this.context.today(),
      data: {
        accounts,
        categories,
        transactions,
        recurrences,
        cards,
        purchases,
        budgets,
        assets,
        movements,
        valuations,
      },
    };
  }
}
