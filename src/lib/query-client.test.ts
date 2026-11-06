import { ApiError } from '@/services/api/api-error';

import { createQueryClient, shouldRetryQuery } from './query-client';

describe('política de retry do TanStack Query', () => {
  it.each(['network', 'timeout', 'server'] as const)('repete falhas transitórias (%s)', (kind) => {
    expect(shouldRetryQuery(0, new ApiError({ kind }))).toBe(true);
    expect(shouldRetryQuery(1, new ApiError({ kind }))).toBe(true);
  });

  it('limita o número de tentativas', () => {
    expect(shouldRetryQuery(2, new ApiError({ kind: 'network' }))).toBe(false);
  });

  it.each([
    'bad_request',
    'unauthorized',
    'forbidden',
    'not_found',
    'conflict',
    'validation',
    'rate_limited',
  ] as const)('nunca repete erros de cliente (%s)', (kind) => {
    expect(shouldRetryQuery(0, new ApiError({ kind }))).toBe(false);
  });

  it('nunca repete mutações (evita lançamentos financeiros duplicados)', () => {
    expect(createQueryClient().getDefaultOptions().mutations?.retry).toBe(false);
  });
});
