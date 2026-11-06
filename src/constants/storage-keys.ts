/**
 * Chaves de armazenamento local do navegador.
 *
 * localStorage é usado SOMENTE para preferências de interface não sensíveis.
 * Dados financeiros de demonstração usam IndexedDB (Fase 4); credenciais e
 * tokens nunca são armazenados no navegador (sessão via cookie HttpOnly).
 */
export const STORAGE_KEYS = {
  theme: 'fincore:theme',
  ui: 'fincore:ui',
  /**
   * sessionStorage — marcador de sessão do adaptador de autenticação de
   * DESENVOLVIMENTO ({userId, expiresAt}). Não contém token nem senha.
   */
  devAuthSession: 'fincore:dev-auth-session',
} as const;
