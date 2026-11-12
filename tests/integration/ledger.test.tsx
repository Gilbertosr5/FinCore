import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderApp } from '../helpers/render-app';

type User = ReturnType<typeof userEvent.setup>;

/** Seleciona uma opção de um Select (Radix) pelo rótulo do campo. */
async function choose(user: User, scope: HTMLElement, label: string, option: string) {
  await user.click(within(scope).getByLabelText(label));
  await user.click(await screen.findByRole('option', { name: option }));
}

async function openNewEntry(user: User, kind: 'Despesa' | 'Receita' | 'Transferência') {
  const [trigger] = await screen.findAllByRole('button', { name: 'Novo lançamento' });
  if (!trigger) throw new Error('botão "Novo lançamento" não encontrado');
  await user.click(trigger);
  await user.click(await screen.findByRole('menuitem', { name: kind }));
  const dialog = await screen.findByRole('dialog');
  // O formulário aparece após carregar contas e categorias.
  await within(dialog).findByLabelText(kind === 'Transferência' ? 'De (origem)' : 'Descrição');
  return dialog;
}

async function createExpense(user: User, description: string, amount: string) {
  const dialog = await openNewEntry(user, 'Despesa');
  await user.type(within(dialog).getByLabelText('Descrição'), description);
  await user.type(within(dialog).getByLabelText('Valor'), amount);
  await choose(user, dialog, 'Conta', 'Conta corrente');
  await choose(user, dialog, 'Categoria', 'Lazer');
  return dialog;
}

