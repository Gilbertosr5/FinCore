/** Dispara o download de um arquivo gerado no navegador (nada é enviado a servidores). */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  // Libera a URL depois que o navegador iniciou o download.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

/** Acentos separados por NFD (U+0300 a U+036F). */
const COMBINING_MARKS = new RegExp(
  `[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`,
  'g',
);

/** Nome de arquivo seguro: minúsculas, sem acentos, com hífens. */
export function safeFileName(...parts: string[]): string {
  return parts
    .join('-')
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
