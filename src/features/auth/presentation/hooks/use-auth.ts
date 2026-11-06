import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import type { User } from '../../domain/entities/user';
import type {
  ChangePasswordData,
  LoginCredentials,
  RegisterData,
  ResetPasswordData,
} from '../../domain/types/auth.types';
import { useAuthServices } from '../context/auth-context';

export const authQueryKeys = {
  all: ['auth'] as const,
  currentUser: ['auth', 'current-user'] as const,
};

/**
 * Remove todos os dados em cache (inclusive financeiros) e marca a sessão como
 * encerrada. Usado em logout e expiração de sessão: nenhum dado do usuário
 * anterior pode permanecer visível.
 */
export function clearSessionData(queryClient: QueryClient): void {
  void queryClient.cancelQueries();
  queryClient.removeQueries({
    predicate: (query) => query.queryKey[0] !== authQueryKeys.all[0],
  });
  queryClient.setQueryData<User | null>(authQueryKeys.currentUser, null);
}

/** Usuário da sessão atual (`null` quando não autenticado). */
export function useCurrentUser() {
  const { useCases } = useAuthServices();
  return useQuery({
    queryKey: authQueryKeys.currentUser,
    queryFn: () => useCases.getCurrentUser.execute(),
    staleTime: 5 * 60_000,
  });
}

export function useLogin() {
  const { useCases } = useAuthServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (credentials: LoginCredentials) => useCases.login.execute(credentials),
    onSuccess: (user) => {
      queryClient.setQueryData(authQueryKeys.currentUser, user);
    },
  });
}

export function useRegister() {
  const { useCases } = useAuthServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: RegisterData) => useCases.register.execute(data),
    onSuccess: (user) => {
      queryClient.setQueryData(authQueryKeys.currentUser, user);
    },
  });
}

export function useLogout() {
  const { useCases } = useAuthServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => useCases.logout.execute(),
    // Mesmo se o servidor falhar, o estado local é limpo: o usuário pediu para sair.
    onSettled: () => {
      clearSessionData(queryClient);
    },
  });
}

export function useRecoverPassword() {
  const { useCases } = useAuthServices();
  return useMutation({
    mutationFn: (email: string) => useCases.recoverPassword.execute(email),
  });
}

export function useResetPassword() {
  const { useCases } = useAuthServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ResetPasswordData) => useCases.resetPassword.execute(data),
    onSuccess: () => {
      // A redefinição encerra sessões existentes.
      clearSessionData(queryClient);
    },
  });
}

export function useChangePassword() {
  const { useCases } = useAuthServices();
  return useMutation({
    mutationFn: (data: ChangePasswordData) => useCases.changePassword.execute(data),
  });
}
