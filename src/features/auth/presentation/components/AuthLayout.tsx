import { ChartNoAxesCombined, ShieldCheck, Target } from 'lucide-react';
import { Suspense } from 'react';
import { Outlet } from 'react-router';

import { appConfig } from '@/app/config/app.config';
import { Brand } from '@/components/layout/Brand';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { Spinner } from '@/components/ui/spinner';

const HIGHLIGHTS = [
  { icon: ChartNoAxesCombined, text: 'Receitas, despesas e patrimônio em uma visão consolidada.' },
  { icon: Target, text: 'Orçamentos, metas e planejamento com projeções claras.' },
  { icon: ShieldCheck, text: 'Cálculos com precisão decimal — centavo por centavo.' },
] as const;

/** Layout das telas públicas: painel institucional (desktop) + formulário. */
export function AuthLayout() {
  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden overflow-hidden border-r border-border bg-surface p-10 lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 -left-32 size-96 rounded-full bg-primary/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 bottom-0 size-80 rounded-full bg-secondary-foreground/10 blur-3xl"
        />
        <Brand name={appConfig.appName} />
        <div className="relative flex max-w-md flex-col gap-8">
          <p className="text-3xl leading-tight font-semibold tracking-tight">
            Sua vida financeira, organizada com clareza e precisão.
          </p>
          <ul className="flex flex-col gap-4">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm text-muted-foreground">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
                  <Icon aria-hidden="true" className="size-4" />
                </span>
                <span className="pt-1.5">{text}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-muted-foreground">
          © {new Date().getFullYear()} {appConfig.appName}
        </p>
      </aside>

      <div className="flex flex-col">
        <header className="flex h-16 items-center justify-between px-4 sm:px-8">
          <span className="lg:invisible">
            <Brand name={appConfig.appName} />
          </span>
          <ThemeToggle />
        </header>
        <main className="flex flex-1 items-start justify-center px-4 pt-6 pb-12 sm:items-center sm:px-8">
          <div className="w-full max-w-md">
            <Suspense
              fallback={
                <div role="status" className="flex justify-center py-12">
                  <Spinner className="size-6 text-primary" />
                  <span className="sr-only">Carregando…</span>
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
