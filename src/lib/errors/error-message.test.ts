import { ApiError } from '@/services/api/api-error';

import { DomainError } from './domain-error';
import {
  CHUNK_LOAD_MESSAGE,
  GENERIC_ERROR_MESSAGE,
  getErrorMessage,
  isChunkLoadError,
} from './error-message';

const named = (name: string, message = 'detalhe técnico') => {
  const error = new Error(message);
  error.name = name;
  return error;
};

describe('mensagens de erro para o usuário', () => {
  it('usa a mensagem de erros de domínio e de API', () => {
    expect(getErrorMessage(new DomainError('x', 'Saldo insuficiente.'))).toBe(
      'Saldo insuficiente.',
    );
    expect(getErrorMessage(new ApiError({ kind: 'network' }))).not.toBe(GENERIC_ERROR_MESSAGE);
  });

  it('orienta em erros de armazenamento local sem expor o texto técnico', () => {
    expect(getErrorMessage(named('QuotaExceededError'))).toMatch(
      /armazenamento do navegador está cheio/,
    );
    expect(getErrorMessage(named('MissingAPIError'))).toMatch(/navegação privada/);
    expect(getErrorMessage(new DOMException('x', 'QuotaExceededError'))).toMatch(/cheio/);
    expect(getErrorMessage(named('OpenFailedError'))).not.toContain('detalhe técnico');
  });

  it('identifica falha ao carregar módulo (nova versão ou conexão)', () => {
    const error = new TypeError('Failed to fetch dynamically imported module: /assets/x.js');
    expect(isChunkLoadError(error)).toBe(true);
    expect(getErrorMessage(error)).toBe(CHUNK_LOAD_MESSAGE);
  });

  it('qualquer outro erro vira mensagem genérica', () => {
    expect(getErrorMessage(new Error('stack interna'))).toBe(GENERIC_ERROR_MESSAGE);
    expect(getErrorMessage('texto')).toBe(GENERIC_ERROR_MESSAGE);
  });
});
