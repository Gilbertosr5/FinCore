import { useState, type ReactNode } from 'react';

import { appConfig } from '@/app/config/app.config';
import {
  AuthServicesContext,
  createAuthInfrastructure,
  createAuthUseCases,
  type AuthInfrastructure,
  type AuthServices,
} from '@/features/auth';

interface AuthProviderProps {
  children: ReactNode;
  /** Permite injetar a infraestrutura (testes). Padrão: definida por VITE_AUTH_ADAPTER. */
  infrastructure?: AuthInfrastructure;
}

/**
 * Raiz de composição da autenticação: instancia o repositório escolhido por
 * configuração e os casos de uso, disponibilizando-os via contexto.
 * O estado da sessão (usuário atual) vive no TanStack Query.
 */
export function AuthProvider({ children, infrastructure }: AuthProviderProps) {
  const [services] = useState<AuthServices>(() => {
    const infra = infrastructure ?? createAuthInfrastructure(appConfig.authAdapter);
    return {
      useCases: createAuthUseCases(infra.repository),
      adapter: infra.adapter,
      demoCredentials: infra.demoCredentials,
    };
  });

  return <AuthServicesContext.Provider value={services}>{children}</AuthServicesContext.Provider>;
}
