import type { User } from '../../domain/entities/user';
import { AuthError } from '../../domain/errors/auth-error';
import type { AuthRepository } from '../../domain/repositories/auth.repository';
import {
  getPasswordIssues,
  isValidEmail,
  isValidName,
  normalizeEmail,
  normalizeName,
  PASSWORD_ISSUE_MESSAGES,
} from '../../domain/rules/credentials.rules';
import type {
  ChangePasswordData,
  LoginCredentials,
  RegisterData,
  ResetPasswordData,
} from '../../domain/types/auth.types';

/**
 * Casos de uso de autenticação. Validam as regras de negócio antes de acionar o
 * repositório e normalizam dados (e-mail em minúsculas, nome sem espaços extras).
 */

function assertValidEmail(email: string): void {
  if (!isValidEmail(email)) throw new AuthError('invalid_input', 'Informe um e-mail válido.');
}

function assertStrongPassword(password: string): void {
  const [issue] = getPasswordIssues(password);
  if (issue) throw new AuthError('invalid_input', PASSWORD_ISSUE_MESSAGES[issue]);
}

export class LoginUseCase {
  constructor(private readonly repository: AuthRepository) {}

  execute({ email, password }: LoginCredentials): Promise<User> {
    assertValidEmail(email);
    if (password.length === 0) throw new AuthError('invalid_input', 'Informe sua senha.');
    return this.repository.login({ email: normalizeEmail(email), password });
  }
}

export class RegisterUseCase {
  constructor(private readonly repository: AuthRepository) {}

  execute({ name, email, password }: RegisterData): Promise<User> {
    if (!isValidName(name)) throw new AuthError('invalid_input', 'Informe seu nome completo.');
    assertValidEmail(email);
    assertStrongPassword(password);
    return this.repository.register({
      name: normalizeName(name),
      email: normalizeEmail(email),
      password,
    });
  }
}

export class LogoutUseCase {
  constructor(private readonly repository: AuthRepository) {}

  execute(): Promise<void> {
    return this.repository.logout();
  }
}

export class GetCurrentUserUseCase {
  constructor(private readonly repository: AuthRepository) {}

  execute(): Promise<User | null> {
    return this.repository.getCurrentUser();
  }
}

export class RecoverPasswordUseCase {
  constructor(private readonly repository: AuthRepository) {}

  execute(email: string): Promise<void> {
    assertValidEmail(email);
    return this.repository.requestPasswordReset(normalizeEmail(email));
  }
}

export class ResetPasswordUseCase {
  constructor(private readonly repository: AuthRepository) {}

  execute({ token, newPassword }: ResetPasswordData): Promise<void> {
    if (token.trim() === '') throw new AuthError('invalid_reset_token');
    assertStrongPassword(newPassword);
    return this.repository.resetPassword({ token: token.trim(), newPassword });
  }
}

export class ChangePasswordUseCase {
  constructor(private readonly repository: AuthRepository) {}

  execute({ currentPassword, newPassword }: ChangePasswordData): Promise<void> {
    if (currentPassword.length === 0) {
      throw new AuthError('invalid_input', 'Informe sua senha atual.');
    }
    assertStrongPassword(newPassword);
    if (currentPassword === newPassword) {
      throw new AuthError('invalid_input', 'A nova senha deve ser diferente da atual.');
    }
    return this.repository.changePassword({ currentPassword, newPassword });
  }
}

export interface AuthUseCases {
  login: LoginUseCase;
  register: RegisterUseCase;
  logout: LogoutUseCase;
  getCurrentUser: GetCurrentUserUseCase;
  recoverPassword: RecoverPasswordUseCase;
  resetPassword: ResetPasswordUseCase;
  changePassword: ChangePasswordUseCase;
}

export function createAuthUseCases(repository: AuthRepository): AuthUseCases {
  return {
    login: new LoginUseCase(repository),
    register: new RegisterUseCase(repository),
    logout: new LogoutUseCase(repository),
    getCurrentUser: new GetCurrentUserUseCase(repository),
    recoverPassword: new RecoverPasswordUseCase(repository),
    resetPassword: new ResetPasswordUseCase(repository),
    changePassword: new ChangePasswordUseCase(repository),
  };
}
