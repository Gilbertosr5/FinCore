import { AppConfigError, parseAppConfig } from './env.schema';

const dev = { mode: 'development', isProduction: false };
const prod = { mode: 'production', isProduction: true };

describe('parseAppConfig', () => {
  it('aplica padrões seguros em desenvolvimento', () => {
    const config = parseAppConfig({}, dev);
    expect(config).toMatchObject({
      appName: 'FinCore',
      environment: 'development',
      dataSource: 'mock',
      authAdapter: 'dev',
      defaultTimeZone: 'America/Sao_Paulo',
      currency: 'BRL',
      isDemo: true,
      api: { baseUrl: 'http://localhost:8080/api/v1', timeoutMs: 15000 },
    });
  });

  it('usa o adaptador REST por padrão em produção', () => {
    const config = parseAppConfig({ VITE_DATA_SOURCE: 'api' }, prod);
    expect(config.authAdapter).toBe('rest');
    expect(config.isDemo).toBe(false);
  });

  it('bloqueia autenticação de desenvolvimento em produção', () => {
    expect(() => parseAppConfig({ VITE_AUTH_ADAPTER: 'dev' }, prod)).toThrow(AppConfigError);
  });

  it('permite autenticação de desenvolvimento em produção somente em modo demonstração explícito', () => {
    const config = parseAppConfig({ VITE_AUTH_ADAPTER: 'dev', VITE_DEMO_MODE: 'true' }, prod);
    expect(config.authAdapter).toBe('dev');
    expect(config.isDemo).toBe(true);
  });

  it('remove barra final da URL base e converte timeout', () => {
    const config = parseAppConfig(
      { VITE_API_BASE_URL: 'https://api.exemplo.com/v1/', VITE_API_TIMEOUT_MS: '5000' },
      dev,
    );
    expect(config.api).toEqual({ baseUrl: 'https://api.exemplo.com/v1', timeoutMs: 5000 });
  });

  it.each([
    [{ VITE_DATA_SOURCE: 'firebase' }],
    [{ VITE_API_BASE_URL: 'ftp://x' }],
    [{ VITE_API_TIMEOUT_MS: '10' }],
    [{ VITE_DEFAULT_TIMEZONE: 'Brasil/Lugar' }],
  ])('rejeita configuração inválida %o', (env) => {
    expect(() => parseAppConfig(env, dev)).toThrow(AppConfigError);
  });
});
