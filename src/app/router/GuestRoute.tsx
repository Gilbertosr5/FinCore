import { Navigate, Outlet, useLocation } from 'react-router';

import { FullPageLoader } from '@/components/feedback/FullPageLoader';
import { getFromState, getSafeRedirectPath, useCurrentUser } from '@/features/auth';

/**
 * Rotas exclusivas para visitantes (login, cadastro, recuperação de senha):
 * usuários autenticados são levados ao destino pretendido ou ao dashboard.
 * Se a verificação de sessão falhar (ex.: offline), o formulário continua acessível.
 */
export function GuestRoute() {
  const location = useLocation();
  const { data: user, isPending } = useCurrentUser();

  if (isPending) return <FullPageLoader label="Verificando sua sessão…" />;
  if (user) {
    return <Navigate to={getSafeRedirectPath(getFromState(location.state))} replace />;
  }
  return <Outlet />;
}
