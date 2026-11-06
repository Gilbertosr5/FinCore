import { createHttpClient } from '@/services/api/http-client';

import { ApiAuthRepository, AUTH_ENDPOINTS } from './api-auth.repository';
import { fakeHttpAdapter, type FakeHandler } from '../../../../../tests/helpers/fake-http-adapter';

const userDto = { id: 42, name: 'Ana Silva', email: 'ana@exemplo.com' };

function setup(handler: FakeHandler) {
  const adapter = fakeHttpAdapter(handler);
  const refreshSession = vi.fn(() => Promise.resolve(false));
  const onUnauthorized = vi.fn();
  const http = createHttpClient({
    baseUrl: 'http://api.test',
    timeoutMs: 5000,
    adapter,
    refreshSession,
    onUnauthorized,
  });
  return { repository: new ApiAuthRepository(http), adapter, refreshSession, onUnauthorized };
}

describe('ApiAuthRepository', () => {
  it('faz login e converte o DTO (id numérico vira string)', async () => {
    const { repository, adapter } = setup(() => ({ status: 200, data: userDto }));
    const user = await repository.login({ email: 'ana@exemplo.com', password: 'segura123' });
    expect(user).toEqual({ id: '42', name: 'Ana Silva', email: 'ana@exemplo.com' });
    expect(adapter.calls[0]).toEqual({
      method: 'POST',
      url: AUTH_ENDPOINTS.login,
      body: { email: 'ana@exemplo.com', password: 'segura123' },
    });
  });

  it('converte 401 no login em credenciais inválidas sem disparar sessão expirada', async () => {
    const { repository, refreshSession, onUnauthorized } = setup(() => ({ status: 401 }));
    await expect(
      repository.login({ email: 'ana@exemplo.com', password: 'errada123' }),
    ).rejects.toMatchObject({ code: 'invalid_credentials' });
    expect(refreshSession).not.toHaveBeenCalled();
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('converte 409 no cadastro em e-mail já cadastrado', async () => {
    const { repository } = setup(() => ({ status: 409 }));
    await expect(
      repository.register({ name: 'Ana', email: 'ana@exemplo.com', password: 'segura123' }),
    ).rejects.toMatchObject({ code: 'email_already_registered' });
  });

  it('preserva erros de validação por campo (422)', async () => {
    const { repository } = setup(() => ({
      status: 422,
      data: {
        detail: 'Dados inválidos',
        errors: [{ field: 'email', message: 'Domínio bloqueado' }],
      },
    }));
    await expect(
      repository.register({ name: 'Ana', email: 'ana@exemplo.com', password: 'segura123' }),
    ).rejects.toMatchObject({
      kind: 'validation',
      fieldErrors: [{ field: 'email', message: 'Domínio bloqueado' }],
    });
  });

  it('getCurrentUser retorna null em 401, tentando renovar a sessão antes', async () => {
    const { repository, refreshSession, onUnauthorized } = setup(() => ({ status: 401 }));
    await expect(repository.getCurrentUser()).resolves.toBeNull();
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('getCurrentUser rejeita respostas fora do contrato', async () => {
    const { repository } = setup(() => ({ status: 200, data: { id: 1 } }));
    await expect(repository.getCurrentUser()).rejects.toThrow();
  });

  it('getCurrentUser propaga falhas de servidor (não confunde com "deslogado")', async () => {
    const { repository } = setup(() => ({ status: 503 }));
    await expect(repository.getCurrentUser()).rejects.toMatchObject({ kind: 'server' });
  });

  it('logout tolera sessão já inexistente', async () => {
    const { repository } = setup(() => ({ status: 401 }));
    await expect(repository.logout()).resolves.toBeUndefined();
  });

  it('mapeia token de redefinição inválido', async () => {
    const { repository } = setup(() => ({ status: 400, data: { code: 'INVALID_RESET_TOKEN' } }));
    await expect(
      repository.resetPassword({ token: 'x', newPassword: 'segura123' }),
    ).rejects.toMatchObject({ code: 'invalid_reset_token' });
  });

  it('mapeia senha atual incorreta na alteração de senha', async () => {
    const { repository } = setup(() => ({
      status: 400,
      data: { code: 'INVALID_CURRENT_PASSWORD' },
    }));
    await expect(
      repository.changePassword({ currentPassword: 'x', newPassword: 'segura123' }),
    ).rejects.toMatchObject({ code: 'invalid_current_password' });
  });

  it('solicita recuperação de senha', async () => {
    const { repository, adapter } = setup(() => ({ status: 202 }));
    await repository.requestPasswordReset('ana@exemplo.com');
    expect(adapter.calls[0]).toMatchObject({
      url: AUTH_ENDPOINTS.forgotPassword,
      body: { email: 'ana@exemplo.com' },
    });
  });
});
