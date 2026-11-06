import type { QueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import type { DataLayer } from '@/app/composition/create-data-layer';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { AuthInfrastructure } from '@/features/auth';
import type { IsoDate } from '@/lib/dates';

import { AuthProvider } from './AuthProvider';
import { DataProvider } from './DataProvider';
import { QueryProvider } from './QueryProvider';
import { ThemeProvider } from './ThemeProvider';

interface AppProvidersProps {
  children: ReactNode;
  /** Injeções para testes. */
  queryClient?: QueryClient;
  authInfrastructure?: AuthInfrastructure;
  dataLayer?: DataLayer;
  today?: () => IsoDate;
}

/** Composição de todos os providers globais, em ordem de dependência. */
export function AppProviders({
  children,
  queryClient,
  authInfrastructure,
  dataLayer,
  today,
}: AppProvidersProps) {
  return (
    <ThemeProvider>
      <QueryProvider client={queryClient}>
        <AuthProvider infrastructure={authInfrastructure}>
          <DataProvider dataLayer={dataLayer} today={today}>
            <TooltipProvider>
              {children}
              <Toaster />
            </TooltipProvider>
          </DataProvider>
        </AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
