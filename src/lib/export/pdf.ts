/**
 * PDF de tabela (relatórios). jsPDF e jspdf-autotable são carregados SOB
 * DEMANDA (import dinâmico): não entram no carregamento inicial da aplicação.
 * As fontes padrão do PDF usam a codificação WinAnsi: os acentos do português
 * funcionam, mas símbolos fora dela são normalizados (ver `toPdfText`).
 */

export interface PdfTableDocument {
  title: string;
  /** Linhas abaixo do título (período, filtros, data de geração…). */
  meta: string[];
  head: string[];
  body: string[][];
  foot: string[] | null;
  /** Alinhamento por coluna. */
  align: ('left' | 'right')[];
  notes: string[];
}

const chars = (...codes: number[]) => new RegExp(`[${String.fromCharCode(...codes)}]`, 'g');
/** Espaços não separáveis (NBSP, NNBSP, espaço numérico) usados pelo Intl. */
const SPECIAL_SPACES = chars(0xa0, 0x202f, 0x2007);
/** Sinal de menos e travessões. */
const DASHES = chars(0x2212, 0x2012, 0x2013, 0x2014);
const ARROW = chars(0x2192);
const ELLIPSIS = chars(0x2026);

/** Normaliza caracteres sem glifo nas fontes padrão do PDF. */
export function toPdfText(value: string): string {
  return value
    .replace(SPECIAL_SPACES, ' ')
    .replace(DASHES, '-')
    .replace(ARROW, '->')
    .replace(ELLIPSIS, '...');
}

export async function createTablePdf(document: PdfTableDocument): Promise<Blob> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const landscape = document.head.length > 5;
  const pdf = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'pt' });
  const margin = 40;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.text(toPdfText(document.title), margin, margin + 8);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  document.meta.forEach((line, index) => {
    pdf.text(toPdfText(line), margin, margin + 26 + index * 12);
  });

  const columnStyles = Object.fromEntries(
    document.align.map((align, index) => [index, { halign: align }]),
  );
  autoTable(pdf, {
    startY: margin + 34 + document.meta.length * 12,
    margin: { left: margin, right: margin },
    head: [document.head.map(toPdfText)],
    body: document.body.map((row) => row.map(toPdfText)),
    foot: document.foot ? [document.foot.map(toPdfText)] : undefined,
    showFoot: 'lastPage',
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [79, 70, 229], textColor: 255 },
    footStyles: { fillColor: [235, 235, 240], textColor: 20, fontStyle: 'bold' },
    columnStyles,
    didParseCell: (hook) => {
      const align = document.align[hook.column.index];
      if (align) hook.cell.styles.halign = align;
    },
  });

  const pages = pdf.getNumberOfPages();
  const height = pdf.internal.pageSize.getHeight();
  const width = pdf.internal.pageSize.getWidth();
  // Observações após a tabela (na última página).
  const finalY = (pdf as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY;
  if (document.notes.length > 0) {
    pdf.setPage(pages);
    pdf.setFontSize(8);
    let y = (finalY ?? margin) + 18;
    for (const note of document.notes) {
      const lines = pdf.splitTextToSize(toPdfText(`• ${note}`), width - margin * 2) as string[];
      if (y + lines.length * 10 > height - margin) {
        pdf.addPage();
        y = margin;
      }
      pdf.text(lines, margin, y);
      y += lines.length * 10 + 2;
    }
  }
  const total = pdf.getNumberOfPages();
  for (let page = 1; page <= total; page++) {
    pdf.setPage(page);
    pdf.setFontSize(8);
    pdf.text(`Página ${page} de ${total}`, width - margin, height - 20, { align: 'right' });
  }
  return pdf.output('blob');
}
