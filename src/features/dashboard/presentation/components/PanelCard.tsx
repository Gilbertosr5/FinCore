import type { ReactNode } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface PanelCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

/** Cartão de lista do dashboard (movimentações, vencimentos, metas...). */
export function PanelCard({ title, description, children, className }: PanelCardProps) {
  return (
    <Card className={cn('min-w-0 gap-3', className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex-1">{children}</CardContent>
    </Card>
  );
}
