import type { Account } from '@/features/accounts/domain/entities/account';
import type { Budget } from '@/features/budgets/domain/entities/budget';
import type { CardPurchase, CreditCard } from '@/features/credit-cards/domain/entities/credit-card';
import type { Goal, GoalContribution } from '@/features/goals/domain/entities/goal';
import type {
  Asset,
  AssetValuation,
  InvestmentMovement,
} from '@/features/investments/domain/entities/investment';
import type { Category } from '@/features/transactions/domain/entities/category';
import type { Transaction } from '@/features/transactions/domain/entities/transaction';

/** Todos os dados de origem necessários para montar o dashboard. */
export interface DashboardData {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  cards: CreditCard[];
  purchases: CardPurchase[];
  budgets: Budget[];
  goals: Goal[];
  contributions: GoalContribution[];
  assets: Asset[];
  movements: InvestmentMovement[];
  valuations: AssetValuation[];
}
