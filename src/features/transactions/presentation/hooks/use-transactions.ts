import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { IsoDate } from '@/lib/dates';
import { invalidateFinancialData, QUERY_ROOTS } from '@/lib/query-keys';

import type { CategoryInput } from '../../application/category-commands';
import type { ChangeScope, EntryInput, Repetition } from '../../application/entry-commands';
import type { TransactionFilters } from '../../application/list-transactions';
import type { TransferInput } from '../../application/transfer-commands';
import { useTransactionsServices } from '../context/transactions-context';

export const transactionQueryKeys = {
  list: (filters: TransactionFilters) => [QUERY_ROOTS.transactions, 'list', filters] as const,
  categories: [QUERY_ROOTS.categories] as const,
};

export function useTransactionList(filters: TransactionFilters) {
  const { useCases } = useTransactionsServices();
  return useQuery({
    queryKey: transactionQueryKeys.list(filters),
    queryFn: () => useCases.list.execute(filters),
    placeholderData: keepPreviousData,
  });
}

export function useCategories() {
  const { categories } = useTransactionsServices();
  return useQuery({
    queryKey: transactionQueryKeys.categories,
    queryFn: () => categories.findAll(),
    staleTime: 5 * 60_000,
  });
}

/** Mutação financeira: sem retry e com invalidação de todas as visões derivadas. */
function useLedgerMutation<TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => invalidateFinancialData(queryClient),
  });
}

export function useCreateEntry() {
  const { useCases } = useTransactionsServices();
  return useLedgerMutation((variables: { input: EntryInput; repetition: Repetition }) =>
    useCases.createEntry.execute(variables.input, variables.repetition),
  );
}

export function useUpdateEntry() {
  const { useCases } = useTransactionsServices();
  return useLedgerMutation((variables: { id: string; input: EntryInput; scope: ChangeScope }) =>
    useCases.updateEntry.execute(variables.id, variables.input, variables.scope),
  );
}

export function useCreateTransfer() {
  const { useCases } = useTransactionsServices();
  return useLedgerMutation((input: TransferInput) => useCases.createTransfer.execute(input));
}

export function useUpdateTransfer() {
  const { useCases } = useTransactionsServices();
  return useLedgerMutation((variables: { transferId: string; input: TransferInput }) =>
    useCases.updateTransfer.execute(variables.transferId, variables.input),
  );
}

export function useMarkAsPaid() {
  const { useCases } = useTransactionsServices();
  return useLedgerMutation((variables: { id: string; paidDate: IsoDate }) =>
    useCases.markAsPaid.execute(variables.id, variables.paidDate),
  );
}

export function useMarkAsPending() {
  const { useCases } = useTransactionsServices();
  return useLedgerMutation((id: string) => useCases.markAsPending.execute(id));
}

export function useCancelTransaction() {
  const { useCases } = useTransactionsServices();
  return useLedgerMutation((variables: { id: string; scope: ChangeScope }) =>
    useCases.cancel.execute(variables.id, variables.scope),
  );
}

export function useDeleteTransaction() {
  const { useCases } = useTransactionsServices();
  return useLedgerMutation((variables: { id: string; scope: ChangeScope }) =>
    useCases.remove.execute(variables.id, variables.scope),
  );
}

export function useCreateCategory() {
  const { useCases } = useTransactionsServices();
  return useLedgerMutation((input: CategoryInput) => useCases.createCategory.execute(input));
}

export function useUpdateCategory() {
  const { useCases } = useTransactionsServices();
  return useLedgerMutation((variables: { id: string; input: CategoryInput }) =>
    useCases.updateCategory.execute(variables.id, variables.input),
  );
}

export function useDeleteCategory() {
  const { useCases } = useTransactionsServices();
  return useLedgerMutation((id: string) => useCases.deleteCategory.execute(id));
}
