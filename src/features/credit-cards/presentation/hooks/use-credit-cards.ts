import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { invalidateFinancialData, QUERY_ROOTS } from '@/lib/query-keys';

import type { CardInput } from '../../application/card-commands';
import type { PayInvoiceInput } from '../../application/invoice-commands';
import type { PurchaseInput } from '../../application/purchase-commands';
import type { CardStatus } from '../../domain/entities/credit-card';
import { useCreditCardsServices } from '../context/credit-cards-context';

export const creditCardQueryKeys = {
  list: [QUERY_ROOTS.creditCards, 'list'] as const,
  details: (id: string) => [QUERY_ROOTS.creditCards, 'details', id] as const,
};

/** Cartões com limite, fatura aberta e faturas a pagar. */
export function useCardsSummary() {
  const { useCases } = useCreditCardsServices();
  return useQuery({ queryKey: creditCardQueryKeys.list, queryFn: () => useCases.list.execute() });
}

export function useCardDetails(id: string) {
  const { useCases } = useCreditCardsServices();
  return useQuery({
    queryKey: creditCardQueryKeys.details(id),
    queryFn: () => useCases.details.execute(id),
  });
}

/**
 * Mutações de cartão: compras e pagamentos afetam saldos, dashboard, orçamentos
 * e transações — invalida todas as visões financeiras.
 */
function useCardMutation<TVariables, TResult>(fn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => invalidateFinancialData(queryClient) });
}

export function useCreateCard() {
  const { useCases } = useCreditCardsServices();
  return useCardMutation((input: CardInput) => useCases.createCard.execute(input));
}

export function useUpdateCard() {
  const { useCases } = useCreditCardsServices();
  return useCardMutation((variables: { id: string; input: CardInput }) =>
    useCases.updateCard.execute(variables.id, variables.input),
  );
}

export function useSetCardStatus() {
  const { useCases } = useCreditCardsServices();
  return useCardMutation((variables: { id: string; status: CardStatus }) =>
    useCases.setStatus.execute(variables.id, variables.status),
  );
}

export function useDeleteCard() {
  const { useCases } = useCreditCardsServices();
  return useCardMutation((id: string) => useCases.deleteCard.execute(id));
}

export function useRegisterPurchase() {
  const { useCases } = useCreditCardsServices();
  return useCardMutation((input: PurchaseInput) => useCases.registerPurchase.execute(input));
}

export function useUpdatePurchase() {
  const { useCases } = useCreditCardsServices();
  return useCardMutation((variables: { id: string; input: PurchaseInput }) =>
    useCases.updatePurchase.execute(variables.id, variables.input),
  );
}

export function useCancelPurchase() {
  const { useCases } = useCreditCardsServices();
  return useCardMutation((id: string) => useCases.cancelPurchase.execute(id));
}

export function usePayInvoice() {
  const { useCases } = useCreditCardsServices();
  return useCardMutation((input: PayInvoiceInput) => useCases.payInvoice.execute(input));
}

export function useReversePayment() {
  const { useCases } = useCreditCardsServices();
  return useCardMutation((transactionId: string) => useCases.reversePayment.execute(transactionId));
}
