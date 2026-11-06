import { AxiosError, AxiosHeaders, CanceledError, type AxiosResponse } from 'axios';

import { ApiError, kindFromStatus, normalizeHttpError } from './api-error';

function httpError(status: number, data: unknown = {}, headers: Record<string, string> = {}) {
  const config = { headers: new AxiosHeaders() };
  const response: AxiosResponse = {
    status,
    statusText: '',
    data,
    headers,
    config,
  };
  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, {}, response);
}

describe('kindFromStatus', () => {
  it.each([
    [400, 'bad_request'],
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [404, 'not_found'],
    [409, 'conflict'],
    [422, 'validation'],
    [429, 'rate_limited'],
    [500, 'server'],
    [503, 'server'],
    [418, 'bad_request'],
  ] as const)('%i => %s', (status, kind) => {
    expect(kindFromStatus(status)).toBe(kind);
  });
});

describe('normalizeHttpError', () => {
  it('extrai mensagem e erros de campo de um Problem Details (RFC 9457)', () => {
    const error = normalizeHttpError(
      httpError(
        422,
        {
          title: 'Unprocessable',
          detail: 'Valor deve ser positivo',
          code: 'TRANSACTION_INVALID_AMOUNT',
          errors: [{ field: 'amount', message: 'Deve ser maior que zero' }],
        },
        { 'x-request-id': 'req-123' },
      ),
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error.kind).toBe('validation');
    expect(error.status).toBe(422);
    expect(error.message).toBe('Valor deve ser positivo');
    expect(error.code).toBe('TRANSACTION_INVALID_AMOUNT');
    expect(error.fieldErrors).toEqual([{ field: 'amount', message: 'Deve ser maior que zero' }]);
    expect(error.requestId).toBe('req-123');
  });

  it('usa mensagem padrão em pt-BR quando o corpo não segue o contrato', () => {
    const error = normalizeHttpError(httpError(404, '<html>Not found</html>'));
    expect(error.kind).toBe('not_found');
    expect(error.message).toBe('O recurso solicitado não foi encontrado.');
  });

  it('não expõe detalhes internos de erros 5xx', () => {
    const error = normalizeHttpError(
      httpError(500, { detail: 'NullPointerException at com.fincore...' }),
    );
    expect(error.kind).toBe('server');
    expect(error.message).not.toContain('NullPointerException');
    expect(error.isRetryable).toBe(true);
  });

  it('lê o cabeçalho Retry-After em 429', () => {
    const error = normalizeHttpError(httpError(429, {}, { 'retry-after': '30' }));
    expect(error.kind).toBe('rate_limited');
    expect(error.retryAfterSeconds).toBe(30);
    expect(error.isRetryable).toBe(false);
  });

  it('identifica falha de rede (sem resposta)', () => {
    const error = normalizeHttpError(new AxiosError('Network Error', 'ERR_NETWORK'));
    expect(error.kind).toBe('network');
  });

  it('identifica timeout', () => {
    const error = normalizeHttpError(new AxiosError('timeout', 'ECONNABORTED'));
    expect(error.kind).toBe('timeout');
  });

  it('identifica cancelamento', () => {
    expect(normalizeHttpError(new CanceledError()).kind).toBe('canceled');
  });

  it('é idempotente e trata erros desconhecidos', () => {
    const apiError = new ApiError({ kind: 'conflict' });
    expect(normalizeHttpError(apiError)).toBe(apiError);
    expect(normalizeHttpError(new Error('boom')).kind).toBe('unknown');
  });
});
