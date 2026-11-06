import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type StatTone = 'default' | 'positive' | 'negative' | 'warning';

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  /** Linha de contexto abaixo do valor (ex.: "R$ 320,00 a receber"). */
  hint?: ReactNode;
  /** Tom do valor — sempre acompanhado de texto/sinal, nunca só cor. */
  tone?: StatTone;
  /** Indicador baseado em estimativa (ex.: valor de mercado não confirmado). */
  badge?: ReactNode;
}

const TONE_CLASSES: Record<StatTone, string> = {
  default: 'text-foreground',
  positive: 'text-success',
  negative: 'text-destructive',
  warning: 'text-warning',
};

/** Cartão financeiro de indicador único (número de destaque + contexto). */
export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = 'default',
  badge,
}: StatCardProps) {
  return (
    <Card className="gap-3 py-4">
      <div className="flex items-start justify-between gap-3 px-4">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p
            className={cn(
              'truncate text-xl font-semibold tracking-tight tabular-nums sm:text-2xl',
              TONE_CLASSES[tone],
            )}
          >
            {value}
          </p>
        </div>
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"
        >
          <Icon className="size-[18px]" />
        </span>
      </div>
      {(hint ?? badge) && (
        <div className="flex flex-wrap items-center gap-2 px-4 text-xs text-muted-foreground">
          {badge}
          {hint && <span>{hint}</span>}
        </div>
      )}
    </Card>
  );
}
