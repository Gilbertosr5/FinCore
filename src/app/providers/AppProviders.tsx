import type { QueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { AuthInfrastructure } from '@/features/auth';

import { AuthProvider } from './AuthProvider';
import { QueryProvider } from './QueryProvider';
import { ThemeProvider } from './ThemeProvider';

interface AppProvidersProps {
  children: ReactNode;
  /** Injeções para testes. */
  queryClient?: QueryClient;
  authInfrastructure?: AuthInfrastructure;
}

/** Composição de todos os providers globais, em ordem de dependência. */
export function AppProviders({ children, queryClient, authInfrastructure }: AppProvidersProps) {
  return (
    <ThemeProvider>
      <QueryProvider client={queryClient}>
        <AuthProvider infrastructure={authInfrastructure}>
          <TooltipProvider>
            {children}
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
