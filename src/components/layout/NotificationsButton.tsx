import { Bell, BellOff } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/**
 * Central de notificações. Nesta fase não há fonte de notificações: os alertas
 * financeiros (orçamentos, vencimentos) passam a alimentá-la nas Fases 3 e 5, e
 * notificações push dependem do backend (contrato futuro).
 */
export function NotificationsButton() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notificações">
          <Bell aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent aria-label="Notificações" className="w-80 p-0">
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">Notificações</p>
        </div>
        <EmptyState
          icon={BellOff}
          title="Nenhuma notificação"
          description="Alertas de vencimentos e orçamentos aparecerão aqui."
        />
      </PopoverContent>
    </Popover>
  );
}
