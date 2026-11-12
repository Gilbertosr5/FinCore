import { FileX } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

import type { ReportCell, ReportTable } from '../../domain/report-table';
import { displayCell } from '../export/report-export';

const negative = (cell: ReportCell | undefined) =>
  cell?.kind === 'money' && cell.value.isNegative();

/** Tabela acessível do relatório — a mesma estrutura exportada em CSV/PDF. */
export function ReportTableView({ table, caption }: { table: ReportTable; caption: string }) {
  if (table.rows.length === 0) {
    return (
      <EmptyState
        icon={FileX}
        title="Nada a exibir no período"
        description="Ajuste o período ou o filtro de conta."
        className="py-8"
      />
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <caption className="sr-only">{caption}</caption>
        <TableHeader>
          <TableRow>
            {table.columns.map((column) => (
              <TableHead
                key={column.key}
                scope="col"
                className={cn('whitespace-nowrap', column.align === 'right' && 'text-right')}
              >
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {table.rows.map((row) => (
            <TableRow key={row.id}>
              {table.columns.map((column) => {
                const cell = row.cells[column.key];
                return (
                  <TableCell
                    key={column.key}
                    className={cn(
                      column.align === 'right' && 'text-right tabular-nums',
                      negative(cell) && 'text-destructive',
                    )}
                  >
                    {displayCell(cell)}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
        {table.totals && (
          <TableFooter>
            <TableRow>
              {table.columns.map((column) => {
                const cell = table.totals?.cells[column.key];
                return (
                  <TableCell
                    key={column.key}
                    className={cn(
                      'font-semibold',
                      column.align === 'right' && 'text-right tabular-nums',
                      negative(cell) && 'text-destructive',
                    )}
                  >
                    {displayCell(cell)}
                  </TableCell>
                );
              })}
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </div>
  );
}
