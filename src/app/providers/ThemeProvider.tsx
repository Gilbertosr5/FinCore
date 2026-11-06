import { useEffect, type ReactNode } from 'react';

import { useResolvedTheme } from '@/hooks/use-resolved-theme';

/**
 * Sincroniza o tema efetivo com a classe `.dark` do <html>.
 * O script inline em index.html aplica o tema antes da primeira pintura
 * (evita "flash" de tema incorreto); este provider mantém a sincronia depois.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useResolvedTheme();

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme;
  }, [theme]);

  return children;
}
