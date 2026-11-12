import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { invalidateFinancialData, QUERY_ROOTS } from '@/lib/query-keys';

import type { ContributionInput, GoalInput } from '../../application/goal-use-cases';
import type { GoalStatus } from '../../domain/entities/goal';
import { useGoalsServices } from '../context/goals-context';

export const goalQueryKeys = {
  list: [QUERY_ROOTS.goals, 'list'] as const,
  details: (id: string) => [QUERY_ROOTS.goals, 'details', id] as const,
};

export function useGoalsOverview() {
  const { useCases } = useGoalsServices();
  return useQuery({ queryKey: goalQueryKeys.list, queryFn: () => useCases.list.execute() });
}

export function useGoalDetails(id: string) {
  const { useCases } = useGoalsServices();
  return useQuery({
    queryKey: goalQueryKeys.details(id),
    queryFn: () => useCases.details.execute(id),
  });
}

/** Aportes podem gerar transferências: invalida todas as visões financeiras. */
function useGoalMutation<TVariables, TResult>(fn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => invalidateFinancialData(queryClient) });
}

export function useCreateGoal() {
  const { useCases } = useGoalsServices();
  return useGoalMutation((input: GoalInput) => useCases.create.execute(input));
}

export function useUpdateGoal() {
  const { useCases } = useGoalsServices();
  return useGoalMutation((variables: { id: string; input: GoalInput }) =>
    useCases.update.execute(variables.id, variables.input),
  );
}

export function useSetGoalStatus() {
  const { useCases } = useGoalsServices();
  return useGoalMutation((variables: { id: string; status: GoalStatus }) =>
    useCases.setStatus.execute(variables.id, variables.status),
  );
}

export function useDeleteGoal() {
  const { useCases } = useGoalsServices();
  return useGoalMutation((id: string) => useCases.remove.execute(id));
}

export function useAddContribution() {
  const { useCases } = useGoalsServices();
  return useGoalMutation((input: ContributionInput) => useCases.addContribution.execute(input));
}

export function useRemoveContribution() {
  const { useCases } = useGoalsServices();
  return useGoalMutation((id: string) => useCases.removeContribution.execute(id));
}
