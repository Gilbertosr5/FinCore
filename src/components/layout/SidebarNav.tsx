import { NavLink } from 'react-router';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { NAVIGATION_ITEMS } from '@/constants/navigation';
import { cn } from '@/lib/utils';

interface SidebarNavProps {
  collapsed: boolean;
  onNavigate?: () => void;
}

export function SidebarNav({ collapsed, onNavigate }: SidebarNavProps) {
  return (
    <nav aria-label="Navegação principal" className="flex-1 overflow-y-auto px-3 py-4">
      <ul className="flex flex-col gap-1">
        {NAVIGATION_ITEMS.map((item) => {
          const Icon = item.icon;
          const link = (
            <NavLink
              to={item.path}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  isActive && 'bg-sidebar-accent text-sidebar-accent-foreground',
                  collapsed && 'justify-center px-0',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    aria-hidden="true"
                    className={cn('size-[18px] shrink-0', isActive && 'text-primary')}
                  />
                  <span className={cn(collapsed && 'sr-only')}>{item.label}</span>
                </>
              )}
            </NavLink>
          );

          return (
            <li key={item.id}>
              {collapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              ) : (
                link
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
