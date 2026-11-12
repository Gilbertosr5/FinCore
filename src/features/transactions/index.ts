export type { Category, CategoryKind, CategoryNature } from './domain/entities/category';
export type {
  CardPaymentLink,
  InstallmentInfo,
  InvestmentLink,
  Transaction,
  TransactionKind,
  TransactionStatus,
  TransferLink,
} from './domain/entities/transaction';
export type {
  CategoryRepository,
  TransactionRepository,
} from './domain/repositories/transaction.repository';
export {
  countsAsExpense,
  countsAsIncome,
  getAccountEffect,
  getTransactionDisplayDate,
  isActive,
  isSettledBy,
} from './domain/rules/transaction-effects';
export {
  categoryRecordSchema,
  transactionRecordSchema,
  transactionToRecord,
} from './infrastructure/transaction.records';
export {
  ApiCategoryRepository,
  ApiTransactionRepository,
  DemoCategoryRepository,
  DemoTransactionRepository,
  TRANSACTION_ENDPOINTS,
} from './infrastructure/transaction.repositories';

// Fase 4 — escrita, recorrências e casos de uso
export {
  RECURRENCE_FREQUENCY_LABELS,
  type Recurrence,
  type RecurrenceFrequency,
  type RecurrenceTemplate,
} from './domain/entities/recurrence';
export { TransactionError, type TransactionErrorCode } from './domain/errors/transaction-error';
export type { LedgerChanges } from './domain/repositories/transaction.repository';
export {
  DESCRIPTION_MAX_LENGTH,
  MAX_INSTALLMENTS,
  NOTES_MAX_LENGTH,
} from './domain/rules/transaction-rules';
export {
  buildMissingOccurrences,
  listOccurrenceDates,
  occurrenceDate,
  occurrenceId,
} from './domain/services/recurrence-schedule';
export {
  categoryToRecord,
  recurrenceRecordSchema,
  recurrenceToRecord,
} from './infrastructure/transaction.records';
export type { LedgerContext } from './application/ledger-context';
export type { ChangeScope, EntryInput, Repetition } from './application/entry-commands';
export type { TransferInput } from './application/transfer-commands';
export {
  InvestmentLedgerCommands,
  type InvestmentLedgerInput,
} from './application/investment-ledger';
export type {
  TransactionFilters,
  TransactionPage,
  TransactionSort,
  TransactionView,
} from './application/list-transactions';
export { DEFAULT_PAGE_SIZE, normalizeSearch } from './application/list-transactions';
export type { CategoryInput, CategoryUsageChecker } from './application/category-commands';
export { CATEGORY_NAME_MAX_LENGTH } from './application/category-commands';
export { RecurrenceScheduler, recurrenceHorizon } from './application/recurrence-scheduler';
export {
  createTransactionUseCases,
  type TransactionUseCases,
} from './application/transaction-use-cases';
export {
  TransactionsServicesContext,
  useTransactionsServices,
  type TransactionsServices,
} from './presentation/context/transactions-context';
export * from './presentation/hooks/use-transactions';
export {
  TransactionFormDialog,
  type TransactionFormMode,
} from './presentation/components/TransactionFormDialog';
export { CategoriesManager } from './presentation/components/CategoriesManager';
