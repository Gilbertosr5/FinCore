import { LogOut, Settings } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ROUTES } from '@/constants/routes';

import { getUserInitials } from '../../domain/entities/user';
import { useCurrentUser, useLogout } from '../hooks/use-auth';

export function UserMenu() {
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  const navigate = useNavigate();

  if (!user) return null;

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSettled: () => {
        void navigate(ROUTES.login, { replace: true });
      },
      onError: () => {
        toast.warning('Sessão encerrada neste dispositivo, mas o servidor não confirmou o logout.');
      },
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Menu do usuário ${user.name}`}
        className="grid size-9 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary outline-none hover:bg-primary/25 focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span aria-hidden="true">{getUserInitials(user.name)}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate">{user.name}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to={ROUTES.settings}>
            <Settings aria-hidden="true" />
            Configurações
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" disabled={logout.isPending} onSelect={handleLogout}>
          <LogOut aria-hidden="true" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
