import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';

export interface FakeResponse {
  status: number;
  data?: unknown;
  headers?: Record<string, string>;
}

export type FakeHandler = (config: InternalAxiosRequestConfig) => FakeResponse;

export interface FakeAdapter extends AxiosAdapter {
  calls: { method: string; url: string; body: unknown }[];
}

/** Adaptador HTTP falso para o Axios: responde conforme o handler, sem rede. */
export function fakeHttpAdapter(handler: FakeHandler): FakeAdapter {
  const calls: FakeAdapter['calls'] = [];
  const adapter = (config: InternalAxiosRequestConfig) => {
    const body: unknown = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
    calls.push({ method: config.method?.toUpperCase() ?? 'GET', url: config.url ?? '', body });
    const { status, data, headers = {} } = handler(config);
    const response = { status, statusText: '', data, headers, config };
    if (status >= 400) {
      return Promise.reject(
        new AxiosError('fail', AxiosError.ERR_BAD_RESPONSE, config, null, response),
      );
    }
    return Promise.resolve(response);
  };
  return Object.assign(adapter, { calls });
}
