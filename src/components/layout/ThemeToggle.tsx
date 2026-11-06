import { Moon, Sun } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useResolvedTheme } from '@/hooks/use-resolved-theme';
import { useThemeStore } from '@/stores/theme.store';

export function ThemeToggle() {
  const theme = useResolvedTheme();
  const setPreference = useThemeStore((state) => state.setPreference);
  const nextTheme = theme === 'dark' ? 'light' : 'dark';
  const label = nextTheme === 'dark' ? 'Ativar tema escuro' : 'Ativar tema claro';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
          onClick={() => {
            setPreference(nextTheme);
          }}
        >
          {theme === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
