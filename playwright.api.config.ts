import { defineConfig, devices } from '@playwright/test';

/**
 * E2E no modo integrado (ADR 0015): o build `--mode api` do frontend contra a
 * `fincore-api` real, com PostgreSQL embutido (PGlite) em memória — cada execução
 * começa com o banco vazio e não precisa de nada instalado.
 *
 * - API em :8090 (porta própria para não colidir com `npm run dev` da API em :8080);
 * - front em :4180 (`vite preview`), que encaminha `/api` para a API (proxy do
 *   Vite herdado pelo preview): mesma origem para cookies e X-XSRF-TOKEN.
 *
 * Rode com `npm run test:e2e:api` (a pasta `../fincore-api` precisa de `npm install`).
 */
const API_PORT = 8090;
const WEB_PORT = 4180;
const WEB_URL = `http://localhost:${String(WEB_PORT)}`;
const API_URL = `http://127.0.0.1:${String(API_PORT)}`;

export default defineConfig({
  testDir: './tests/e2e-api',
  // Um banco para todos os testes: cada teste cria o próprio usuário.
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 60_000,
  use: {
    baseURL: WEB_URL,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'api-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'api-mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      command: 'npx tsx src/server.ts',
      cwd: '../fincore-api',
      url: `${API_URL}/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        NODE_ENV: 'development',
        HOST: '127.0.0.1',
        PORT: String(API_PORT),
        LOG_LEVEL: 'warn',
        DATABASE_URL: 'pglite:memory',
        DB_MIGRATE_ON_START: 'true',
        CORS_ORIGINS: '',
        COOKIE_SECURE: 'false',
        APP_TIMEZONE: 'America/Sao_Paulo',
        APP_PUBLIC_URL: WEB_URL,
        // Cada teste cadastra um usuário: o limite de produção (10/min) travaria a suíte.
        AUTH_RATE_LIMIT_PER_MINUTE: '1000',
      },
    },
    {
      command: `npx vite build --mode api --outDir dist-e2e-api && npx vite preview --mode api --outDir dist-e2e-api --port ${String(WEB_PORT)} --strictPort`,
      url: WEB_URL,
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        VITE_API_BASE_URL: `${WEB_URL}/api/v1`,
        FINCORE_API_URL: API_URL,
      },
    },
  ],
});
