import { DomainError } from '@/lib/errors/domain-error';

export type AuthErrorCode =
  | 'invalid_credentials'
  | 'email_already_registered'
  | 'invalid_reset_token'
  | 'invalid_current_password'
  | 'not_authenticated'
  | 'invalid_input';

const MESSAGES: Record<AuthErrorCode, string> = {
  // Mensagem única para e-mail ou senha incorretos: não revela se o e-mail existe.
  invalid_credentials: 'E-mail ou senha incorretos.',
  email_already_registered: 'Já existe uma conta com este e-mail.',
  invalid_reset_token: 'O link de redefinição é inválido ou expirou. Solicite um novo.',
  invalid_current_password: 'A senha atual está incorreta.',
  not_authenticated: 'Você precisa estar autenticado para realizar esta ação.',
  invalid_input: 'Verifique os dados informados.',
};

export class AuthError extends DomainError<AuthErrorCode> {
  constructor(code: AuthErrorCode, message?: string) {
    super(code, message ?? MESSAGES[code]);
    this.name = 'AuthError';
  }
}

export function isAuthError(error: unknown, code?: AuthErrorCode): error is AuthError {
  return error instanceof AuthError && (code === undefined || error.code === code);
}
