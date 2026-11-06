import { parseAppConfig } from './env.schema';

export type { AppConfig, AuthAdapterKind, DataSource } from './env.schema';
export { AppConfigError } from './env.schema';

/**
 * Configuração central da aplicação, validada uma única vez na carga do módulo.
 * Se inválida, lança AppConfigError — capturado pelo bootstrap em main.tsx.
 */
export const appConfig = Object.freeze(
  parseAppConfig(import.meta.env, {
    mode: import.meta.env.MODE,
    isProduction: import.meta.env.PROD,
  }),
);
