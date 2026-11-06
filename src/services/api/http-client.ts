import axios, {
  type AxiosAdapter,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';

import { normalizeHttpError, type ApiError } from './api-error';

declare module 'axios' {
  interface AxiosRequestConfig {
    /**
     * Não tenta renovar a sessão em caso de 401. Usado nos endpoints de
     * autenticação (login, cadastro, refresh, recuperação de senha).
     */
    skipSessionRefresh?: boolean;
    /**
     * Não dispara o evento de sessão expirada em caso de 401. Usado na
     * consulta do usuário atual, em que 401 significa apenas "não autenticado".
     */
    suppressUnauthorizedEvent?: boolean;
  }
}

interface RetriableConfig extends InternalAxiosRequestConfig {
  _sessionRetried?: boolean;
}

export interface HttpClientOptions {
  baseUrl: string;
  timeoutMs: number;
  /**
   * Tenta renovar a sessão (ex.: POST /auth/refresh). Deve resolver `true` se
   * a sessão foi renovada. Chamadas concorrentes compartilham a mesma tentativa.
   */
  refreshSession?: () => Promise<boolean>;
  /** Chamado quando a sessão não pôde ser renovada após um 401. */
  onUnauthorized?: (error: ApiError) => void;
  /** Permite injetar um adaptador HTTP (testes). */
  adapter?: AxiosAdapter;
}

/**
 * Fábrica do cliente HTTP. Único ponto da aplicação que conhece o Axios.
 *
 * Decisões:
 * - `withCredentials: true`: a sessão é mantida por cookie HttpOnly emitido pelo
 *   backend. Nenhum token é lido ou armazenado pelo JavaScript.
 * - Proteção CSRF: compatível com o padrão do Spring Security
 *   (cookie XSRF-TOKEN -> header X-XSRF-TOKEN).
 * - 401: tenta renovar a sessão uma única vez e repete a requisição original;
 *   se falhar, notifica `onUnauthorized`.
 * - Todo erro é normalizado para ApiError.
 */
export function createHttpClient(options: HttpClientOptions): AxiosInstance {
  const client = axios.create({
    baseURL: options.baseUrl,
    timeout: options.timeoutMs,
    withCredentials: true,
    xsrfCookieName: 'XSRF-TOKEN',
    xsrfHeaderName: 'X-XSRF-TOKEN',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    ...(options.adapter ? { adapter: options.adapter } : {}),
  });

  let refreshInFlight: Promise<boolean> | null = null;

  const refreshOnce = (): Promise<boolean> => {
    if (!options.refreshSession) return Promise.resolve(false);
    refreshInFlight ??= options.refreshSession().finally(() => {
      refreshInFlight = null;
    });
    return refreshInFlight;
  };

  client.interceptors.response.use(undefined, async (error: unknown) => {
    const apiError = normalizeHttpError(error);
    if (apiError.kind !== 'unauthorized') throw apiError;

    const config = axios.isAxiosError(error)
      ? (error.config as RetriableConfig | undefined)
      : undefined;

    if (config && !config.skipSessionRefresh && !config._sessionRetried) {
      const refreshed = await refreshOnce().catch(() => false);
      if (refreshed) {
        config._sessionRetried = true;
        return client.request(config);
      }
    }

    if (!config?.suppressUnauthorizedEvent) {
      options.onUnauthorized?.(apiError);
    }
    throw apiError;
  });

  return client;
}
