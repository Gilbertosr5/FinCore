import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type * as DownloadExports from '@/lib/export/download';

import { renderApp } from '../helpers/render-app';

/* Hoje fixo nos testes de integração: 06/11/2026 (ver render-app). */

type DownloadModule = typeof DownloadExports;
const BOM = String.fromCharCode(0xfeff);

const downloads: { blob: Blob; filename: string }[] = [];
vi.mock('@/lib/export/download', async (importOriginal) => {
  const original = await importOriginal<DownloadModule>();
  return {
    ...original,
    downloadBlob: (blob: Blob, filename: string) => {
      downloads.push({ blob, filename });
    },
  };
});

function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(typeof reader.result === 'string' ? reader.result : '');
    };
    reader.onerror = () => {
      reject(new Error('falha ao ler o arquivo'));
    };
    reader.readAsText(blob);
  });
}

beforeEach(() => {
  downloads.length = 0;
});

describe('calendário', () => {
  it('mostra o mês com eventos, detalhes do dia e filtros por tipo', async () => {
    const user = userEvent.setup();
    const { router } = await renderApp('/calendario', { authenticated: true });
    const grid = await screen.findByRole('grid', { name: 'Calendário do mês' }, { timeout: 5000 });
    // Hoje (06/11) vem selecionado.
    expect(screen.getByRole('heading', { name: 'Sexta-feira, 6 de novembro' })).toBeInTheDocument();

    // A fatura do Roxinho (fecha 3, vence 10) aparece no dia 10.
    await user.click(
      within(grid).getByRole('button', { name: /^Terça-feira, 10 de novembro: \d+ eventos?/ }),
    );
    const day = screen.getByRole('region', { name: 'Eventos de 10/11/2026' });
    expect(await within(day).findByText('Fatura Roxinho Platinum')).toBeInTheDocument();
    expect(router.state.location.search).toContain('dia=2026-11-10');

    await user.click(screen.getByRole('checkbox', { name: 'Faturas de cartão' }));
    await waitFor(() => {
      expect(within(day).queryByText('Fatura Roxinho Platinum')).toBeNull();
    });
    expect(router.state.location.search).toContain('tipos=');
  });

  it('alterna para a visão semanal e navega', async () => {
    const user = userEvent.setup();
    await renderApp('/calendario', { authenticated: true });
    await screen.findByRole('grid', { name: 'Calendário do mês' }, { timeout: 5000 });
    await user.click(screen.getByRole('button', { name: 'Semana' }));
    expect(await screen.findByText('01/11/2026 a 07/11/2026')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Próxima semana' }));
    expect(await screen.findByText('08/11/2026 a 14/11/2026')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').length).toBeGreaterThan(6);
  });
});

describe('relatórios', () => {
  it('troca de relatório pela URL e exporta CSV idêntico à tabela', async () => {
    const user = userEvent.setup();
    const { router } = await renderApp('/relatorios?periodo=ano', { authenticated: true });
    const indicators = await screen.findByRole('region', { name: 'Indicadores do período' });
    expect(
      await within(indicators).findByText('Taxa de poupança', {}, { timeout: 5000 }),
    ).toBeInTheDocument();

    await user.click(screen.getByLabelText('Relatório'));
    await user.click(await screen.findByRole('option', { name: 'Despesas por categoria' }));
    expect(router.state.location.search).toContain('relatorio=despesas-por-categoria');
    expect(router.state.location.search).toContain('periodo=ano');

    const table = await screen.findByRole('table', { name: /Despesas por categoria/ });
    const firstRow = within(table).getAllByRole('row')[1];
    const firstCategory = firstRow ? within(firstRow).getAllByRole('cell')[0]?.textContent : '';

    await user.click(screen.getByRole('button', { name: 'Exportar CSV' }));
    expect(await screen.findByText('CSV gerado.')).toBeInTheDocument();
    const [file] = downloads;
    expect(file?.filename).toBe('fincore-despesas-por-categoria-2026-01-01-a-2026-12-31.csv');
    const csv = file ? await readBlob(file.blob) : '';
    const lines = csv.replace(BOM, '').trimEnd().split(String.fromCharCode(13, 10));
    expect(lines[0]).toBe('Categoria;Natureza;Valor (R$);% do total (%)');
    expect(lines[1]?.startsWith(`${firstCategory ?? ''};`)).toBe(true);
    // Uma linha por linha da tabela (cabeçalho + dados + total).
    expect(lines).toHaveLength(within(table).getAllByRole('row').length);
  });

  it('filtra por conta e exporta PDF', async () => {
    const user = userEvent.setup();
    const { router } = await renderApp('/relatorios?relatorio=fluxo-de-caixa', {
      authenticated: true,
    });
    await screen.findByRole('table', { name: /Fluxo de caixa/ }, { timeout: 5000 });
    await user.click(screen.getByLabelText('Conta'));
    await user.click(await screen.findByRole('option', { name: 'Conta corrente' }));
    expect(router.state.location.search).toContain('conta=acc-corrente');
    expect(
      await screen.findByText(/transferências contam como entrada\/saída da conta/),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Exportar PDF' }));
    expect(await screen.findByText('PDF gerado.', {}, { timeout: 10000 })).toBeInTheDocument();
    expect(downloads[0]?.filename).toMatch(/^fincore-fluxo-de-caixa-.+\.pdf$/);
    expect(downloads[0]?.blob.type).toBe('application/pdf');
  });
});
