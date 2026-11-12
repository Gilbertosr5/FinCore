import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { IsoDate } from '@/lib/dates';
import { invalidateFinancialData, QUERY_ROOTS } from '@/lib/query-keys';

import type { AccountInput } from '../../application/account-use-cases';
import { useAccountsServices } from '../context/accounts-context';

export const accountQueryKeys = {
  list: [QUERY_ROOTS.accounts, 'list'] as const,
  statement: (id: string, start: IsoDate, end: IsoDate) =>
    [QUERY_ROOTS.accounts, 'statement', id, start, end] as const,
};

/** Contas com saldo atual, pendentes e saldo previsto. */
export function useAccountSummaries() {
  const { useCases } = useAccountsServices();
  return useQuery({ queryKey: accountQueryKeys.list, queryFn: () => useCases.list.execute() });
}

export function useAccountStatement(id: string, start: IsoDate, end: IsoDate) {
  const { useCases } = useAccountsServices();
  return useQuery({
    queryKey: accountQueryKeys.statement(id, start, end),
    queryFn: () => useCases.statement.execute(id, start, end),
  });
}

/** Mutação de conta: sem retry e com invalidação de saldos, listas e dashboard. */
function useAccountMutation<TVariables, TResult>(fn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => invalidateFinancialData(queryClient) });
}

export function useCreateAccount() {
  const { useCases } = useAccountsServices();
  return useAccountMutation((input: AccountInput) => useCases.create.execute(input));
}

export function useUpdateAccount() {
  const { useCases } = useAccountsServices();
  return useAccountMutation((variables: { id: string; input: AccountInput }) =>
    useCases.update.execute(variables.id, variables.input),
  );
}

export function useSetAccountArchived() {
  const { useCases } = useAccountsServices();
  return useAccountMutation((variables: { id: string; archived: boolean }) =>
    useCases.setArchived.execute(variables.id, variables.archived),
  );
}
