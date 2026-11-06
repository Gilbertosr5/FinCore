import { isApiError } from '@/services/api/api-error';

import { isDomainError } from './domain-error';

export const GENERIC_ERROR_MESSAGE = 'Ocorreu um erro inesperado. Tente novamente.';

/**
 * Mensagem segura para exibição ao usuário. Somente erros de domínio e erros
 * HTTP normalizados têm mensagens confiáveis; qualquer outro erro (bug,
 * exceção de biblioteca) recebe mensagem genérica para não vazar detalhes.
 */
export function getErrorMessage(error: unknown): string {
  if (isDomainError(error) || isApiError(error)) return error.message;
  return GENERIC_ERROR_MESSAGE;
}
