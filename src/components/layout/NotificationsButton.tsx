import { Bell, BellOff, CircleAlert, Info, TriangleAlert, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export type NotificationSeverity = 'critical' | 'warning' | 'info';

export interface NotificationItem {
  id: string;
  severity: NotificationSeverity;
  title: string;
  description: string;
  /** Rota onde o usuário resolve o alerta. */
  href: string;
}

interface NotificationsButtonProps {
  items: readonly NotificationItem[];
  status: 'loading' | 'error' | 'ready';
}

const SEVERITY: Record<NotificationSeverity, { icon: LucideIcon; label: string; tone: string }> = {
  critical: { icon: CircleAlert, label: 'Crítico', tone: 'text-destructive' },
  warning: { icon: TriangleAlert, label: 'Atenção', tone: 'text-warning' },
  info: { icon: Info, label: 'Informação', tone: 'text-primary' },
};

/**
 * Central de notificações do cabeçalho. Recebe os alertas financeiros prontos
 * (a camada de aplicação decide a fonte); notificações push dependem do backend.
 * O contador considera apenas alertas críticos e de atenção.
 */
export function NotificationsButton({ items, status }: NotificationsButtonProps) {
  const [open, setOpen] = useState(false);
  const important = items.filter((item) => item.severity !== 'info').length;
  const label =
    important > 0
      ? `Notificações (${important} ${important === 1 ? 'alerta importante' : 'alertas importantes'})`
      : 'Notificações';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label} className="relative">
          <Bell aria-hidden="true" />
          {important > 0 && (
            <span
              aria-hidden="true"
              className="absolute top-1 right-1 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] leading-4 font-semibold text-destructive-foreground"
            >
              {important > 9 ? '9+' : important}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent aria-label="Notificações" className="w-[min(22rem,calc(100vw-1rem))] p-0">
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">Notificações</p>
          <p className="text-xs text-muted-foreground">Alertas do mês atual</p>
        </div>
        {status === 'loading' ? (
          <div className="flex flex-col gap-2 p-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : status === 'error' ? (
          <p role="alert" className="p-4 text-sm text-destructive">
            Não foi possível carregar os alertas.
          </p>
        ) : items.length === 0 ? (
          <EmptyState
            icon={BellOff}
            title="Nenhuma notificação"
            description="Alertas de vencimentos, faturas e orçamentos aparecerão aqui."
          />
        ) : (
          <ul className="max-h-96 divide-y divide-border overflow-y-auto">
            {items.map((item) => {
              const { icon: Icon, label: severityLabel, tone } = SEVERITY[item.severity];
              return (
                <li key={item.id}>
                  <Link
                    to={item.href}
                    className="flex gap-3 px-4 py-3 text-sm outline-none hover:bg-accent focus-visible:bg-accent"
                    onClick={() => {
                      setOpen(false);
                    }}
                  >
                    <Icon aria-hidden="true" className={cn('mt-0.5 size-4 shrink-0', tone)} />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="font-medium">
                        <span className="sr-only">{severityLabel}:</span> {item.title}
                      </span>{' '}
                      <span className="text-xs text-muted-foreground">{item.description}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
