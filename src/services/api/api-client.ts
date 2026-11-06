import { appConfig } from '@/app/config/app.config';
import { sessionEvents } from '@/services/auth/session-events';

import { createHttpClient } from './http-client';

/** Endpoint de renovação de sessão (contrato em docs/auth-contract.md). */
export const SESSION_REFRESH_PATH = '/auth/refresh';

/**
 * Instância compartilhada do cliente HTTP, usada exclusivamente pelos
 * repositórios `Api*Repository` da camada de infraestrutura.
 */
export const apiClient = createHttpClient({
  baseUrl: appConfig.api.baseUrl,
  timeoutMs: appConfig.api.timeoutMs,
  refreshSession: async () => {
    try {
      await apiClient.post(SESSION_REFRESH_PATH, null, { skipSessionRefresh: true });
      return true;
    } catch {
      return false;
    }
  },
  onUnauthorized: () => {
    sessionEvents.emit('expired');
  },
});
