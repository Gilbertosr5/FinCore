import { QueryClient } from '@tanstack/react-query';

import { isApiError } from '@/services/api/api-error';

const MAX_QUERY_RETRIES = 2;

/**
 * Política de retry: apenas falhas transitórias (rede, timeout, 5xx).
 * Erros 4xx (validação, permissão, conflito) nunca são repetidos.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_QUERY_RETRIES) return false;
  if (isApiError(error)) return error.isRetryable;
  return false;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: shouldRetryQuery,
        refetchOnWindowFocus: true,
      },
      mutations: {
        // Operações financeiras nunca são reenviadas automaticamente (evita duplicidade).
        retry: false,
      },
    },
  });
}
