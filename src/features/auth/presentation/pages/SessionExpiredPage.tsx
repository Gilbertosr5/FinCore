import { useQueryClient } from '@tanstack/react-query';
import { Clock } from 'lucide-react';
import { useEffect } from 'react';
import { Link, useLocation } from 'react-router';

import { Button } from '@/components/ui/button';
import { ROUTES } from '@/constants/routes';

import { AuthPageHeader } from '../components/AuthPageHeader';
import { clearSessionData } from '../hooks/use-auth';
import { getFromState } from '../utils/safe-redirect';

export function SessionExpiredPage() {
  const location = useLocation();
  const from = getFromState(location.state);
  const queryClient = useQueryClient();

  // Remove todos os dados do usuário anterior assim que a tela é exibida.
  useEffect(() => {
    clearSessionData(queryClient);
  }, [queryClient]);

  return (
    <div className="flex flex-col items-start gap-6">
      <span
        aria-hidden="true"
        className="grid size-12 place-items-center rounded-xl bg-warning/15 text-warning"
      >
        <Clock className="size-6" />
      </span>
      <AuthPageHeader
        title="Sua sessão expirou"
        description="Por segurança, você foi desconectado. Seus dados não foram alterados. Entre novamente para continuar de onde parou."
      />
      <Button asChild size="lg" className="w-full">
        <Link to={ROUTES.login} state={from === undefined ? undefined : { from }}>
          Entrar novamente
        </Link>
      </Button>
    </div>
  );
}
