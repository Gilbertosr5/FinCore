import type { AuthAdapterKind } from '@/app/config/app.config';
import { apiClient } from '@/services/api/api-client';

import { DEV_DEMO_ACCOUNT } from './dev/dev-users.seed';
import { ApiAuthRepository } from './repositories/api-auth.repository';
import { DevAuthRepository } from './repositories/dev-auth.repository';
import type { AuthRepository } from '../domain/repositories/auth.repository';

export interface AuthInfrastructure {
  repository: AuthRepository;
  adapter: AuthAdapterKind;
  /** Presente apenas no adaptador de desenvolvimento. */
  demoCredentials: { email: string; password: string } | null;
}

/**
 * Ponto único de composição: escolhe a implementação de AuthRepository
 * conforme VITE_AUTH_ADAPTER.
 */
export function createAuthInfrastructure(adapter: AuthAdapterKind): AuthInfrastructure {
  switch (adapter) {
    case 'dev':
      return {
        repository: new DevAuthRepository(),
        adapter,
        demoCredentials: { email: DEV_DEMO_ACCOUNT.email, password: DEV_DEMO_ACCOUNT.password },
      };
    case 'rest':
      return { repository: new ApiAuthRepository(apiClient), adapter, demoCredentials: null };
  }
}
