import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useEffect } from 'react';
import { useLocation } from 'react-router';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/stores/ui.store';

import { Brand } from './Brand';
import { SidebarNav } from './SidebarNav';

interface SidebarProps {
  appName: string;
}

/**
 * Desktop (lg+): sidebar fixa e recolhível.
 * Telas menores: gaveta (Sheet) com foco preso, fechamento por Esc/overlay.
 */
export function Sidebar({ appName }: SidebarProps) {
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const mobileNavOpen = useUiStore((state) => state.mobileNavOpen);
  const setMobileNavOpen = useUiStore((state) => state.setMobileNavOpen);
  const { pathname } = useLocation();

  // Fecha a gaveta móvel ao navegar.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname, setMobileNavOpen]);

  return (
    <>
      <aside
        className={cn(
          'hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 lg:flex',
          collapsed ? 'w-[72px]' : 'w-64',
        )}
      >
        <div className={cn('flex h-16 items-center px-5', collapsed && 'justify-center px-0')}>
          <Brand name={appName} compact={collapsed} />
        </div>
        <SidebarNav collapsed={collapsed} />
        <div
          className={cn('border-t border-sidebar-border p-3', collapsed && 'flex justify-center')}
        >
          <Button
            variant="ghost"
            size={collapsed ? 'icon' : 'sm'}
            className={cn('text-sidebar-foreground', !collapsed && 'w-full justify-start')}
            onClick={toggleSidebar}
            aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
            aria-expanded={!collapsed}
          >
            {collapsed ? (
              <PanelLeftOpen aria-hidden="true" />
            ) : (
              <PanelLeftClose aria-hidden="true" />
            )}
            {!collapsed && <span>Recolher menu</span>}
          </Button>
        </div>
      </aside>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="lg:hidden">
          <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
          <SheetDescription className="sr-only">Acesse os módulos do {appName}.</SheetDescription>
          <div className="flex h-16 items-center px-5">
            <Brand name={appName} />
          </div>
          <SidebarNav
            collapsed={false}
            onNavigate={() => {
              setMobileNavOpen(false);
            }}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
