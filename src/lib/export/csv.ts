/**
 * CSV para planilhas brasileiras (Excel/LibreOffice em pt-BR):
 * - separador ";" (a vírgula é o separador decimal);
 * - UTF-8 com BOM, para acentos abrirem corretamente;
 * - aspas duplas quando necessário (aspas internas duplicadas);
 * - proteção contra injeção de fórmulas: células de texto que começam com
 *   = + - @ ou tabulação recebem um apóstrofo (valores numéricos não).
 */

export const CSV_SEPARATOR = ';';
/** Marca de ordem de bytes (U+FEFF): faz o Excel reconhecer UTF-8. */
const BOM = String.fromCharCode(0xfeff);
const FORMULA_START = /^[=+\-@\t\r]/;

export interface CsvCell {
  value: string;
  /** Números já formatados ("1234,56", "-10,5") não são protegidos contra fórmula. */
  numeric?: boolean;
}

function escapeCell(cell: CsvCell): string {
  let value = cell.value;
  if (!cell.numeric && FORMULA_START.test(value)) value = `'${value}`;
  return /[";\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(header: readonly string[], rows: readonly (readonly CsvCell[])[]): string {
  const lines = [
    header.map((label) => escapeCell({ value: label })).join(CSV_SEPARATOR),
    ...rows.map((row) => row.map(escapeCell).join(CSV_SEPARATOR)),
  ];
  return `${BOM}${lines.join('\r\n')}\r\n`;
}
