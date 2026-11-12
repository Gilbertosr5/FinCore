import { CSV_SEPARATOR, toCsv } from './csv';
import { safeFileName } from './download';
import { createTablePdf, toPdfText } from './pdf';

const BOM = String.fromCharCode(0xfeff);
const NBSP = String.fromCharCode(0xa0);
const MINUS = String.fromCharCode(0x2212);

describe('CSV', () => {
  it('usa ponto e vírgula, BOM e quebras CRLF', () => {
    const csv = toCsv(
      ['Mês', 'Valor (R$)'],
      [[{ value: 'Janeiro' }, { value: '1234,56', numeric: true }]],
    );
    expect(CSV_SEPARATOR).toBe(';');
    expect(csv.startsWith(BOM)).toBe(true);
    expect(csv.slice(1)).toBe('Mês;Valor (R$)\r\nJaneiro;1234,56\r\n');
  });

  it('escapa aspas, separadores e quebras de linha', () => {
    const csv = toCsv(['A'], [[{ value: 'Diz "oi"; tchau\nfim' }]]);
    expect(csv).toContain('"Diz ""oi""; tchau\nfim"');
  });

  it('protege contra injeção de fórmulas, mas não números negativos', () => {
    const csv = toCsv(
      ['A', 'B'],
      [[{ value: '=HYPERLINK("x")' }, { value: '-10,50', numeric: true }]],
    );
    expect(csv).toContain(`"'=HYPERLINK(""x"")";-10,50`);
    expect(toCsv(['A'], [[{ value: '@soma' }]])).toContain("'@soma");
  });
});

describe('nomes de arquivo e texto do PDF', () => {
  it('gera nome seguro sem acentos', () => {
    expect(safeFileName('fincore', 'orçamento-realizado', '2026-01-01', 'a', '2026-03-31')).toBe(
      'fincore-orcamento-realizado-2026-01-01-a-2026-03-31',
    );
  });

  it('normaliza espaços e sinais que as fontes padrão não têm', () => {
    expect(toPdfText(`${MINUS}R$${NBSP}10,00 → ok…`)).toBe('-R$ 10,00 -> ok...');
  });

  it('gera um PDF com a tabela', async () => {
    const blob = await createTablePdf({
      title: 'Despesas por categoria',
      meta: ['Período: 01/01/2026 a 31/03/2026'],
      head: ['Categoria', 'Valor'],
      body: [['Moradia', 'R$ 3.000,00']],
      foot: ['Total', 'R$ 3.000,00'],
      align: ['left', 'right'],
      notes: ['Por competência.'],
    });
    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(1000);
  });
});
