import { BarChart3, Table2 } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface ChartTableColumn {
  key: string;
  label: string;
  align?: 'left' | 'right';
}

export interface ChartTable {
  caption: string;
  columns: ChartTableColumn[];
  rows: { id: string; cells: Record<string, string> }[];
}

interface ChartCardProps {
  title: string;
  description?: string;
  /** Resumo textual do gráfico para leitores de tela. */
  summary: string;
  /** Dados do gráfico em forma de tabela (acessibilidade e leitura precisa). */
  table: ChartTable;
  children: ReactNode;
  className?: string;
  /** Conteúdo exibido no lugar do gráfico quando não há dados. */
  empty?: ReactNode;
  footer?: ReactNode;
}

/**
 * Moldura padrão de gráficos: título, alternância gráfico/tabela e resumo
 * acessível. A tabela garante que nenhum valor dependa apenas de cor ou hover.
 */
export function ChartCard({
  title,
  description,
  summary,
  table,
  children,
  className,
  empty,
  footer,
}: ChartCardProps) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const summaryId = useId();

  return (
    <Card className={cn('min-w-0 gap-4', className)}>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {!empty && (
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 text-muted-foreground"
            aria-pressed={view === 'table'}
            onClick={() => {
              setView((current) => (current === 'chart' ? 'table' : 'chart'));
            }}
          >
            {view === 'chart' ? <Table2 aria-hidden="true" /> : <BarChart3 aria-hidden="true" />}
            {view === 'chart' ? 'Ver tabela' : 'Ver gráfico'}
          </Button>
        )}
      </CardHeader>
      <div className="min-w-0 px-5">
        {empty ??
          (view === 'chart' ? (
            <figure aria-describedby={summaryId} className="m-0">
              <div role="img" aria-label={`${title}. ${summary}`}>
                {children}
              </div>
              <figcaption id={summaryId} className="sr-only">
                {summary}
              </figcaption>
            </figure>
          ) : (
            <div className="max-h-80 overflow-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <caption className="sr-only">{table.caption}</caption>
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b border-border">
                    {table.columns.map((column) => (
                      <th
                        key={column.key}
                        scope="col"
                        className={cn(
                          'px-3 py-2 font-medium text-muted-foreground',
                          column.align === 'right' ? 'text-right' : 'text-left',
                        )}
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row) => (
                    <tr key={row.id} className="border-b border-border last:border-0">
                      {table.columns.map((column, index) =>
                        index === 0 ? (
                          <th
                            key={column.key}
                            scope="row"
                            className="px-3 py-2 text-left font-normal"
                          >
                            {row.cells[column.key]}
                          </th>
                        ) : (
                          <td
                            key={column.key}
                            className={cn(
                              'px-3 py-2 tabular-nums',
                              column.align === 'right' ? 'text-right' : 'text-left',
                            )}
                          >
                            {row.cells[column.key]}
                          </td>
                        ),
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
      </div>
      {footer && <div className="px-5 text-xs text-muted-foreground">{footer}</div>}
    </Card>
  );
}
