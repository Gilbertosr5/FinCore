import { CloudOff } from 'lucide-react';
import { Navigate, Outlet, useLocation } from 'react-router';

import { FullPageLoader } from '@/components/feedback/FullPageLoader';
import { StatusScreen } from '@/components/feedback/StatusScreen';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/constants/routes';
import { useCurrentUser } from '@/features/auth';

/**
 * Protege as rotas privadas: verifica a sessão e redireciona ao login
 * preservando o destino original (`state.from`).
 */
export function ProtectedRoute() {
  const location = useLocation();
  const { data: user, isPending, isError, refetch, isRefetching } = useCurrentUser();

  if (isPending) return <FullPageLoader label="Verificando sua sessão…" />;

  if (isError) {
    return (
      <StatusScreen
        fullScreen
        tone="destructive"
        icon={CloudOff}
        title="Não foi possível verificar sua sessão"
        description="Verifique sua conexão e tente novamente."
        actions={
          <Button
            disabled={isRefetching}
            onClick={() => {
              void refetch();
            }}
          >
            Tentar novamente
          </Button>
        }
      />
    );
  }

  if (!user) return <Navigate to={ROUTES.login} replace state={{ from: location }} />;

  return <Outlet />;
}
