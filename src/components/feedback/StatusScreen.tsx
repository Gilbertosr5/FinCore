import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface StatusScreenProps {
  icon: LucideIcon;
  title: string;
  description: ReactNode;
  actions?: ReactNode;
  tone?: 'default' | 'destructive';
  /** Ocupa a viewport inteira (fora do layout autenticado). */
  fullScreen?: boolean;
}

/** Tela padronizada para estados vazios, erros e páginas informativas. */
export function StatusScreen({
  icon: Icon,
  title,
  description,
  actions,
  tone = 'default',
  fullScreen = false,
}: StatusScreenProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 px-4 py-16 text-center',
        fullScreen && 'min-h-dvh bg-background',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'grid size-14 place-items-center rounded-2xl',
          tone === 'destructive'
            ? 'bg-destructive/15 text-destructive'
            : 'bg-primary/15 text-primary',
        )}
      >
        <Icon className="size-7" />
      </span>
      <div className="flex max-w-md flex-col gap-2">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <div className="text-sm text-muted-foreground">{description}</div>
      </div>
      {actions && <div className="flex flex-wrap items-center justify-center gap-2">{actions}</div>}
    </div>
  );
}
