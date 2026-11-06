import { cn } from '@/lib/utils';

export interface LegendItem {
  key: string;
  label: string;
  color: string;
  dashed?: boolean;
  value?: string;
}

/** Legenda em HTML (sempre presente com 2+ séries): a cor nunca é a única pista. */
export function ChartLegend({ items, className }: { items: LegendItem[]; className?: string }) {
  return (
    <ul className={cn('flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground', className)}>
      {items.map((item) => (
        <li key={item.key} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-0.5 w-3 rounded-full"
            style={{
              backgroundColor: item.dashed ? 'transparent' : item.color,
              borderTop: item.dashed ? `2px dashed ${item.color}` : undefined,
            }}
          />
          <span>{item.label}</span>
          {item.value && (
            <span className="font-medium text-foreground tabular-nums">{item.value}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
