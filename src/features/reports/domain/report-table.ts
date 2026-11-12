import type { Money } from '@/lib/money';

/**
 * Estrutura única de relatório (ADR 0013): a MESMA tabela alimenta a tela, o CSV
 * e o PDF — o que é exportado corresponde exatamente ao que é exibido.
 */
export type ReportCell =
  | { kind: 'text'; value: string }
  | { kind: 'money'; value: Money }
  /** Pontos percentuais (12.5 = 12,5%); null = não se aplica. */
  | { kind: 'percent'; value: number | null };

export interface ReportColumn {
  key: string;
  label: string;
  align: 'left' | 'right';
}

export interface ReportRow {
  id: string;
  cells: Record<string, ReportCell>;
}

export interface ReportTable {
  columns: ReportColumn[];
  rows: ReportRow[];
  /** Linha de totais (opcional). */
  totals: ReportRow | null;
  /** Observações de metodologia exibidas abaixo e no PDF. */
  notes: string[];
}

export const text = (value: string): ReportCell => ({ kind: 'text', value });
export const money = (value: Money): ReportCell => ({ kind: 'money', value });
export const percent = (value: number | null): ReportCell => ({ kind: 'percent', value });

export const leftColumn = (key: string, label: string): ReportColumn => ({
  key,
  label,
  align: 'left',
});
export const rightColumn = (key: string, label: string): ReportColumn => ({
  key,
  label,
  align: 'right',
});
