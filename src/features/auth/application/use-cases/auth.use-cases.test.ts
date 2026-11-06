import { createAuthUseCases } from './auth.use-cases';
import { AuthError } from '../../domain/errors/auth-error';
import type { AuthRepository } from '../../domain/repositories/auth.repository';

const user = { id: '1', name: 'Ana Silva', email: 'ana@exemplo.com' };

function createRepository() {
  return {
    login: vi.fn<AuthRepository['login']>(() => Promise.resolve(user)),
    register: vi.fn<AuthRepository['register']>(() => Promise.resolve(user)),
    logout: vi.fn<AuthRepository['logout']>(() => Promise.resolve()),
    getCurrentUser: vi.fn<AuthRepository['getCurrentUser']>(() => Promise.resolve(user)),
    requestPasswordReset: vi.fn<AuthRepository['requestPasswordReset']>(() => Promise.resolve()),
    resetPassword: vi.fn<AuthRepository['resetPassword']>(() => Promise.resolve()),
    changePassword: vi.fn<AuthRepository['changePassword']>(() => Promise.resolve()),
  } satisfies AuthRepository;
}

describe('casos de uso de autenticação', () => {
  let repository: ReturnType<typeof createRepository>;
  let useCases: ReturnType<typeof createAuthUseCases>;

  beforeEach(() => {
    repository = createRepository();
    useCases = createAuthUseCases(repository);
  });

  describe('LoginUseCase', () => {
    it('normaliza o e-mail antes de autenticar', async () => {
      await useCases.login.execute({ email: ' ANA@Exemplo.com ', password: 'x' });
      expect(repository.login).toHaveBeenCalledWith({ email: 'ana@exemplo.com', password: 'x' });
    });

    it('rejeita e-mail inválido e senha vazia sem chamar o repositório', () => {
      expect(() => useCases.login.execute({ email: 'ana', password: 'x' })).toThrow(AuthError);
      expect(() => useCases.login.execute({ email: 'ana@exemplo.com', password: '' })).toThrow(
        'Informe sua senha.',
      );
      expect(repository.login).not.toHaveBeenCalled();
    });

    it('propaga erros do repositório', async () => {
      repository.login.mockRejectedValueOnce(new AuthError('invalid_credentials'));
      await expect(
        useCases.login.execute({ email: 'ana@exemplo.com', password: 'errada1' }),
      ).rejects.toMatchObject({ code: 'invalid_credentials' });
    });
  });

  describe('RegisterUseCase', () => {
    it('normaliza nome e e-mail', async () => {
      await useCases.register.execute({
        name: '  Ana   Silva ',
        email: 'ANA@EXEMPLO.COM',
        password: 'segura123',
      });
      expect(repository.register).toHaveBeenCalledWith({
        name: 'Ana Silva',
        email: 'ana@exemplo.com',
        password: 'segura123',
      });
    });

    it.each([
      [
        { name: 'A', email: 'ana@exemplo.com', password: 'segura123' },
        'Informe seu nome completo.',
      ],
      [{ name: 'Ana', email: 'ana@', password: 'segura123' }, 'Informe um e-mail válido.'],
      [{ name: 'Ana', email: 'ana@exemplo.com', password: 'curta1' }, 'pelo menos 8'],
      [{ name: 'Ana', email: 'ana@exemplo.com', password: 'semnumero' }, 'número'],
    ])('rejeita dados inválidos %o', (data, message) => {
      expect(() => useCases.register.execute(data)).toThrow(message);
      expect(repository.register).not.toHaveBeenCalled();
    });
  });

  it('RecoverPasswordUseCase valida e normaliza o e-mail', async () => {
    await useCases.recoverPassword.execute(' Ana@Exemplo.com');
    expect(repository.requestPasswordReset).toHaveBeenCalledWith('ana@exemplo.com');
    expect(() => useCases.recoverPassword.execute('invalido')).toThrow(AuthError);
  });

  describe('ResetPasswordUseCase', () => {
    it('exige token e senha forte', () => {
      expect(() =>
        useCases.resetPassword.execute({ token: ' ', newPassword: 'segura123' }),
      ).toThrow(expect.objectContaining({ code: 'invalid_reset_token' }) as Error);
      expect(() => useCases.resetPassword.execute({ token: 'abc', newPassword: 'fraca' })).toThrow(
        AuthError,
      );
      expect(repository.resetPassword).not.toHaveBeenCalled();
    });

    it('envia token sem espaços', async () => {
      await useCases.resetPassword.execute({ token: ' abc ', newPassword: 'segura123' });
      expect(repository.resetPassword).toHaveBeenCalledWith({
        token: 'abc',
        newPassword: 'segura123',
      });
    });
  });

  describe('ChangePasswordUseCase', () => {
    it('exige senha atual, nova senha forte e diferente da atual', () => {
      expect(() =>
        useCases.changePassword.execute({ currentPassword: '', newPassword: 'segura123' }),
      ).toThrow('Informe sua senha atual.');
      expect(() =>
        useCases.changePassword.execute({ currentPassword: 'antiga1', newPassword: 'fraca' }),
      ).toThrow(AuthError);
      expect(() =>
        useCases.changePassword.execute({ currentPassword: 'segura123', newPassword: 'segura123' }),
      ).toThrow('diferente da atual');
      expect(repository.changePassword).not.toHaveBeenCalled();
    });
  });

  it('GetCurrentUser e Logout delegam ao repositório', async () => {
    await expect(useCases.getCurrentUser.execute()).resolves.toEqual(user);
    await useCases.logout.execute();
    expect(repository.logout).toHaveBeenCalledTimes(1);
  });
});
