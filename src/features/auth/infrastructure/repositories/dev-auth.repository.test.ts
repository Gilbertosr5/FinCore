import { STORAGE_KEYS } from '@/constants/storage-keys';

import { DevAuthRepository, type DevAuthRepositoryOptions } from './dev-auth.repository';
import { DEV_DEMO_ACCOUNT } from '../dev/dev-users.seed';

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
}

function setup(options: DevAuthRepositoryOptions = {}) {
  const storage = memoryStorage();
  let now = 1_000_000;
  const resetLinks: string[] = [];
  let idCounter = 0;
  const repository = new DevAuthRepository({
    storage,
    latencyMs: 0,
    now: () => now,
    generateId: () => `id-${++idCounter}`,
    onPasswordResetLink: (link) => resetLinks.push(link),
    ...options,
  });
  return {
    repository,
    storage,
    resetLinks,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

const demo = { email: DEV_DEMO_ACCOUNT.email, password: DEV_DEMO_ACCOUNT.password };

describe('DevAuthRepository', () => {
  it('autentica a conta de demonstração e mantém a sessão', async () => {
    const { repository } = setup();
    const user = await repository.login(demo);
    expect(user).toEqual({
      id: DEV_DEMO_ACCOUNT.id,
      name: DEV_DEMO_ACCOUNT.name,
      email: DEV_DEMO_ACCOUNT.email,
    });
    await expect(repository.getCurrentUser()).resolves.toEqual(user);
  });

  it('rejeita senha incorreta e e-mail inexistente com o mesmo erro', async () => {
    const { repository } = setup();
    await expect(repository.login({ ...demo, password: 'errada123' })).rejects.toMatchObject({
      code: 'invalid_credentials',
    });
    await expect(
      repository.login({ email: 'ninguem@exemplo.com', password: 'qualquer1' }),
    ).rejects.toMatchObject({ code: 'invalid_credentials' });
  });

  it('nunca persiste senha: o marcador de sessão contém apenas id e expiração', async () => {
    const { repository, storage } = setup();
    await repository.login(demo);
    const raw = storage.data.get(STORAGE_KEYS.devAuthSession) ?? '';
    const marker = JSON.parse(raw) as Record<string, unknown>;
    expect(Object.keys(marker).sort()).toEqual(['expiresAt', 'userId']);
    expect(marker.userId).toBe(DEV_DEMO_ACCOUNT.id);
    expect(raw).not.toContain(DEV_DEMO_ACCOUNT.password);
  });

  it('expira a sessão após o TTL', async () => {
    const { repository, advance } = setup({ sessionTtlMs: 1000 });
    await repository.login(demo);
    advance(999);
    await expect(repository.getCurrentUser()).resolves.not.toBeNull();
    advance(1);
    await expect(repository.getCurrentUser()).resolves.toBeNull();
  });

  it('ignora marcador de sessão corrompido', async () => {
    const { repository, storage } = setup();
    storage.setItem(STORAGE_KEYS.devAuthSession, '{quebrado');
    await expect(repository.getCurrentUser()).resolves.toBeNull();
  });

  it('cadastra, autentica e impede e-mail duplicado', async () => {
    const { repository } = setup();
    const user = await repository.register({
      name: 'Bruno Lima',
      email: 'bruno@exemplo.com',
      password: 'segura123',
    });
    expect(user).toEqual({ id: 'id-1', name: 'Bruno Lima', email: 'bruno@exemplo.com' });
    await expect(repository.getCurrentUser()).resolves.toEqual(user);
    await expect(
      repository.register({ name: 'Outro', email: 'BRUNO@exemplo.com', password: 'segura123' }),
    ).rejects.toMatchObject({ code: 'email_already_registered' });
  });

  it('encerra a sessão no logout', async () => {
    const { repository } = setup();
    await repository.login(demo);
    await repository.logout();
    await expect(repository.getCurrentUser()).resolves.toBeNull();
  });

  describe('recuperação de senha', () => {
    it('não revela se o e-mail existe e não gera link para e-mail desconhecido', async () => {
      const { repository, resetLinks } = setup();
      await expect(repository.requestPasswordReset('ninguem@exemplo.com')).resolves.toBeUndefined();
      expect(resetLinks).toHaveLength(0);
    });

    it('redefine a senha com token de uso único e encerra a sessão', async () => {
      const { repository, resetLinks } = setup();
      await repository.login(demo);
      await repository.requestPasswordReset(demo.email);
      expect(resetLinks).toEqual(['/redefinir-senha?token=id-1']);

      await repository.resetPassword({ token: 'id-1', newPassword: 'novaSenha1' });

      await expect(repository.getCurrentUser()).resolves.toBeNull();
      await expect(repository.login(demo)).rejects.toMatchObject({ code: 'invalid_credentials' });
      await expect(
        repository.login({ email: demo.email, password: 'novaSenha1' }),
      ).resolves.toBeDefined();
      await expect(
        repository.resetPassword({ token: 'id-1', newPassword: 'outraSenha1' }),
      ).rejects.toMatchObject({ code: 'invalid_reset_token' });
    });

    it('rejeita token expirado', async () => {
      const { repository, advance } = setup();
      await repository.requestPasswordReset(demo.email);
      advance(30 * 60 * 1000);
      await expect(
        repository.resetPassword({ token: 'id-1', newPassword: 'novaSenha1' }),
      ).rejects.toMatchObject({ code: 'invalid_reset_token' });
    });
  });

  describe('alteração de senha', () => {
    it('exige sessão ativa e senha atual correta', async () => {
      const { repository } = setup();
      await expect(
        repository.changePassword({ currentPassword: demo.password, newPassword: 'novaSenha1' }),
      ).rejects.toMatchObject({ code: 'not_authenticated' });

      await repository.login(demo);
      await expect(
        repository.changePassword({ currentPassword: 'errada123', newPassword: 'novaSenha1' }),
      ).rejects.toMatchObject({ code: 'invalid_current_password' });

      await repository.changePassword({
        currentPassword: demo.password,
        newPassword: 'novaSenha1',
      });
      await repository.logout();
      await expect(
        repository.login({ email: demo.email, password: 'novaSenha1' }),
      ).resolves.toBeDefined();
    });
  });
});
