export interface ChartTooltipRow {
  key: string;
  label: string;
  value: string;
  color: string;
  dashed?: boolean;
}

interface ChartTooltipContentProps {
  title: string;
  rows: ChartTooltipRow[];
}

/**
 * Conteúdo do tooltip: valor em destaque, rótulo depois, chave em traço da cor
 * da série. Texto sempre nas cores de texto, nunca na cor da série.
 */
export function ChartTooltipContent({ title, rows }: ChartTooltipContentProps) {
  return (
    <div className="min-w-44 rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg">
      <p className="mb-1.5 font-medium text-muted-foreground">{title}</p>
      <ul className="flex flex-col gap-1">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-block h-0.5 w-3 shrink-0 rounded-full"
              style={{
                backgroundColor: row.dashed ? 'transparent' : row.color,
                borderTop: row.dashed ? `2px dashed ${row.color}` : undefined,
              }}
            />
            <span className="font-semibold tabular-nums">{row.value}</span>
            <span className="text-muted-foreground">{row.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
