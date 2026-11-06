import { ApiError } from './api-error';
import { createHttpClient } from './http-client';
import { fakeHttpAdapter as fakeAdapter } from '../../../tests/helpers/fake-http-adapter';

const baseOptions = { baseUrl: 'http://api.test', timeoutMs: 5000 };

describe('createHttpClient', () => {
  it('envia cookies (withCredentials) e normaliza erros', async () => {
    const adapter = fakeAdapter(() => ({ status: 404 }));
    const client = createHttpClient({ ...baseOptions, adapter });
    expect(client.defaults.withCredentials).toBe(true);
    await expect(client.get('/x')).rejects.toMatchObject({ kind: 'not_found' });
  });

  it('renova a sessão após 401 e repete a requisição original uma vez', async () => {
    let sessionValid = false;
    const adapter = fakeAdapter((config) =>
      sessionValid || config.url === '/auth/refresh'
        ? { status: 200, data: 'ok' }
        : { status: 401 },
    );
    const refreshSession = vi.fn(() => {
      sessionValid = true;
      return Promise.resolve(true);
    });
    const onUnauthorized = vi.fn();
    const client = createHttpClient({ ...baseOptions, adapter, refreshSession, onUnauthorized });

    const response = await client.get('/accounts');

    expect(response.data).toBe('ok');
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(adapter.calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      'GET /accounts',
      'GET /accounts',
    ]);
  });

  it('compartilha uma única renovação entre requisições concorrentes', async () => {
    let sessionValid = false;
    const adapter = fakeAdapter(() => (sessionValid ? { status: 200 } : { status: 401 }));
    const refreshSession = vi.fn(async () => {
      await Promise.resolve();
      sessionValid = true;
      return true;
    });
    const client = createHttpClient({ ...baseOptions, adapter, refreshSession });

    await Promise.all([client.get('/a'), client.get('/b'), client.get('/c')]);

    expect(refreshSession).toHaveBeenCalledTimes(1);
  });

  it('notifica sessão expirada quando a renovação falha', async () => {
    const adapter = fakeAdapter(() => ({ status: 401 }));
    const onUnauthorized = vi.fn();
    const client = createHttpClient({
      ...baseOptions,
      adapter,
      refreshSession: () => Promise.resolve(false),
      onUnauthorized,
    });

    await expect(client.get('/accounts')).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('não repete indefinidamente se o 401 persistir após renovação', async () => {
    const adapter = fakeAdapter(() => ({ status: 401 }));
    const refreshSession = vi.fn(() => Promise.resolve(true));
    const onUnauthorized = vi.fn();
    const client = createHttpClient({ ...baseOptions, adapter, refreshSession, onUnauthorized });

    await expect(client.get('/accounts')).rejects.toMatchObject({ kind: 'unauthorized' });
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(adapter.calls).toHaveLength(2);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('respeita skipSessionRefresh e suppressUnauthorizedEvent', async () => {
    const adapter = fakeAdapter(() => ({ status: 401 }));
    const refreshSession = vi.fn(() => Promise.resolve(true));
    const onUnauthorized = vi.fn();
    const client = createHttpClient({ ...baseOptions, adapter, refreshSession, onUnauthorized });

    await expect(
      client.post('/auth/login', {}, { skipSessionRefresh: true, suppressUnauthorizedEvent: true }),
    ).rejects.toMatchObject({ kind: 'unauthorized' });

    expect(refreshSession).not.toHaveBeenCalled();
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('não tenta renovar sessão em erros diferentes de 401', async () => {
    const adapter = fakeAdapter(() => ({ status: 403 }));
    const refreshSession = vi.fn(() => Promise.resolve(true));
    const client = createHttpClient({ ...baseOptions, adapter, refreshSession });

    await expect(client.get('/x')).rejects.toMatchObject({ kind: 'forbidden' });
    expect(refreshSession).not.toHaveBeenCalled();
  });
});
