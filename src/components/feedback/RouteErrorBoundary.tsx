import { TriangleAlert } from 'lucide-react';
import { isRouteErrorResponse, Link, useRouteError } from 'react-router';

import { Button } from '@/components/ui/button';
import { ROUTES } from '@/constants/routes';
import { CHUNK_LOAD_MESSAGE, isChunkLoadError } from '@/lib/errors';

/**
 * Captura erros de renderização/carregamento de rotas. Não exibe stack trace
 * nem mensagens internas ao usuário; detalhes vão apenas para o console.
 */
export function RouteErrorBoundary() {
  const error = useRouteError();
  console.error(error);

  const chunkFailed = isChunkLoadError(error);
  const title =
    isRouteErrorResponse(error) && error.status === 404
      ? 'Página não encontrada'
      : chunkFailed
        ? 'Atualização necessária'
        : 'Algo deu errado';

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <span
        aria-hidden="true"
        className="grid size-14 place-items-center rounded-2xl bg-destructive/15 text-destructive"
      >
        <TriangleAlert className="size-7" />
      </span>
      <div role="alert" className="flex max-w-md flex-col gap-2">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">
          {chunkFailed
            ? CHUNK_LOAD_MESSAGE
            : 'Não foi possível exibir esta tela. Seus dados não foram alterados.'}
        </p>
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => {
            window.location.reload();
          }}
        >
          Recarregar
        </Button>
        <Button asChild>
          <Link to={ROUTES.dashboard}>Ir para o início</Link>
        </Button>
      </div>
    </div>
  );
}
