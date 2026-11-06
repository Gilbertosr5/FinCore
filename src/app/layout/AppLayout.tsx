import { Suspense } from 'react';
import { Outlet } from 'react-router';

import { appConfig } from '@/app/config/app.config';
import { PageLoader } from '@/components/feedback/PageLoader';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { UserMenu } from '@/features/auth';

/** Shell das rotas autenticadas: sidebar, cabeçalho e área de conteúdo. */
export function AppLayout() {
  return (
    <div className="flex min-h-dvh bg-background">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Pular para o conteúdo
      </a>
      <Sidebar appName={appConfig.appName} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header isDemo={appConfig.isDemo} userMenu={<UserMenu />} />
        <main id="main-content" tabIndex={-1} className="flex-1 p-4 outline-none md:p-6 lg:p-8">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
