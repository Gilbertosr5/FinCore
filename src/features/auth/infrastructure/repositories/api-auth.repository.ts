import type { AxiosInstance } from 'axios';

import { isApiError } from '@/services/api/api-error';

import type { User } from '../../domain/entities/user';
import { AuthError } from '../../domain/errors/auth-error';
import type { AuthRepository } from '../../domain/repositories/auth.repository';
import type {
  ChangePasswordData,
  LoginCredentials,
  RegisterData,
  ResetPasswordData,
} from '../../domain/types/auth.types';
import { toUser } from '../mappers/user.mapper';

/** Endpoints de autenticação (contrato em docs/auth-contract.md). */
export const AUTH_ENDPOINTS = {
  login: '/auth/login',
  register: '/auth/register',
  logout: '/auth/logout',
  me: '/auth/me',
  forgotPassword: '/auth/password/forgot',
  resetPassword: '/auth/password/reset',
  changePassword: '/auth/password/change',
} as const;

/** Endpoints públicos: um 401 aqui não significa sessão expirada. */
const PUBLIC_REQUEST = { skipSessionRefresh: true, suppressUnauthorizedEvent: true } as const;

/**
 * Adaptador REST. A sessão é estabelecida pelo backend via cookie HttpOnly
 * (Set-Cookie na resposta de login/cadastro); nenhum token passa pelo JavaScript.
 */
export class ApiAuthRepository implements AuthRepository {
  constructor(private readonly http: AxiosInstance) {}

  async login(credentials: LoginCredentials): Promise<User> {
    try {
      const { data } = await this.http.post<unknown>(
        AUTH_ENDPOINTS.login,
        credentials,
        PUBLIC_REQUEST,
      );
      return toUser(data);
    } catch (error) {
      if (isApiError(error) && error.kind === 'unauthorized') {
        throw new AuthError('invalid_credentials');
      }
      throw error;
    }
  }

  async register(input: RegisterData): Promise<User> {
    try {
      const { data } = await this.http.post<unknown>(
        AUTH_ENDPOINTS.register,
        input,
        PUBLIC_REQUEST,
      );
      return toUser(data);
    } catch (error) {
      if (isApiError(error) && error.kind === 'conflict') {
        throw new AuthError('email_already_registered');
      }
      throw error;
    }
  }

  async logout(): Promise<void> {
    try {
      await this.http.post(AUTH_ENDPOINTS.logout, null, PUBLIC_REQUEST);
    } catch (error) {
      // Sessão já inexistente equivale a logout concluído.
      if (isApiError(error) && error.kind === 'unauthorized') return;
      throw error;
    }
  }

  async getCurrentUser(): Promise<User | null> {
    try {
      // Pode renovar a sessão, mas 401 aqui significa apenas "não autenticado".
      const { data } = await this.http.get<unknown>(AUTH_ENDPOINTS.me, {
        suppressUnauthorizedEvent: true,
      });
      return toUser(data);
    } catch (error) {
      if (isApiError(error) && error.kind === 'unauthorized') return null;
      throw error;
    }
  }

  async requestPasswordReset(email: string): Promise<void> {
    await this.http.post(AUTH_ENDPOINTS.forgotPassword, { email }, PUBLIC_REQUEST);
  }

  async resetPassword(input: ResetPasswordData): Promise<void> {
    try {
      await this.http.post(AUTH_ENDPOINTS.resetPassword, input, PUBLIC_REQUEST);
    } catch (error) {
      if (
        isApiError(error) &&
        (error.code === 'INVALID_RESET_TOKEN' || error.kind === 'not_found')
      ) {
        throw new AuthError('invalid_reset_token');
      }
      throw error;
    }
  }

  async changePassword(input: ChangePasswordData): Promise<void> {
    try {
      await this.http.post(AUTH_ENDPOINTS.changePassword, input);
    } catch (error) {
      if (isApiError(error) && error.code === 'INVALID_CURRENT_PASSWORD') {
        throw new AuthError('invalid_current_password');
      }
      throw error;
    }
  }
}
