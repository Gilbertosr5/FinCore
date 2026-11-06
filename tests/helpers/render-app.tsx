import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { AppProviders } from '@/app/providers/AppProviders';
import { appRoutes } from '@/app/router/routes';
import { DEV_DEMO_ACCOUNT } from '@/features/auth/infrastructure/dev/dev-users.seed';
import { DevAuthRepository } from '@/features/auth/infrastructure/repositories/dev-auth.repository';
import { createQueryClient } from '@/lib/query-client';

export const DEMO = { email: DEV_DEMO_ACCOUNT.email, password: DEV_DEMO_ACCOUNT.password };

interface RenderAppOptions {
  /** Inicia já autenticado com a conta de demonstração. */
  authenticated?: boolean;
  routeState?: unknown;
}

/**
 * Renderiza a aplicação completa (providers + rotas reais) em memória, com o
 * adaptador de autenticação de desenvolvimento sem latência.
 */
export async function renderApp(initialPath: string, options: RenderAppOptions = {}) {
  const resetLinks: string[] = [];
  const repository = new DevAuthRepository({
    storage: sessionStorage,
    latencyMs: 0,
    onPasswordResetLink: (link) => resetLinks.push(link),
  });
  if (options.authenticated) await repository.login(DEMO);

  const queryClient = createQueryClient();
  // Testes não devem repetir consultas que falham.
  queryClient.setDefaultOptions({ queries: { retry: false } });

  const router = createMemoryRouter(appRoutes, {
    initialEntries: [{ pathname: initialPath, state: options.routeState }],
  });

  const view = render(
    <AppProviders
      queryClient={queryClient}
      authInfrastructure={{ repository, adapter: 'dev', demoCredentials: DEMO }}
    >
      <RouterProvider router={router} />
    </AppProviders>,
  );

  return { ...view, router, repository, queryClient, resetLinks };
}
