/**
 * API pública da feature de autenticação. Outras features e a camada `app`
 * devem importar somente daqui.
 */

// Domínio
export type { User } from './domain/entities/user';
export { getUserInitials } from './domain/entities/user';
export type { AuthRepository } from './domain/repositories/auth.repository';
export { AuthError, isAuthError, type AuthErrorCode } from './domain/errors/auth-error';

// Aplicação
export { createAuthUseCases, type AuthUseCases } from './application/use-cases/auth.use-cases';

// Infraestrutura
export {
  createAuthInfrastructure,
  type AuthInfrastructure,
} from './infrastructure/create-auth-repository';

// Apresentação
export {
  AuthServicesContext,
  useAuthServices,
  type AuthServices,
} from './presentation/context/auth-context';
export {
  authQueryKeys,
  useChangePassword,
  useCurrentUser,
  useLogout,
} from './presentation/hooks/use-auth';
export { AuthLayout } from './presentation/components/AuthLayout';
export { AuthSessionListener } from './presentation/components/AuthSessionListener';
export { ChangePasswordForm } from './presentation/components/ChangePasswordForm';
export { UserMenu } from './presentation/components/UserMenu';
export { getFromState, getSafeRedirectPath } from './presentation/utils/safe-redirect';
