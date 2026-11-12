import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderApp } from '../helpers/render-app';

type User = ReturnType<typeof userEvent.setup>;

/* Hoje fixo nos testes de integração: 06/11/2026 (ver render-app). */

async function choose(user: User, scope: HTMLElement, label: string, option: string) {
  await user.click(within(scope).getByLabelText(label));
  await user.click(await screen.findByRole('option', { name: option }));
}

describe('investimentos', () => {
  it('mostra a carteira, origem dos valores e indicadores indisponíveis', async () => {
    await renderApp('/investimentos', { authenticated: true });
    const summary = await screen.findByRole(
      'region',
      { name: 'Resumo da carteira' },
      { timeout: 5000 },
    );
    expect(
      await within(summary).findByText('Inclui estimativas', {}, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(within(summary).getByText('Retorno total')).toBeInTheDocument();
    // Tesouro Selic é avaliado por estimativa no seed.
    expect(screen.getAllByText('Estimativa').length).toBeGreaterThan(0);
    expect(await screen.findByText('Integração ainda não disponível')).toBeInTheDocument();
    expect(screen.getByText(/não são recomendação de investimento/)).toBeInTheDocument();
  });

  it('cadastra ativo, registra compra com conta e mostra quantidade e preço médio', async () => {
    const user = userEvent.setup();
    const { router } = await renderApp('/investimentos', { authenticated: true });
    await screen.findByRole('region', { name: 'Resumo da carteira' }, { timeout: 5000 });

    await user.click(screen.getByRole('button', { name: 'Novo ativo' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Nome'), 'Vale');
    await user.type(within(dialog).getByLabelText('Código / ticker (opcional)'), 'vale3');
    await user.click(within(dialog).getByRole('button', { name: 'Cadastrar ativo' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toMatch(/^\/investimentos\/.+/);
    });
    const movement = await screen.findByRole('dialog', {}, { timeout: 5000 });
    await within(movement).findByText(/Nova movimentação — VALE3/);
    await user.type(within(movement).getByLabelText('Valor total'), '650,00');
    await user.type(within(movement).getByLabelText('Quantidade'), '10');
    await user.click(
      within(movement).getByRole('checkbox', { name: 'Debitar o valor de uma conta' }),
    );
    await choose(user, movement, 'Conta', 'Conta investimentos');
    await user.click(within(movement).getByRole('button', { name: 'Registrar' }));

    expect(await screen.findByText('Movimentação registrada: compra.')).toBeInTheDocument();
    const position = await screen.findByRole('region', { name: 'Posição' });
    await waitFor(() => {
      expect(within(position).getByText('Preço médio R$ 65,00')).toBeInTheDocument();
    });
    expect(within(position).getByText('Pelo custo')).toBeInTheDocument();
    expect(screen.getByText('com conta')).toBeInTheDocument();
  });

  it('pede para atualizar o valor quando a compra é anterior à última avaliação', async () => {
    const user = userEvent.setup();
    await renderApp('/investimentos/asset-itsa4?nova=1', { authenticated: true });
    const movement = await screen.findByRole('dialog', {}, { timeout: 5000 });
    await within(movement).findByLabelText('Valor total');
    await user.type(within(movement).getByLabelText('Valor total'), '100,00');
    await user.type(within(movement).getByLabelText('Quantidade'), '10');
    await user.click(within(movement).getByRole('button', { name: 'Registrar' }));

    const prompt = await screen.findByRole('dialog', { name: /Atualizar valor atual — ITSA4/ });
    expect(within(prompt).getByText(/não inclui esta movimentação/)).toBeInTheDocument();
    await user.click(within(prompt).getByRole('button', { name: 'Salvar valor' }));
    expect(await screen.findByText('Valor atual atualizado.')).toBeInTheDocument();
  });

  it('valida a movimentação (quantidade obrigatória para ações)', async () => {
    const user = userEvent.setup();
    await renderApp('/investimentos/asset-itsa4?nova=1', { authenticated: true });
    const movement = await screen.findByRole('dialog', {}, { timeout: 5000 });
    await within(movement).findByLabelText('Valor total');
    await user.click(within(movement).getByRole('button', { name: 'Registrar' }));
    expect(await within(movement).findByText('Informe o valor.')).toBeInTheDocument();
    await user.type(within(movement).getByLabelText('Valor total'), '10,00');
    await user.click(within(movement).getByRole('button', { name: 'Registrar' }));
    expect(
      await within(movement).findByText('Informe a quantidade (até 8 casas decimais).'),
    ).toBeInTheDocument();
  });
});
