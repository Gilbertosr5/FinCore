import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { NAVIGATION_ITEMS } from '@/constants/navigation';
import { useThemeStore } from '@/stores/theme.store';
import { useUiStore } from '@/stores/ui.store';

import { renderApp } from '../helpers/render-app';

beforeEach(() => {
  useThemeStore.setState({ preference: 'dark' });
  useUiStore.setState({ sidebarCollapsed: false, mobileNavOpen: false });
});

const mainNav = () => screen.findByRole('navigation', { name: 'Navegação principal' });

describe('estrutura da aplicação (autenticado)', () => {
  it('redireciona a raiz para o dashboard', async () => {
    const { router } = await renderApp('/', { authenticated: true });
    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/dashboard');
  });

  it('exibe todos os módulos na navegação principal', async () => {
    await renderApp('/dashboard', { authenticated: true });
    const nav = await mainNav();
    for (const item of NAVIGATION_ITEMS) {
      expect(within(nav).getByRole('link', { name: item.label })).toHaveAttribute(
        'href',
        item.path,
      );
    }
  });

  it('navega entre módulos e marca o item ativo', async () => {
    const user = userEvent.setup();
    const { router } = await renderApp('/dashboard', { authenticated: true });
    const nav = await mainNav();

    await user.click(within(nav).getByRole('link', { name: 'Orçamentos' }));

    // Rota com carregamento sob demanda: a navegação conclui após carregar a página.
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/orcamentos');
    });
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Orçamentos' }),
    ).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Orçamentos' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('informa explicitamente que módulos futuros ainda não foram entregues', async () => {
    await renderApp('/calendario', { authenticated: true });
    expect(await screen.findByText('Previsto para a Fase 8')).toBeInTheDocument();
  });

  it('exibe página 404 para rotas inexistentes', async () => {
    await renderApp('/rota-que-nao-existe');
    expect(
      await screen.findByRole('heading', { name: 'Página não encontrada' }),
    ).toBeInTheDocument();
  });

  it('alterna entre tema escuro e claro aplicando a classe no <html>', async () => {
    const user = userEvent.setup();
    await renderApp('/dashboard', { authenticated: true });

    await user.click(await screen.findByRole('button', { name: 'Ativar tema claro' }));
    expect(document.documentElement).not.toHaveClass('dark');
    expect(useThemeStore.getState().preference).toBe('light');

    await user.click(screen.getByRole('button', { name: 'Ativar tema escuro' }));
    expect(document.documentElement).toHaveClass('dark');
  });

  it('recolhe e expande a sidebar', async () => {
    const user = userEvent.setup();
    await renderApp('/dashboard', { authenticated: true });

    await user.click(await screen.findByRole('button', { name: 'Recolher menu lateral' }));
    expect(useUiStore.getState().sidebarCollapsed).toBe(true);
    expect(screen.getByRole('button', { name: 'Expandir menu lateral' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('abre a navegação móvel, navega e fecha automaticamente', async () => {
    const user = userEvent.setup();
    const { router } = await renderApp('/dashboard', { authenticated: true });

    await user.click(await screen.findByRole('button', { name: 'Abrir menu' }));
    const drawer = await screen.findByRole('dialog', { name: 'Menu de navegação' });

    await user.click(within(drawer).getByRole('link', { name: 'Metas' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/metas');
    });
    expect(useUiStore.getState().mobileNavOpen).toBe(false);
  });

  it('fecha a navegação móvel com Escape', async () => {
    const user = userEvent.setup();
    await renderApp('/dashboard', { authenticated: true });

    await user.click(await screen.findByRole('button', { name: 'Abrir menu' }));
    await screen.findByRole('dialog', { name: 'Menu de navegação' });
    await user.keyboard('{Escape}');

    expect(useUiStore.getState().mobileNavOpen).toBe(false);
  });

  it('busca global (Ctrl+K) filtra módulos e navega com o teclado', async () => {
    const user = userEvent.setup();
    const { router } = await renderApp('/dashboard', { authenticated: true });
    await mainNav();

    await user.keyboard('{Control>}k{/Control}');
    const input = await screen.findByRole('combobox', { name: 'Buscar módulos' });
    await user.type(input, 'cartoes');

    expect(screen.getAllByRole('option')).toHaveLength(1);
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/cartoes');
    });
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('central de notificações lista os alertas financeiros com link para o módulo', async () => {
    const user = userEvent.setup();
    const { router } = await renderApp('/dashboard', { authenticated: true });

    // O contador aparece no rótulo assim que os alertas do mês são calculados.
    const trigger = await screen.findByRole('button', { name: /^Notificações \(\d+ alerta/ });
    await user.click(trigger);
    const panel = await screen.findByRole('dialog', { name: 'Notificações' });
    const links = within(panel).getAllByRole('link');
    expect(links.length).toBeGreaterThan(0);

    const budgetAlert = within(panel).queryAllByRole('link', { name: /Orçamento de/ })[0];
    if (budgetAlert) {
      await user.click(budgetAlert);
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/orcamentos');
      });
    }
  });
});
