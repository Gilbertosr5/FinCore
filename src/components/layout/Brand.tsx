import { cn } from '@/lib/utils';

interface BrandProps {
  name: string;
  compact?: boolean;
}

export function Brand({ name, compact = false }: BrandProps) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground shadow-sm"
      >
        F
      </span>
      <span
        className={cn('text-lg font-semibold tracking-tight text-foreground', compact && 'sr-only')}
      >
        {name}
      </span>
    </div>
  );
}
