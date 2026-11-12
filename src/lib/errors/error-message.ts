import { isApiError } from '@/services/api/api-error';

import { isDomainError } from './domain-error';

export const GENERIC_ERROR_MESSAGE = 'Ocorreu um erro inesperado. Tente novamente.';

/**
 * Erros do armazenamento local (IndexedDB/Dexie) com orientação ao usuário.
 * Identificados pelo `name` — nunca exibimos a mensagem técnica original.
 */
const STORAGE_MESSAGES: Record<string, string> = {
  QuotaExceededError:
    'O armazenamento do navegador está cheio. Libere espaço ou restaure os dados de demonstração.',
  MissingAPIError:
    'Este navegador não permite armazenar dados locais (navegação privada?). Use uma janela comum.',
  OpenFailedError:
    'Não foi possível abrir os dados locais. Feche outras abas do FinCore e recarregue a página.',
  DatabaseClosedError: 'Os dados locais foram fechados. Recarregue a página.',
  VersionError: 'Os dados locais são de uma versão mais nova do FinCore. Recarregue a página.',
};

/** Falha ao baixar um módulo da aplicação (nova versão publicada ou conexão). */
export function isChunkLoadError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /dynamically imported module|Importing a module script failed|error loading dynamically/i.test(
      error.message,
    )
  );
}

export const CHUNK_LOAD_MESSAGE =
  'Não foi possível carregar esta parte do aplicativo — talvez haja uma nova versão ou a conexão caiu. Recarregue a página.';

/**
 * Mensagem segura para exibição ao usuário. Somente erros de domínio e erros
 * HTTP normalizados têm mensagens próprias; erros conhecidos de armazenamento e
 * de carregamento recebem orientação; qualquer outro erro (bug, exceção de
 * biblioteca) recebe mensagem genérica para não vazar detalhes.
 */
export function getErrorMessage(error: unknown): string {
  if (isDomainError(error) || isApiError(error)) return error.message;
  if (isChunkLoadError(error)) return CHUNK_LOAD_MESSAGE;
  if (error instanceof Error || (error instanceof DOMException && error.name)) {
    const storage = STORAGE_MESSAGES[error.name];
    if (storage) return storage;
  }
  return GENERIC_ERROR_MESSAGE;
}
