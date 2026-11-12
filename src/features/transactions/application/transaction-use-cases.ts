import {
  CreateCategoryUseCase,
  DeleteCategoryUseCase,
  UpdateCategoryUseCase,
  type CategoryUsageChecker,
} from './category-commands';
import { CreateEntryUseCase, UpdateEntryUseCase } from './entry-commands';
import { InvestmentLedgerCommands } from './investment-ledger';
import type { LedgerContext } from './ledger-context';
import { ListTransactionsUseCase } from './list-transactions';
import { RecurrenceScheduler } from './recurrence-scheduler';
import {
  CancelTransactionUseCase,
  DeleteTransactionUseCase,
  MarkAsPaidUseCase,
  MarkAsPendingUseCase,
} from './status-commands';
import { CreateTransferUseCase, UpdateTransferUseCase } from './transfer-commands';

export interface TransactionUseCases {
  scheduler: RecurrenceScheduler;
  list: ListTransactionsUseCase;
  createEntry: CreateEntryUseCase;
  updateEntry: UpdateEntryUseCase;
  createTransfer: CreateTransferUseCase;
  updateTransfer: UpdateTransferUseCase;
  markAsPaid: MarkAsPaidUseCase;
  markAsPending: MarkAsPendingUseCase;
  cancel: CancelTransactionUseCase;
  remove: DeleteTransactionUseCase;
  createCategory: CreateCategoryUseCase;
  updateCategory: UpdateCategoryUseCase;
  deleteCategory: DeleteCategoryUseCase;
  investments: InvestmentLedgerCommands;
}

export function createTransactionUseCases(
  context: LedgerContext,
  categoryUsageCheckers: readonly CategoryUsageChecker[] = [],
): TransactionUseCases {
  const scheduler = new RecurrenceScheduler(context);
  return {
    scheduler,
    list: new ListTransactionsUseCase(context, scheduler),
    createEntry: new CreateEntryUseCase(context),
    updateEntry: new UpdateEntryUseCase(context),
    createTransfer: new CreateTransferUseCase(context),
    updateTransfer: new UpdateTransferUseCase(context),
    markAsPaid: new MarkAsPaidUseCase(context),
    markAsPending: new MarkAsPendingUseCase(context),
    cancel: new CancelTransactionUseCase(context),
    remove: new DeleteTransactionUseCase(context),
    createCategory: new CreateCategoryUseCase(context),
    updateCategory: new UpdateCategoryUseCase(context, categoryUsageCheckers),
    deleteCategory: new DeleteCategoryUseCase(context, categoryUsageCheckers),
    investments: new InvestmentLedgerCommands(context),
  };
}
