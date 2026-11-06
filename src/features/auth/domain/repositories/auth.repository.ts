import type { User } from '../entities/user';
import type {
  ChangePasswordData,
  LoginCredentials,
  RegisterData,
  ResetPasswordData,
} from '../types/auth.types';

/**
 * Contrato de autenticação, independente de provedor.
 *
 * Implementações:
 * - DevAuthRepository: somente desenvolvimento local (não é autenticação real).
 * - ApiAuthRepository: backend REST (contrato em docs/auth-contract.md).
 *
 * Erros de regra devem ser lançados como AuthError; falhas de comunicação,
 * como ApiError.
 */
export interface AuthRepository {
  login(credentials: LoginCredentials): Promise<User>;
  register(data: RegisterData): Promise<User>;
  logout(): Promise<void>;
  /** Retorna o usuário da sessão atual ou `null` se não houver sessão válida. */
  getCurrentUser(): Promise<User | null>;
  /** Sempre resolve sem revelar se o e-mail está cadastrado. */
  requestPasswordReset(email: string): Promise<void>;
  resetPassword(data: ResetPasswordData): Promise<void>;
  changePassword(data: ChangePasswordData): Promise<void>;
}
