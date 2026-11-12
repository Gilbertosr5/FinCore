import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { invalidateFinancialData, QUERY_ROOTS } from '@/lib/query-keys';

import type {
  AssetInput,
  MovementInput,
  ValuationInput,
} from '../../application/investment-use-cases';
import { useInvestmentsServices } from '../context/investments-context';

export const investmentQueryKeys = {
  portfolio: [QUERY_ROOTS.investments, 'portfolio'] as const,
  details: (id: string) => [QUERY_ROOTS.investments, 'details', id] as const,
  market: [QUERY_ROOTS.investments, 'market'] as const,
};

export function usePortfolio() {
  const { useCases } = useInvestmentsServices();
  return useQuery({
    queryKey: investmentQueryKeys.portfolio,
    queryFn: () => useCases.portfolio.execute(),
  });
}

export function useAssetDetails(id: string) {
  const { useCases } = useInvestmentsServices();
  return useQuery({
    queryKey: investmentQueryKeys.details(id),
    queryFn: () => useCases.details.execute(id),
  });
}

/** Indicadores de mercado (integração futura): consultados com pouca frequência. */
export function useMarketIndicators() {
  const { useCases } = useInvestmentsServices();
  return useQuery({
    queryKey: investmentQueryKeys.market,
    queryFn: () => useCases.market.execute(),
    staleTime: 60 * 60_000,
  });
}

/** Movimentações podem gerar lançamentos na conta: invalida todas as visões financeiras. */
function useInvestmentMutation<TVariables, TResult>(
  fn: (variables: TVariables) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => invalidateFinancialData(queryClient) });
}

export function useCreateAsset() {
  const { useCases } = useInvestmentsServices();
  return useInvestmentMutation((input: AssetInput) => useCases.createAsset.execute(input));
}

export function useUpdateAsset() {
  const { useCases } = useInvestmentsServices();
  return useInvestmentMutation((variables: { id: string; input: AssetInput }) =>
    useCases.updateAsset.execute(variables.id, variables.input),
  );
}

export function useDeleteAsset() {
  const { useCases } = useInvestmentsServices();
  return useInvestmentMutation((id: string) => useCases.deleteAsset.execute(id));
}

export function useRecordMovement() {
  const { useCases } = useInvestmentsServices();
  return useInvestmentMutation((input: MovementInput) => useCases.recordMovement.execute(input));
}

export function useRemoveMovement() {
  const { useCases } = useInvestmentsServices();
  return useInvestmentMutation((id: string) => useCases.removeMovement.execute(id));
}

export function useRecordValuation() {
  const { useCases } = useInvestmentsServices();
  return useInvestmentMutation((input: ValuationInput) => useCases.recordValuation.execute(input));
}

export function useRemoveValuation() {
  const { useCases } = useInvestmentsServices();
  return useInvestmentMutation((id: string) => useCases.removeValuation.execute(id));
}
