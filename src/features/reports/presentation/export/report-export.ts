import { toCsv, type CsvCell } from '@/lib/export/csv';
import type { PdfTableDocument } from '@/lib/export/pdf';
import { formatMoney, formatPercent } from '@/lib/money';

import type { ReportCell, ReportRow, ReportTable } from '../../domain/report-table';

/** Texto exibido na tela e no PDF. */
export function displayCell(cell: ReportCell | undefined): string {
  if (!cell) return '';
  switch (cell.kind) {
    case 'text':
      return cell.value;
    case 'money':
      return formatMoney(cell.value);
    case 'percent':
      return cell.value === null ? '—' : formatPercent(cell.value);
  }
}

/** Valor para planilha: números com vírgula decimal, sem "R$" nem "%". */
export function csvCell(cell: ReportCell | undefined): CsvCell {
  if (!cell) return { value: '' };
  switch (cell.kind) {
    case 'text':
      return { value: cell.value };
    case 'money':
      return { value: cell.value.toDecimal().toFixed(2).replace('.', ','), numeric: true };
    case 'percent':
      return cell.value === null
        ? { value: '' }
        : { value: cell.value.toFixed(2).replace('.', ','), numeric: true };
  }
}

function csvHeader(table: ReportTable): string[] {
  // Indica a unidade das colunas numéricas, que vão sem símbolo.
  const sample = table.rows[0] ?? table.totals;
  return table.columns.map((column) => {
    const cell = sample?.cells[column.key];
    if (cell?.kind === 'money') return `${column.label} (R$)`;
    if (cell?.kind === 'percent') return `${column.label} (%)`;
    return column.label;
  });
}

const rowsWithTotals = (table: ReportTable): ReportRow[] =>
  table.totals ? [...table.rows, table.totals] : table.rows;

export function reportToCsv(table: ReportTable): string {
  return toCsv(
    csvHeader(table),
    rowsWithTotals(table).map((row) =>
      table.columns.map((column) => csvCell(row.cells[column.key])),
    ),
  );
}

export function reportToPdf(
  table: ReportTable,
  info: { title: string; meta: string[] },
): PdfTableDocument {
  const toLine = (row: ReportRow) =>
    table.columns.map((column) => displayCell(row.cells[column.key]));
  return {
    title: info.title,
    meta: info.meta,
    head: table.columns.map((column) => column.label),
    body: table.rows.map(toLine),
    foot: table.totals ? toLine(table.totals) : null,
    align: table.columns.map((column) => column.align),
    notes: table.notes,
  };
}
