import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { MonthKey } from '@/lib/dates';
import { invalidateFinancialData, QUERY_ROOTS } from '@/lib/query-keys';

import type { BudgetInput } from '../../application/budget-use-cases';
import { useBudgetsServices } from '../context/budgets-context';

export const budgetQueryKeys = {
  month: (month: MonthKey) => [QUERY_ROOTS.budgets, 'month', month] as const,
  history: (id: string) => [QUERY_ROOTS.budgets, 'history', id] as const,
};

/** Consumo dos orçamentos no mês (mantém o mês anterior visível ao navegar). */
export function useBudgetMonth(month: MonthKey) {
  const { useCases } = useBudgetsServices();
  return useQuery({
    queryKey: budgetQueryKeys.month(month),
    queryFn: () => useCases.month.execute(month),
    placeholderData: keepPreviousData,
  });
}

export function useBudgetHistory(id: string | null) {
  const { useCases } = useBudgetsServices();
  return useQuery({
    queryKey: budgetQueryKeys.history(id ?? ''),
    queryFn: () => useCases.history.execute(id ?? ''),
    enabled: id !== null,
  });
}

function useBudgetMutation<TVariables, TResult>(fn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => invalidateFinancialData(queryClient) });
}

export function useCreateBudget() {
  const { useCases } = useBudgetsServices();
  return useBudgetMutation((input: BudgetInput) => useCases.create.execute(input));
}

export function useUpdateBudget() {
  const { useCases } = useBudgetsServices();
  return useBudgetMutation((variables: { id: string; input: BudgetInput }) =>
    useCases.update.execute(variables.id, variables.input),
  );
}

export function useSetBudgetActive() {
  const { useCases } = useBudgetsServices();
  return useBudgetMutation((variables: { id: string; active: boolean }) =>
    useCases.setActive.execute(variables.id, variables.active),
  );
}

export function useDeleteBudget() {
  const { useCases } = useBudgetsServices();
  return useBudgetMutation((id: string) => useCases.remove.execute(id));
}
