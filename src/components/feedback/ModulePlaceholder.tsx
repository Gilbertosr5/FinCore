import { Construction } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { NavigationItem } from '@/constants/navigation';

interface ModulePlaceholderProps {
  module: NavigationItem;
}

/**
 * Marcador temporário de módulos ainda não entregues. Informa explicitamente
 * a fase do roadmap — nenhuma funcionalidade é simulada.
 * Cada fase substitui o placeholder pela página real da feature.
 */
export function ModulePlaceholder({ module }: ModulePlaceholderProps) {
  const Icon = module.icon;
  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader className="flex-row items-start gap-4">
        <span
          aria-hidden="true"
          className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary"
        >
          <Icon className="size-6" />
        </span>
        <div className="flex flex-col gap-1.5">
          <CardTitle className="text-lg">{module.label}</CardTitle>
          <CardDescription>{module.description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
        <Construction aria-hidden="true" className="size-4" />
        <span>Módulo em desenvolvimento.</span>
        <Badge variant="secondary">Previsto para a Fase {module.deliveryPhase}</Badge>
      </CardContent>
    </Card>
  );
}
