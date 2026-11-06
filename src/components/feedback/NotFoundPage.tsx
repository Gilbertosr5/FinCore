import { Compass } from 'lucide-react';
import { Link } from 'react-router';

import { Button } from '@/components/ui/button';
import { ROUTES } from '@/constants/routes';

import { StatusScreen } from './StatusScreen';

export function NotFoundPage() {
  return (
    <StatusScreen
      fullScreen
      icon={Compass}
      title="Página não encontrada"
      description="O endereço acessado não existe ou foi movido."
      actions={
        <Button asChild>
          <Link to={ROUTES.dashboard}>Voltar ao início</Link>
        </Button>
      }
    />
  );
}
