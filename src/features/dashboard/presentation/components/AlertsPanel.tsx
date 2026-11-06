import { CircleAlert, Info, TriangleAlert, type LucideIcon } from 'lucide-react';
import { useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import type { AlertSeverity, DashboardAlert } from '../../domain/overview-types';

const SEVERITY: Record<
  AlertSeverity,
  { icon: LucideIcon; variant: 'destructive' | 'warning' | 'info'; label: string }
> = {
  critical: { icon: CircleAlert, variant: 'destructive', label: 'Crítico' },
  warning: { icon: TriangleAlert, variant: 'warning', label: 'Atenção' },
  info: { icon: Info, variant: 'info', label: 'Informação' },
};

const MAX_VISIBLE_MOBILE = 2;
const MAX_VISIBLE_DESKTOP = 4;

/** Alertas financeiros: ícone + rótulo de severidade + texto (nunca só cor). */
export function AlertsPanel({ alerts }: { alerts: DashboardAlert[] }) {
  const [expanded, setExpanded] = useState(false);
  if (alerts.length === 0) return null;

  // Recolhido: 2 alertas em telas pequenas e 4 no desktop (os mais graves primeiro).
  const hiddenClass = (index: number) => {
    if (expanded) return undefined;
    if (index >= MAX_VISIBLE_DESKTOP) return 'hidden';
    if (index >= MAX_VISIBLE_MOBILE) return 'max-lg:hidden';
    return undefined;
  };
  const toggleNeeded = alerts.length > MAX_VISIBLE_MOBILE;

  return (
    <section aria-label="Alertas financeiros" className="flex flex-col gap-2">
      <div className="grid gap-2 lg:grid-cols-2">
        {alerts.map((alert, index) => {
          const { icon: Icon, variant, label } = SEVERITY[alert.severity];
          return (
            <Alert key={alert.id} variant={variant} role="status" className={hiddenClass(index)}>
              <Icon aria-hidden="true" />
              <AlertTitle>
                <span className="sr-only">{label}: </span>
                {alert.title}
              </AlertTitle>
              <AlertDescription>{alert.description}</AlertDescription>
            </Alert>
          );
        })}
      </div>
      {toggleNeeded && (
        <Button
          variant="link"
          size="sm"
          aria-expanded={expanded}
          className={cn(
            'h-auto w-fit px-0 text-xs',
            alerts.length <= MAX_VISIBLE_DESKTOP && !expanded && 'lg:hidden',
          )}
          onClick={() => {
            setExpanded((value) => !value);
          }}
        >
          {expanded ? 'Mostrar menos alertas' : `Ver todos os alertas (${alerts.length})`}
        </Button>
      )}
    </section>
  );
}
