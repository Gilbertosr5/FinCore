import type { QueryClient } from '@tanstack/react-query';

/**
 * Raízes das chaves de cache. Qualquer alteração financeira (lançamento, conta,
 * categoria) invalida todas as visões derivadas — listas, saldos, dashboard e
 * histórico — para que nenhum dado desatualizado seja exibido como confirmado.
 */
export const QUERY_ROOTS = {
  transactions: 'transactions',
  accounts: 'accounts',
  categories: 'categories',
  dashboard: 'dashboard',
  history: 'history',
} as const;

export async function invalidateFinancialData(queryClient: QueryClient): Promise<void> {
  await Promise.all(
    Object.values(QUERY_ROOTS).map((root) => queryClient.invalidateQueries({ queryKey: [root] })),
  );
}
