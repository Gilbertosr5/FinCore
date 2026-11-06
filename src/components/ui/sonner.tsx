import { Toaster as SonnerToaster, type ToasterProps } from 'sonner';

import { useResolvedTheme } from '@/hooks/use-resolved-theme';

/** Notificações (toasts) acessíveis: o sonner usa região aria-live. */
export function Toaster(props: ToasterProps) {
  const theme = useResolvedTheme();
  return (
    <SonnerToaster
      theme={theme}
      position="top-right"
      closeButton
      richColors
      toastOptions={{
        classNames: {
          toast: 'border-border bg-popover text-popover-foreground',
        },
      }}
      {...props}
    />
  );
}