describe('transações', () => {
  it('cria uma despesa, exibe na lista e atualiza os totais', async () => {
    const user = userEvent.setup();
    await renderApp('/transacoes?q=show', { authenticated: true });
    expect(await screen.findByText('Nenhum lançamento encontrado')).toBeInTheDocument();

    const dialog = await createExpense(user, 'Show de rock', '250,00');
    await user.click(within(dialog).getByRole('button', { name: 'Adicionar' }));

    expect(await screen.findByText('Lançamento criado.')).toBeInTheDocument();
    const totals = screen.getByRole('region', { name: 'Totais do filtro' });
    await waitFor(() => {
      // Despesas = R$ 250,00 e resultado = -R$ 250,00 (sem receitas no filtro).
      expect(within(totals).getAllByText(/250,00/)).toHaveLength(2);
    });
    expect(screen.getAllByText('Show de rock').length).toBeGreaterThan(0);
  });

  it('valida campos obrigatórios e valor no formato brasileiro', async () => {
    const user = userEvent.setup();
    await renderApp('/transacoes', { authenticated: true });
    const dialog = await openNewEntry(user, 'Despesa');
    await user.type(within(dialog).getByLabelText('Valor'), 'abc');
    await user.click(within(dialog).getByRole('button', { name: 'Adicionar' }));

    expect(await within(dialog).findByText('Informe a descrição.')).toBeInTheDocument();
    expect(within(dialog).getByText('Informe um valor maior que zero.')).toBeInTheDocument();
    expect(within(dialog).getByText('Escolha a conta.')).toBeInTheDocument();
    expect(within(dialog).getByText('Escolha a categoria.')).toBeInTheDocument();
  });

  it('cria parcelamento e mostra as parcelas nos meses seguintes', async () => {
    const user = userEvent.setup();
    const { router } = await renderApp('/transacoes?q=notebook%20gamer', { authenticated: true });
    const dialog = await createExpense(user, 'Notebook gamer', '1.000,00');
    await user.click(within(dialog).getByRole('radio', { name: 'Parcelado' }));
    const count = within(dialog).getByLabelText('Número de parcelas');
    await user.clear(count);
    await user.type(count, '3');
    expect(within(dialog).getByText(/3x de aproximadamente/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Adicionar' }));

    expect(await screen.findByText('3 lançamentos criados.')).toBeInTheDocument();
    expect(await screen.findAllByText('1/3')).not.toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Próximo mês' }));
    await waitFor(() => {
      expect(router.state.location.search).toContain('mes=2026-12');
    });
    expect(await screen.findAllByText('2/3')).not.toHaveLength(0);
  });

  it('marca como pago e depois exclui com confirmação', async () => {
    const user = userEvent.setup();
    await renderApp('/transacoes?q=cinema%20imax', { authenticated: true });
    const dialog = await createExpense(user, 'Cinema IMAX', '80,00');
    await user.click(within(dialog).getByRole('button', { name: 'Adicionar' }));
    await screen.findByText('Lançamento criado.');

    const [menuButton] = await screen.findAllByRole('button', { name: 'Ações de Cinema IMAX' });
    if (!menuButton) throw new Error('menu de ações não encontrado');
    await user.click(menuButton);
    await user.click(await screen.findByRole('menuitem', { name: 'Marcar como pago' }));
    const payDialog = await screen.findByRole('alertdialog', { name: 'Marcar como pago' });
    await user.click(within(payDialog).getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByText('Pagamento registrado.')).toBeInTheDocument();
    expect((await screen.findAllByText('Pago')).length).toBeGreaterThan(0);

    const [menuAgain] = screen.getAllByRole('button', { name: 'Ações de Cinema IMAX' });
    if (!menuAgain) throw new Error('menu de ações não encontrado');
    await user.click(menuAgain);
    await user.click(await screen.findByRole('menuitem', { name: 'Excluir' }));
    const confirm = await screen.findByRole('alertdialog', { name: 'Excluir lançamento?' });
    await user.click(within(confirm).getByRole('button', { name: 'Excluir' }));

    expect(await screen.findByText('Lançamento excluído.')).toBeInTheDocument();
    expect(await screen.findByText('Nenhum lançamento encontrado')).toBeInTheDocument();
  });

  it('mostra detalhes e histórico de alterações', async () => {
    const user = userEvent.setup();
    await renderApp('/transacoes?q=livro', { authenticated: true });
    const dialog = await createExpense(user, 'Livro técnico', '120,00');
    await user.click(within(dialog).getByRole('button', { name: 'Adicionar' }));
    await screen.findByText('Lançamento criado.');

    const [title] = await screen.findAllByRole('button', { name: 'Livro técnico' });
    if (!title) throw new Error('lançamento não encontrado');
    await user.click(title);
    const sheet = await screen.findByRole('dialog', { name: 'Livro técnico' });
    expect(within(sheet).getByText('Histórico de alterações')).toBeInTheDocument();
    expect(await within(sheet).findByText(/Despesa de R\$\s120,00 registrada/)).toBeInTheDocument();
  });
});

describe('contas', () => {
  it('transfere entre contas e atualiza os saldos sem alterar o total', async () => {
    const user = userEvent.setup();
    await renderApp('/contas', { authenticated: true });
    await screen.findByText('Poupança');
    const totalLabel = await screen.findByText('Saldo total das contas ativas');
    const totalBefore = totalLabel.nextElementSibling?.textContent;

    await user.click(screen.getByRole('button', { name: 'Transferir' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nova transferência' });
    await within(dialog).findByLabelText('De (origem)');
    await choose(user, dialog, 'De (origem)', 'Conta corrente');
    await choose(user, dialog, 'Para (destino)', 'Poupança');
    await user.type(within(dialog).getByLabelText('Valor'), '500');
    await user.click(within(dialog).getByRole('button', { name: 'Transferir' }));

    expect(await screen.findByText('Transferência registrada.')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Saldo total das contas ativas').nextElementSibling?.textContent).toBe(
      totalBefore,
    );
  });

  it('cria conta com saldo inicial e abre o extrato', async () => {
    const user = userEvent.setup();
    const { router } = await renderApp('/contas', { authenticated: true });
    await user.click(await screen.findByRole('button', { name: 'Nova conta' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nova conta' });
    await user.type(within(dialog).getByLabelText('Nome'), 'Banco Laranja');
    await user.type(within(dialog).getByLabelText('Saldo inicial'), '1.234,56');
    await user.click(within(dialog).getByRole('button', { name: 'Criar conta' }));

    expect(await screen.findByText('Conta criada.')).toBeInTheDocument();
    expect(await screen.findByText('Banco Laranja')).toBeInTheDocument();
    expect(screen.getAllByText(/1\.234,56/).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Ações da conta Banco Laranja' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Ver extrato' }));
    expect(
      await screen.findByRole('heading', { name: 'Extrato — Banco Laranja' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toMatch(/^\/contas\//);
  });

  it('extrato mostra saldo inicial, movimentações e saldo final coerentes', async () => {
    await renderApp('/contas/acc-corrente', { authenticated: true });
    const summary = await screen.findByRole('region', { name: 'Resumo do período' });
    await within(summary).findByText('Saldo final');
    expect(await screen.findByText('Movimentações liquidadas')).toBeInTheDocument();
    expect((await screen.findAllByText(/Salário/)).length).toBeGreaterThan(0);
  });
});

describe('categorias', () => {
  it('cria categoria personalizada e impede excluir categoria em uso', async () => {
    const user = userEvent.setup();
    await renderApp('/configuracoes', { authenticated: true });

    const [newButton] = await screen.findAllByRole('button', { name: 'Nova categoria' });
    if (!newButton) throw new Error('botão não encontrado');
    await user.click(newButton);
    const dialog = await screen.findByRole('dialog', { name: 'Nova categoria' });
    await user.type(within(dialog).getByLabelText('Nome'), 'Pets');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText('Categoria criada.')).toBeInTheDocument();
    expect(await screen.findByText('Pets')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Excluir categoria Moradia' }));
    const confirm = await screen.findByRole('alertdialog', { name: 'Excluir categoria?' });
    await user.click(within(confirm).getByRole('button', { name: 'Excluir' }));
    expect(await screen.findByText(/não pode ser excluída/)).toBeInTheDocument();
  });
});
