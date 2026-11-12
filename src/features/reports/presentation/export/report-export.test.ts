import { Money } from '@/lib/money';

import { displayCell, reportToCsv, reportToPdf } from './report-export';
import {
  leftColumn,
  money,
  percent,
  rightColumn,
  text,
  type ReportTable,
} from '../../domain/report-table';

const table: ReportTable = {
  columns: [
    leftColumn('category', 'Categoria'),
    rightColumn('value', 'Valor'),
    rightColumn('share', '% do total'),
  ],
  rows: [
    {
      id: 'a',
      cells: { category: text('Moradia'), value: money(Money.of('3000')), share: percent(76.92) },
    },
    {
      id: 'b',
      cells: { category: text('Ajuste'), value: money(Money.of('-12.5')), share: percent(null) },
    },
  ],
  totals: {
    id: 't',
    cells: { category: text('Total'), value: money(Money.of('2987.5')), share: percent(100) },
  },
  notes: ['Por competência.'],
};

const normalize = (value: string) => value.replace(/\s/g, ' ');

describe('exportação de relatórios', () => {
  it('CSV traz as mesmas linhas da tela, com números para planilha', () => {
    const lines = reportToCsv(table).slice(1).trimEnd().split('\r\n');
    expect(lines).toEqual([
      'Categoria;Valor (R$);% do total (%)',
      'Moradia;3000,00;76,92',
      'Ajuste;-12,50;',
      'Total;2987,50;100,00',
    ]);
  });

  it('PDF usa exatamente o texto exibido na tabela', () => {
    const pdf = reportToPdf(table, { title: 'Despesas', meta: ['Período'] });
    expect(pdf.head).toEqual(['Categoria', 'Valor', '% do total']);
    expect(pdf.body.map((row) => row.map(normalize))).toEqual(
      table.rows.map((row) =>
        table.columns.map((column) => normalize(displayCell(row.cells[column.key]))),
      ),
    );
    expect(pdf.foot?.[0]).toBe('Total');
    expect(pdf.align).toEqual(['left', 'right', 'right']);
    expect(pdf.notes).toEqual(['Por competência.']);
    expect(displayCell(table.rows[1]?.cells.share)).toBe('—');
  });
});
