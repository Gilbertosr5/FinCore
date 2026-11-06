import { ShieldX } from 'lucide-react';
import { Link } from 'react-router';

import { Button } from '@/components/ui/button';
import { ROUTES } from '@/constants/routes';

import { AuthPageHeader } from '../components/AuthPageHeader';

/** Exibida quando o backend recusa o acesso (HTTP 403) a um recurso. */
export function UnauthorizedPage() {
  return (
    <div className="flex flex-col items-start gap-6">
      <span
        aria-hidden="true"
        className="grid size-12 place-items-center rounded-xl bg-destructive/15 text-destructive"
      >
        <ShieldX className="size-6" />
      </span>
      <AuthPageHeader
        title="Acesso não autorizado"
        description="Você não tem permissão para acessar este recurso. Se acredita que isso é um erro, entre em contato com o suporte."
      />
      <Button asChild size="lg" className="w-full">
        <Link to={ROUTES.dashboard}>Voltar ao início</Link>
      </Button>
    </div>
  );
}
