import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { createDataLayer } from '@/app/composition/create-data-layer';
import { AppProviders } from '@/app/providers/AppProviders';
import { appRoutes } from '@/app/router/routes';
import { DEV_DEMO_ACCOUNT } from '@/features/auth/infrastructure/dev/dev-users.seed';
import { DevAuthRepository } from '@/features/auth/infrastructure/repositories/dev-auth.repository';
import { asIsoDate } from '@/lib/dates';
import { createQueryClient } from '@/lib/query-client';

export const DEMO = { email: DEV_DEMO_ACCOUNT.email, password: DEV_DEMO_ACCOUNT.password };

/** "Hoje" fixo nos testes de integração: resultados determinísticos. */
export const TEST_TODAY = asIsoDate('2026-11-06');

let databaseCounter = 0;

interface RenderAppOptions {
  /** Inicia já autenticado com a conta de demonstração. */
  authenticated?: boolean;
  routeState?: unknown;
}

/**
 * Renderiza a aplicação completa (providers + rotas reais) em memória, com o
 * adaptador de autenticação de desenvolvimento sem latência e um banco de
 * demonstração isolado por teste (IndexedDB simulado).
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

  const today = () => TEST_TODAY;
  const dataLayer = createDataLayer({
    source: 'mock',
    today,
    getHttpClient: () => {
      throw new Error('API indisponível em testes.');
    },
    databaseName: `fincore-test-${++databaseCounter}`,
  });

  const [pathname, search = ''] = initialPath.split('?');
  const router = createMemoryRouter(appRoutes, {
    initialEntries: [{ pathname, search: search ? `?${search}` : '', state: options.routeState }],
  });

  const view = render(
    <AppProviders
      queryClient={queryClient}
      authInfrastructure={{ repository, adapter: 'dev', demoCredentials: DEMO }}
      dataLayer={dataLayer}
      today={today}
    >
      <RouterProvider router={router} />
    </AppProviders>,
  );

  return { ...view, router, repository, queryClient, resetLinks, dataLayer };
}
