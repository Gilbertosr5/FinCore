import { FlaskConical } from 'lucide-react';
import type { ReactNode } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

import { useAuthServices } from '../context/auth-context';

/**
 * Aviso exibido somente com o adaptador de desenvolvimento: deixa explícito que
 * não há autenticação real.
 */
export function DevAuthNotice({ children }: { children?: ReactNode }) {
  const { adapter } = useAuthServices();
  if (adapter !== 'dev') return null;
  return (
    <Alert variant="warning" role="note">
      <FlaskConical aria-hidden="true" />
      <AlertTitle>Autenticação de desenvolvimento</AlertTitle>
      <AlertDescription>
        <p>Simulada localmente, sem servidor. Não é autenticação real.</p>
        {children}
      </AlertDescription>
    </Alert>
  );
}
