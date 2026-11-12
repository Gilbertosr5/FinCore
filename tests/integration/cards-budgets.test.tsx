import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderApp } from '../helpers/render-app';

type User = ReturnType<typeof userEvent.setup>;

/* Hoje fixo nos testes de integração: 06/11/2026 (ver render-app). */

async function choose(user: User, scope: HTMLElement, label: string, option: string) {
  await user.click(within(scope).getByLabelText(label));
  await user.click(await screen.findByRole('option', { name: option }));
}

describe('cartões', () => {
  it('registra compra parcelada com prévia das parcelas e atualiza o limite', async () => {
    const user = userEvent.setup();
    await renderApp('/cartoes', { authenticated: true });
    await screen.findByText('Azul Visa Gold');
    const summary = screen.getByRole('region', { name: 'Resumo dos cartões' });
    // Primeiro indicador: limite disponível.
    const available = () => within(summary).getAllByText(/^R\$/, { selector: 'p' })[0]?.textContent;
    const availableBefore = available();

    await user.click(screen.getByRole('button', { name: 'Nova compra' }));
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByLabelText('Descrição');
    await choose(user, dialog, 'Cartão', 'Azul Visa Gold');
    await user.type(within(dialog).getByLabelText('Descrição'), 'Fone de ouvido');
    await user.type(within(dialog).getByLabelText('Valor total'), '600,00');
    await choose(user, dialog, 'Categoria', 'Compras');
    const count = within(dialog).getByLabelText('Parcelas');
    await user.clear(count);
    await user.type(count, '3');

    // Fechamento dia 25: compra em 06/11 entra na fatura de novembro.
    expect(
      within(dialog).getByText(/3x de R\$\s200,00 a partir da fatura de novembro de 2026/),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Registrar compra' }));

    expect(await screen.findByText('Compra registrada.')).toBeInTheDocument();
    await waitFor(() => {
      expect(available()).not.toBe(availableBefore);
    });
  });

  it('valida a compra e bloqueia valor acima do limite disponível', async () => {
    const user = userEvent.setup();
    await renderApp('/cartoes', { authenticated: true });
    await screen.findByText('Azul Visa Gold');
    await user.click(screen.getByRole('button', { name: 'Nova compra' }));
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByLabelText('Descrição');
    await user.click(within(dialog).getByRole('button', { name: 'Registrar compra' }));
    expect(await within(dialog).findByText('Escolha o cartão.')).toBeInTheDocument();
    expect(within(dialog).getByText('Informe a descrição.')).toBeInTheDocument();
    expect(within(dialog).getByText('Escolha a categoria.')).toBeInTheDocument();

    await choose(user, dialog, 'Cartão', 'Azul Visa Gold');
    await user.type(within(dialog).getByLabelText('Descrição'), 'TV enorme');
    await user.type(within(dialog).getByLabelText('Valor total'), '99.000,00');
    await choose(user, dialog, 'Categoria', 'Compras');
    await user.click(within(dialog).getByRole('button', { name: 'Registrar compra' }));
    expect(await within(dialog).findByText(/Limite disponível insuficiente/)).toBeInTheDocument();
  });

  it('paga a fatura fechada: fatura fica paga e o pagamento entra no histórico', async () => {
    const user = userEvent.setup();
    // Roxinho fecha dia 3 e vence dia 10: a fatura de novembro está fechada.
    await renderApp('/cartoes/card-roxinho', { authenticated: true });
    const invoice = await screen.findByRole(
      'region',
      { name: 'Fatura de novembro de 2026' },
      { timeout: 5000 },
    );
    expect(within(invoice).getByText('Fechada')).toBeInTheDocument();

    await user.click(within(invoice).getByRole('button', { name: 'Pagar fatura' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Conta debitada')).toHaveTextContent('Conta corrente');
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar pagamento' }));

    expect(await screen.findByText('Fatura paga.')).toBeInTheDocument();
    const paidInvoice = await screen.findByRole('region', { name: 'Fatura de novembro de 2026' });
    await waitFor(() => {
      expect(within(paidInvoice).getByText('Paga')).toBeInTheDocument();
    });
    expect(within(paidInvoice).queryByRole('button', { name: 'Pagar fatura' })).toBeNull();
    const payments = screen.getByRole('list', { name: 'Pagamentos de fatura' });
    expect(within(payments).getAllByText(/Fatura de nov\/26/).length).toBeGreaterThan(0);
  });
});

describe('orçamentos', () => {
  it('cria orçamento por categoria e mostra consumo e situação', async () => {
    const user = userEvent.setup();
    await renderApp('/orcamentos', { authenticated: true });
    await screen.findByRole('list', { name: 'Orçamentos' });

    await user.click(screen.getByRole('button', { name: 'Novo orçamento' }));
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByLabelText('Nome');
    await user.type(within(dialog).getByLabelText('Nome'), 'Saúde do mês');
    await choose(user, dialog, 'Categoria', 'Saúde');
    await user.type(within(dialog).getByLabelText('Limite'), '10,00');
    await user.click(within(dialog).getByRole('button', { name: 'Criar orçamento' }));

    expect(await screen.findByText('Orçamento criado.')).toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'Orçamentos' });
    const item = (await within(list).findByText('Saúde do mês')).closest('li');
    if (!item) throw new Error('cartão do orçamento não encontrado');
    // A academia do cartão (R$ 129,90) já excede R$ 10,00 em novembro.
    expect(within(item).getByText(/Excedido/)).toBeInTheDocument();
    expect(within(item).getByText('Excedente')).toBeInTheDocument();
  });

  it('impede orçamento duplicado para a mesma categoria e período', async () => {
    const user = userEvent.setup();
    await renderApp('/orcamentos', { authenticated: true });
    await screen.findByRole('list', { name: 'Orçamentos' });
    await user.click(screen.getByRole('button', { name: 'Novo orçamento' }));
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByLabelText('Nome');
    await user.type(within(dialog).getByLabelText('Nome'), 'Outro lazer');
    await choose(user, dialog, 'Categoria', 'Lazer');
    await user.type(within(dialog).getByLabelText('Limite'), '100,00');
    await user.click(within(dialog).getByRole('button', { name: 'Criar orçamento' }));
    expect(await within(dialog).findByText(/Já existe o orçamento mensal/)).toBeInTheDocument();
  });

  it('navega entre meses e abre o histórico planejado × realizado', async () => {
    const user = userEvent.setup();
    const { router } = await renderApp('/orcamentos', { authenticated: true });
    await screen.findByRole('list', { name: 'Orçamentos' });
    await user.click(screen.getByRole('button', { name: 'Mês anterior' }));
    expect(router.state.location.search).toBe('?mes=2026-10');
    expect(await screen.findByText('Outubro de 2026')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ações do orçamento Lazer' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Histórico' }));
    const sheet = await screen.findByRole('dialog');
    const table = await within(sheet).findByRole('table');
    // Cabeçalho + 12 meses.
    expect(within(table).getAllByRole('row')).toHaveLength(13);
  });
});
