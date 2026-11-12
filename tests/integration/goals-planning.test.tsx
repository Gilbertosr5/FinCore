import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderApp } from '../helpers/render-app';

type User = ReturnType<typeof userEvent.setup>;

/* Hoje fixo nos testes de integração: 06/11/2026 (ver render-app). */

async function choose(user: User, scope: HTMLElement, label: string, option: string) {
  await user.click(within(scope).getByLabelText(label));
  await user.click(await screen.findByRole('option', { name: option }));
}

describe('metas', () => {
  it('cria meta com prazo e mostra o aporte mensal necessário', async () => {
    const user = userEvent.setup();
    await renderApp('/metas', { authenticated: true });
    await screen.findByRole('list', { name: 'Metas' });

    await user.click(screen.getByRole('button', { name: 'Nova meta' }));
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByLabelText('Nome');
    await user.type(within(dialog).getByLabelText('Nome'), 'Notebook novo');
    await choose(user, dialog, 'Tipo de meta', 'Equipamentos');
    await user.type(within(dialog).getByLabelText('Valor desejado'), '6.000,00');
    await user.type(within(dialog).getByLabelText('Data final (opcional)'), '2027-11-06');
    await user.click(within(dialog).getByRole('button', { name: 'Criar meta' }));

    expect(await screen.findByText('Meta criada.')).toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'Metas' });
    const item = (await within(list).findByText('Notebook novo')).closest('li');
    if (!item) throw new Error('meta não encontrada');
    // 6.000 em 12 meses.
    expect(within(item).getByText(/500,00/)).toBeInTheDocument();
  });

  it('valida o formulário da meta', async () => {
    const user = userEvent.setup();
    await renderApp('/metas', { authenticated: true });
    await screen.findByRole('list', { name: 'Metas' });
    await user.click(screen.getByRole('button', { name: 'Nova meta' }));
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByLabelText('Nome');
    await user.type(within(dialog).getByLabelText('Data final (opcional)'), '2020-01-01');
    await user.click(within(dialog).getByRole('button', { name: 'Criar meta' }));
    expect(await within(dialog).findByText('Informe o nome da meta.')).toBeInTheDocument();
    expect(within(dialog).getByText('Informe o valor desejado.')).toBeInTheDocument();
    expect(
      within(dialog).getByText('A data final deve ser posterior à inicial.'),
    ).toBeInTheDocument();
  });

  it('registra aporte com transferência na página da meta', async () => {
    const user = userEvent.setup();
    await renderApp('/metas/goal-viagem', { authenticated: true });
    await user.click(await screen.findByRole('button', { name: 'Aportar' }, { timeout: 5000 }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Valor'), '250,00');
    await user.click(
      within(dialog).getByRole('checkbox', { name: /Registrar também a transferência/ }),
    );
    await choose(user, dialog, 'Conta de origem', 'Conta corrente');
    await user.click(within(dialog).getByRole('button', { name: 'Registrar aporte' }));

    expect(await screen.findByText('Aporte registrado.')).toBeInTheDocument();
    const list = await screen.findByRole('list', { name: 'Aportes da meta' });
    await waitFor(() => {
      expect(within(list).getByText('com transferência')).toBeInTheDocument();
    });
  });
});

describe('planejamento', () => {
  it('projeta o saldo, compara cenários e simula uma grande compra', async () => {
    const user = userEvent.setup();
    await renderApp('/planejamento', { authenticated: true });
    const summary = await screen.findByRole(
      'region',
      { name: 'Resumo da projeção' },
      { timeout: 5000 },
    );
    expect(within(summary).getByText('Ponto de partida')).toBeInTheDocument();
    expect(within(summary).getByText('Otimista')).toBeInTheDocument();
    expect(screen.getAllByText('Estimativa').length).toBeGreaterThan(0);

    const projected = () =>
      within(summary).getByText(/^Saldo projetado em/).parentElement?.textContent ?? '';
    const before = projected();

    await user.click(screen.getByRole('checkbox', { name: 'Simular uma grande compra' }));
    await user.type(screen.getByLabelText('Valor da compra'), '500.000,00');
    expect(
      await screen.findByText(/Com a compra, o saldo projetado fica negativo/),
    ).toBeInTheDocument();
    expect(projected()).not.toBe(before);

    // Cenário personalizado com percentual inválido mostra a validação.
    await user.click(screen.getByLabelText('Cenário'));
    await user.click(await screen.findByRole('option', { name: 'Personalizado' }));
    const income = screen.getByLabelText('Variação das receitas (%)');
    await user.clear(income);
    await user.type(income, '-500');
    expect(screen.getByText('Informe um percentual entre −100 e 200.')).toBeInTheDocument();
  });

  it('mostra o plano anual e detalha o mês escolhido por categoria', async () => {
    const user = userEvent.setup();
    await renderApp('/planejamento', { authenticated: true });
    const table = await screen.findByRole(
      'table',
      { name: 'Plano de 2026 mês a mês' },
      { timeout: 5000 },
    );
    expect(within(table).getAllByRole('row')).toHaveLength(14); // cabeçalho + 12 + total
    expect(within(table).getAllByText('Realizado').length).toBe(10);
    expect(within(table).getByText('Em andamento')).toBeInTheDocument();

    await user.click(within(table).getByRole('button', { name: 'Dezembro de 2026' }));
    const month = screen.getByRole('region', { name: 'Plano de dezembro de 2026' });
    expect(within(month).getByText('Inclui estimativas')).toBeInTheDocument();
    expect(
      within(month).getByRole('table', { name: 'Despesas por categoria' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Próximo ano' }));
    expect(
      await screen.findByRole('table', { name: 'Plano de 2027 mês a mês' }),
    ).toBeInTheDocument();
  });

  it('simula economia com juros compostos e objetivo', async () => {
    const user = userEvent.setup();
    await renderApp('/planejamento', { authenticated: true });
    const months = await screen.findByLabelText('Prazo (meses)');
    await user.clear(screen.getByLabelText('Aporte mensal'));
    await user.type(screen.getByLabelText('Aporte mensal'), '100,00');
    await user.clear(screen.getByLabelText('Valor inicial'));
    await user.type(screen.getByLabelText('Valor inicial'), '1.000,00');
    await user.clear(screen.getByLabelText('Rentabilidade (% ao mês)'));
    await user.type(screen.getByLabelText('Rentabilidade (% ao mês)'), '1');
    await user.clear(months);
    await user.type(months, '12');
    await user.type(screen.getByLabelText('Objetivo (opcional)'), '2.395,00');

    const result = screen.getByRole('region', { name: 'Resultado da simulação' });
    expect(within(result).getByText(/2\.395,08/)).toBeInTheDocument();
    expect(within(result).getByText(/2\.200,00/)).toBeInTheDocument();
    expect(within(result).getByText(/Com o aporte atual: 1 ano\./)).toBeInTheDocument();

    await user.clear(months);
    await user.type(months, '0');
    expect(
      screen.getByText('Corrija os campos destacados para ver a simulação.'),
    ).toBeInTheDocument();
  });
});
