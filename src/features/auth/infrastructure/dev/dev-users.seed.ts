/**
 * Conta de DEMONSTRAÇÃO do adaptador de autenticação de desenvolvimento.
 * Não é uma credencial real: existe apenas em memória no navegador e só é
 * utilizada quando VITE_AUTH_ADAPTER=dev.
 */
export const DEV_DEMO_ACCOUNT = {
  id: 'demo-user-0001',
  name: 'Ana Demonstração',
  email: 'demo@fincore.dev',
  password: 'Demo@2026',
} as const;
