import { createContext, useContext } from 'react';

import type { AuthAdapterKind } from '@/app/config/app.config';

import type { AuthUseCases } from '../../application/use-cases/auth.use-cases';

export interface AuthServices {
  useCases: AuthUseCases;
  adapter: AuthAdapterKind;
  /** Credenciais da conta de demonstração (somente adaptador de desenvolvimento). */
  demoCredentials: { email: string; password: string } | null;
}

export const AuthServicesContext = createContext<AuthServices | null>(null);

export function useAuthServices(): AuthServices {
  const services = useContext(AuthServicesContext);
  if (!services) {
    throw new Error('useAuthServices deve ser usado dentro de <AuthProvider>.');
  }
  return services;
}
