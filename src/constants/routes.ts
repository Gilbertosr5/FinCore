/** Caminhos de rota centralizados. Nunca escreva URLs literais em componentes. */
export const ROUTES = {
  root: '/',

  // Autenticação (públicas)
  login: '/entrar',
  register: '/cadastro',
  forgotPassword: '/recuperar-senha',
  resetPassword: '/redefinir-senha',
  sessionExpired: '/sessao-expirada',
  unauthorized: '/acesso-negado',

  // Módulos (privadas)
  dashboard: '/dashboard',
  transactions: '/transacoes',
  accounts: '/contas',
  creditCards: '/cartoes',
  budgets: '/orcamentos',
  goals: '/metas',
  investments: '/investimentos',
  planning: '/planejamento',
  calendar: '/calendario',
  reports: '/relatorios',
  settings: '/configuracoes',
} as const;

export type AppRoutePath = (typeof ROUTES)[keyof typeof ROUTES];

/** Rotas de autenticação: não são destinos válidos de redirecionamento pós-login. */
export const AUTH_ROUTE_PATHS: readonly string[] = [
  ROUTES.login,
  ROUTES.register,
  ROUTES.forgotPassword,
  ROUTES.resetPassword,
  ROUTES.sessionExpired,
  ROUTES.unauthorized,
];

/** Caminho do extrato de uma conta. */
export function accountStatementPath(accountId: string): string {
  return `${ROUTES.accounts}/${encodeURIComponent(accountId)}`;
}
