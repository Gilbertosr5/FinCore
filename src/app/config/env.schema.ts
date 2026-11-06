import { z } from 'zod';

import { isValidTimeZone } from '@/lib/dates';

/**
 * Schema das variáveis de ambiente. Validado na inicialização: configuração
 * inválida impede a aplicação de subir (falha rápida e explícita).
 */
const envSchema = z.object({
  VITE_APP_NAME: z.string().trim().min(1).default('FinCore'),
  VITE_DATA_SOURCE: z.enum(['mock', 'api']).default('mock'),
  VITE_AUTH_ADAPTER: z.enum(['dev', 'rest']).optional(),
  VITE_API_BASE_URL: z.url({ protocol: /^https?$/ }).default('http://localhost:8080/api/v1'),
  VITE_API_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120_000).default(15_000),
  VITE_DEFAULT_TIMEZONE: z
    .string()
    .refine(isValidTimeZone, { message: 'Fuso horário IANA inválido' })
    .default('America/Sao_Paulo'),
  VITE_DEMO_MODE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});

export type DataSource = 'mock' | 'api';
export type AuthAdapterKind = 'dev' | 'rest';

export interface AppConfig {
  appName: string;
  environment: 'development' | 'production' | 'test';
  dataSource: DataSource;
  authAdapter: AuthAdapterKind;
  api: {
    baseUrl: string;
    timeoutMs: number;
  };
  defaultTimeZone: string;
  locale: 'pt-BR';
  currency: 'BRL';
  /** Verdadeiro quando a aplicação exibe dados/autenticação de demonstração. */
  isDemo: boolean;
}

export class AppConfigError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Configuração de ambiente inválida:\n- ${issues.join('\n- ')}`);
    this.name = 'AppConfigError';
    this.issues = issues;
  }
}

export interface RuntimeMode {
  mode: string;
  isProduction: boolean;
}

/**
 * Converte e valida as variáveis de ambiente.
 *
 * Regra de segurança: o adaptador de autenticação de desenvolvimento NÃO é
 * permitido em builds de produção, a menos que o modo demonstração seja
 * explicitamente habilitado (VITE_DEMO_MODE=true), caso em que a interface
 * sinaliza permanentemente que não há autenticação real.
 */
export function parseAppConfig(env: Record<string, unknown>, runtime: RuntimeMode): AppConfig {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    throw new AppConfigError(
      result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    );
  }

  const values = result.data;
  const authAdapter: AuthAdapterKind =
    values.VITE_AUTH_ADAPTER ?? (runtime.isProduction ? 'rest' : 'dev');

  if (runtime.isProduction && authAdapter === 'dev' && !values.VITE_DEMO_MODE) {
    throw new AppConfigError([
      'VITE_AUTH_ADAPTER=dev não é permitido em produção. Use "rest" ou habilite VITE_DEMO_MODE=true.',
    ]);
  }

  const environment = runtime.isProduction
    ? 'production'
    : runtime.mode === 'test'
      ? 'test'
      : 'development';

  return {
    appName: values.VITE_APP_NAME,
    environment,
    dataSource: values.VITE_DATA_SOURCE,
    authAdapter,
    api: {
      baseUrl: values.VITE_API_BASE_URL.replace(/\/+$/, ''),
      timeoutMs: values.VITE_API_TIMEOUT_MS,
    },
    defaultTimeZone: values.VITE_DEFAULT_TIMEZONE,
    locale: 'pt-BR',
    currency: 'BRL',
    isDemo: values.VITE_DEMO_MODE || authAdapter === 'dev' || values.VITE_DATA_SOURCE === 'mock',
  };
}
