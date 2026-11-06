import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { GetDashboardOverviewUseCase, type PeriodSelection } from '@/features/dashboard';
import { formatMoney as formatMoneyRaw, type Money } from '@/lib/money';

import { renderApp, TEST_TODAY } from '../helpers/render-app';

/** O Testing Library normaliza o espaço não separável (U+00A0) do DOM para espaço comum. */
const formatMoney = (value: Money) => formatMoneyRaw(value).replace(/\s/g, ' ');

/** Valor de um cartão de indicador pelo rótulo. */
async function kpiValue(label: string) {
  const labelNode = await screen.findByText(label);
  const card = labelNode.closest('[data-slot="card"]');
  if (!(card instanceof HTMLElement)) throw new Error(`Indicador "${label}" não encontrado`);
  return within(card);
}

async function expectedOverview(
  dataLayer: Awaited<ReturnType<typeof renderApp>>['dataLayer'],
  selection: PeriodSelection,
) {
  return new GetDashboardOverviewUseCase(dataLayer.repositories, () => TEST_TODAY).execute(
    selection,
  );
}

describe('dashboard', () => {
  it('exibe os indicadores calculados a partir dos dados de demonstração', async () => {
    const { dataLayer } = await renderApp('/dashboard', { authenticated: true });
    const expected = await expectedOverview(dataLayer, { preset: 'current_month' });

    expect(
      (await kpiValue('Patrimônio líquido')).getByText(formatMoney(expected.netWorth)),
    ).toBeInTheDocument();
    expect(
      (await kpiValue('Saldo em contas')).getByText(formatMoney(expected.accountsBalance)),
    ).toBeInTheDocument();
    expect(
      (await kpiValue('Receitas do período')).getByText(formatMoney(expected.totals.income)),
    ).toBeInTheDocument();
    expect(
      (await kpiValue('Despesas do período')).getByText(formatMoney(expected.totals.expenses)),
    ).toBeInTheDocument();
    expect(
      (await kpiValue('Comprometido em faturas')).getByText(formatMoney(expected.cardCommitment)),
    ).toBeInTheDocument();
    expect(screen.getByText('01/11/2026 a 30/11/2026')).toBeInTheDocument();
    expect(screen.getByText(/Dados de demonstração/)).toBeInTheDocument();
  });

  it('o filtro de período recalcula os indicadores e fica na URL', async () => {
    const user = userEvent.setup();
    const { router, dataLayer } = await renderApp('/dashboard', { authenticated: true });
    await screen.findByText('01/11/2026 a 30/11/2026');

    await user.click(screen.getByRole('button', { name: 'Ano atual' }));

    expect(await screen.findByText('01/01/2026 a 31/12/2026')).toBeInTheDocument();
    expect(router.state.location.search).toBe('?periodo=ano');
    expect(screen.getByRole('button', { name: 'Ano atual' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const expected = await expectedOverview(dataLayer, { preset: 'current_year' });
    expect(
      (await kpiValue('Receitas do período')).getByText(formatMoney(expected.totals.income)),
    ).toBeInTheDocument();
  });

  it('abre direto com o período da URL', async () => {
    await renderApp('/dashboard?periodo=personalizado&de=2026-03-01&ate=2026-03-31', {
      authenticated: true,
    });
    expect(await screen.findByText('01/03/2026 a 31/03/2026')).toBeInTheDocument();
  });

  it('valida o período personalizado antes de aplicar', async () => {
    const user = userEvent.setup();
    await renderApp('/dashboard', { authenticated: true });
    await screen.findByText('01/11/2026 a 30/11/2026');

    await user.click(screen.getByRole('button', { name: 'Personalizado' }));
    fireEvent.change(screen.getByLabelText('Data inicial'), { target: { value: '2026-05-10' } });
    fireEvent.change(screen.getByLabelText('Data final'), { target: { value: '2026-05-01' } });
    await user.click(screen.getByRole('button', { name: 'Aplicar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A data inicial deve ser anterior ou igual à data final.',
    );
  });

  it('cada gráfico oferece a visão em tabela com os mesmos dados', async () => {
    const user = userEvent.setup();
    const { dataLayer } = await renderApp('/dashboard', { authenticated: true });
    const expected = await expectedOverview(dataLayer, { preset: 'current_month' });
    await screen.findByText('Receitas x despesas');

    const [firstToggle, ...otherToggles] = screen.getAllByRole('button', { name: 'Ver tabela' });
    if (!firstToggle) throw new Error('Nenhum gráfico com visão em tabela');
    expect(otherToggles.length).toBeGreaterThanOrEqual(5);
    await user.click(firstToggle);

    const table = await screen.findByRole('table', { name: 'Receitas e despesas por mês' });
    const last = expected.monthly.at(-1);
    if (!last) throw new Error('série vazia');
    expect(within(table).getByText(formatMoney(last.income))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver gráfico' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('mostra listas de vencimentos, faturas, orçamentos e metas', async () => {
    await renderApp('/dashboard', { authenticated: true });
    expect(await screen.findByText('Próximas contas a vencer')).toBeInTheDocument();
    expect(screen.getByText('Próximas faturas')).toBeInTheDocument();
    expect(screen.getByText('Metas em andamento')).toBeInTheDocument();
    expect(screen.getByText('Reserva de emergência')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Alertas financeiros' })).toBeInTheDocument();
  });
});

describe('restauração dos dados de demonstração', () => {
  it('pede confirmação e recria os dados', async () => {
    const user = userEvent.setup();
    await renderApp('/configuracoes', { authenticated: true });

    expect(await screen.findByText(/Gerados para 12 meses até 06\/11\/2026/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Restaurar dados' }));
    const dialog = await screen.findByRole('dialog', { name: 'Restaurar dados de demonstração?' });
    await user.click(within(dialog).getByRole('button', { name: 'Restaurar' }));

    expect(await screen.findByText('Dados de demonstração restaurados.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
