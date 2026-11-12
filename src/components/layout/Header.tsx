import { FlaskConical, Menu } from 'lucide-react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { NAVIGATION_ITEMS } from '@/constants/navigation';
import { useUiStore } from '@/stores/ui.store';

import { CommandSearch } from './CommandSearch';
import { ThemeToggle } from './ThemeToggle';

interface HeaderProps {
  isDemo: boolean;
  /** Menu do usuário, fornecido pela camada de aplicação (feature de autenticação). */
  userMenu: ReactNode;
  /** Central de notificações, fornecida pela camada de aplicação (alertas financeiros). */
  notifications: ReactNode;
}

export function Header({ isDemo, userMenu, notifications }: HeaderProps) {
  const { pathname } = useLocation();
  const mobileNavOpen = useUiStore((state) => state.mobileNavOpen);
  const setMobileNavOpen = useUiStore((state) => state.setMobileNavOpen);
  const current = NAVIGATION_ITEMS.find(
    (item) => pathname === item.path || pathname.startsWith(`${item.path}/`),
  );

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur sm:gap-3 md:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        aria-label="Abrir menu"
        aria-expanded={mobileNavOpen}
        onClick={() => {
          setMobileNavOpen(true);
        }}
      >
        <Menu aria-hidden="true" />
      </Button>

      <h1 className="truncate text-lg font-semibold tracking-tight">
        {current?.label ?? 'FinCore'}
      </h1>

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <CommandSearch />
        {isDemo && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="warning" tabIndex={0} className="hidden sm:inline-flex">
                <FlaskConical aria-hidden="true" />
                <span className="hidden md:inline">Modo demonstração</span>
                <span className="md:hidden">Demo</span>
              </Badge>
            </TooltipTrigger>
            <TooltipContent>Dados e autenticação de demonstração — sem backend real</TooltipContent>
          </Tooltip>
        )}
        {notifications}
        <ThemeToggle />
        {userMenu}
      </div>
    </header>
  );
}
