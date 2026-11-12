export type { Budget, BudgetPeriod } from './domain/entities/budget';
export type { BudgetRepository } from './domain/repositories/budget.repository';
export {
  computeBudgetUsage,
  getBudgetPeriod,
  sumBudgetSpending,
  type BudgetSpendingEntry,
  type BudgetUsage,
  type BudgetUsageStatus,
} from './domain/services/budget-usage';
export {
  ApiBudgetRepository,
  BUDGET_ENDPOINTS,
  budgetRecordSchema,
  budgetToRecord,
  DemoBudgetRepository,
} from './infrastructure/budget.infrastructure';

// Fase 5 — escrita e casos de uso
export {
  BUDGET_HISTORY_MONTHS,
  BUDGET_HISTORY_YEARS,
  BUDGET_NAME_MAX_LENGTH,
  BUDGET_PERIOD_LABELS,
  BudgetError,
  createBudgetUseCases,
  DEFAULT_ALERT_THRESHOLD,
  type BudgetContext,
  type BudgetHistoryRow,
  type BudgetInput,
  type BudgetMonthOverview,
  type BudgetUseCases,
  type BudgetView,
} from './application/budget-use-cases';
export {
  BudgetsServicesContext,
  useBudgetsServices,
  type BudgetsServices,
} from './presentation/context/budgets-context';
export * from './presentation/hooks/use-budgets';
