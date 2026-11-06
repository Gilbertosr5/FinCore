import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { authQueryKeys } from '@/features/auth';
import { sessionEvents } from '@/services/auth/session-events';

import { DEMO, renderApp } from '../helpers/render-app';

async function fillLogin(
  user: ReturnType<typeof userEvent.setup>,
  email: string,
  password: string,
) {
  await user.type(await screen.findByLabelText('E-mail'), email);
  await user.type(screen.getByLabelText('Senha'), password);
  await user.click(screen.getByRole('button', { name: 'Entrar' }));
}

describe('proteção de rotas', () => {
  it('redireciona visitante ao login e retorna à página original após autenticar', async () => {
    const user = userEvent.setup();
    const { router } = await renderApp('/orcamentos');

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/entrar');
    expect(screen.getByText('Faça login para acessar esta página.')).toBeInTheDocument();

    await fillLogin(user, DEMO.email, DEMO.password);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Orçamentos' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/orcamentos');
  });

  it('redireciona usuário autenticado que acessa o login', async () => {
    const { router } = await renderApp('/entrar', { authenticated: true });
    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/dashboard');
  });

  it('ignora destino externo malicioso após login (open redirect)', async () => {
    const user = userEvent.setup();
    const { router } = await renderApp('/entrar', {
      routeState: { from: '//malicioso.com/phishing' },
    });
    await fillLogin(user, DEMO.email, DEMO.password);
    await screen.findByRole('heading', { level: 1, name: 'Dashboard' });
    expect(router.state.location.pathname).toBe('/dashboard');
  });
});

describe('login', () => {
  it('valida campos antes de enviar', async () => {
    const user = userEvent.setup();
    await renderApp('/entrar');

    await user.click(await screen.findByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Informe seu e-mail.')).toBeInTheDocument();
    expect(screen.getByText('Informe sua senha.')).toBeInTheDocument();
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('aria-invalid', 'true');
  });

  it('exibe erro genérico para credenciais inválidas', async () => {
    const user = userEvent.setup();
    await renderApp('/entrar');

    await fillLogin(user, DEMO.email, 'senhaErrada1');

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos.');
  });

  it('preenche a conta de demonstração no adaptador de desenvolvimento', async () => {
    const user = userEvent.setup();
    await renderApp('/entrar');

    expect(await screen.findByText('Autenticação de desenvolvimento')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Usar conta de demonstração' }));

    expect(screen.getByLabelText('E-mail')).toHaveValue(DEMO.email);
    expect(screen.getByLabelText('Senha')).toHaveValue(DEMO.password);
  });

  it('alterna a visibilidade da senha', async () => {
    const user = userEvent.setup();
    await renderApp('/entrar');
    const password = await screen.findByLabelText('Senha');
    expect(password).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Mostrar senha' }));
    expect(password).toHaveAttribute('type', 'text');
  });
});

describe('cadastro', () => {
  it('cria a conta, autentica e abre o dashboard', async () => {
    const user = userEvent.setup();
    const { router } = await renderApp('/cadastro');

    await user.type(await screen.findByLabelText('Nome completo'), 'Bruno Lima');
    await user.type(screen.getByLabelText('E-mail'), 'bruno@exemplo.com');
    await user.type(screen.getByLabelText('Senha'), 'segura123');
    await user.type(screen.getByLabelText('Confirmar senha'), 'segura123');
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/dashboard');
    expect(screen.getByRole('button', { name: 'Menu do usuário Bruno Lima' })).toBeInTheDocument();
  });

  it('aplica política de senha e confirmação', async () => {
    const user = userEvent.setup();
    await renderApp('/cadastro');

    await user.type(await screen.findByLabelText('Nome completo'), 'Bruno Lima');
    await user.type(screen.getByLabelText('E-mail'), 'bruno@exemplo.com');
    await user.type(screen.getByLabelText('Senha'), 'semnumero');
    await user.type(screen.getByLabelText('Confirmar senha'), 'outra');
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(await screen.findByText('A senha deve conter ao menos um número.')).toBeInTheDocument();
    expect(screen.getByText('As senhas não coincidem.')).toBeInTheDocument();
  });

  it('indica e-mail já cadastrado no próprio campo', async () => {
    const user = userEvent.setup();
    await renderApp('/cadastro');

    await user.type(await screen.findByLabelText('Nome completo'), 'Outra Pessoa');
    await user.type(screen.getByLabelText('E-mail'), DEMO.email.toUpperCase());
    await user.type(screen.getByLabelText('Senha'), 'segura123');
    await user.type(screen.getByLabelText('Confirmar senha'), 'segura123');
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(await screen.findByText('Já existe uma conta com este e-mail.')).toBeInTheDocument();
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('logout e sessão', () => {
  it('encerra a sessão pelo menu do usuário e limpa os dados em cache', async () => {
    const user = userEvent.setup();
    const { router, queryClient } = await renderApp('/dashboard', { authenticated: true });
    queryClient.setQueryData(['transactions', 'list'], ['dado financeiro']);

    await user.click(await screen.findByRole('button', { name: /Menu do usuário/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'Sair' }));

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/entrar');
    expect(queryClient.getQueryData(['transactions', 'list'])).toBeUndefined();
    expect(queryClient.getQueryData(authQueryKeys.currentUser)).toBeNull();
  });

  it('leva à tela de sessão expirada e retorna à página após novo login', async () => {
    const user = userEvent.setup();
    const { router, repository } = await renderApp('/metas', { authenticated: true });
    await screen.findByRole('heading', { level: 1, name: 'Metas' });

    // Simula o backend invalidando a sessão e a camada HTTP detectando o 401.
    await repository.logout();
    act(() => {
      sessionEvents.emit('expired');
    });

    expect(await screen.findByRole('heading', { name: 'Sua sessão expirou' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/sessao-expirada');

    await user.click(screen.getByRole('link', { name: 'Entrar novamente' }));
    await fillLogin(user, DEMO.email, DEMO.password);

    expect(await screen.findByRole('heading', { level: 1, name: 'Metas' })).toBeInTheDocument();
  });

  it('ignora evento de expiração quando não há sessão ativa', async () => {
    const { router } = await renderApp('/entrar');
    await screen.findByRole('heading', { name: 'Entrar' });
    act(() => {
      sessionEvents.emit('expired');
    });
    expect(router.state.location.pathname).toBe('/entrar');
  });
});

describe('recuperação de senha', () => {
  it('solicita o link, redefine a senha e entra com a nova senha', async () => {
    const user = userEvent.setup();
    const { router, resetLinks } = await renderApp('/recuperar-senha');

    await user.type(await screen.findByLabelText('E-mail'), DEMO.email);
    await user.click(screen.getByRole('button', { name: 'Enviar link de redefinição' }));
    expect(await screen.findByText('Solicitação recebida')).toBeInTheDocument();

    const [link] = resetLinks;
    expect(link).toMatch(/^\/redefinir-senha\?token=/);
    await act(async () => {
      await router.navigate(link ?? '');
    });

    await user.type(await screen.findByLabelText('Nova senha'), 'novaSenha1');
    await user.type(screen.getByLabelText('Confirmar nova senha'), 'novaSenha1');
    await user.click(screen.getByRole('button', { name: 'Redefinir senha' }));

    expect(await screen.findByText(/Sua senha foi alterada/)).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Entrar com a nova senha' }));
    await fillLogin(user, DEMO.email, 'novaSenha1');

    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
  });

  it('não revela se o e-mail existe', async () => {
    const user = userEvent.setup();
    const { resetLinks } = await renderApp('/recuperar-senha');
    await user.type(await screen.findByLabelText('E-mail'), 'ninguem@exemplo.com');
    await user.click(screen.getByRole('button', { name: 'Enviar link de redefinição' }));
    expect(await screen.findByText('Solicitação recebida')).toBeInTheDocument();
    expect(resetLinks).toHaveLength(0);
  });

  it('informa link inválido quando não há token', async () => {
    await renderApp('/redefinir-senha');
    expect(await screen.findByRole('heading', { name: 'Link inválido' })).toBeInTheDocument();
  });

  it('informa link inválido quando o token é recusado', async () => {
    const user = userEvent.setup();
    const { router } = await renderApp('/entrar');
    await screen.findByRole('heading', { name: 'Entrar' });
    await act(async () => {
      await router.navigate('/redefinir-senha?token=inexistente');
    });

    await user.type(await screen.findByLabelText('Nova senha'), 'novaSenha1');
    await user.type(screen.getByLabelText('Confirmar nova senha'), 'novaSenha1');
    await user.click(screen.getByRole('button', { name: 'Redefinir senha' }));

    expect(await screen.findByRole('heading', { name: 'Link inválido' })).toBeInTheDocument();
  });
});

describe('configurações', () => {
  it('altera a senha validando a senha atual', async () => {
    const user = userEvent.setup();
    const { repository } = await renderApp('/configuracoes', { authenticated: true });

    const form = (await screen.findByRole('button', { name: 'Alterar senha' })).closest('form');
    if (!form) throw new Error('formulário não encontrado');
    const scope = within(form);

    await user.type(scope.getByLabelText('Senha atual'), 'errada123');
    await user.type(scope.getByLabelText('Nova senha'), 'novaSenha1');
    await user.type(scope.getByLabelText('Confirmar nova senha'), 'novaSenha1');
    await user.click(scope.getByRole('button', { name: 'Alterar senha' }));
    expect(await scope.findByText('A senha atual está incorreta.')).toBeInTheDocument();

    await user.clear(scope.getByLabelText('Senha atual'));
    await user.type(scope.getByLabelText('Senha atual'), DEMO.password);
    await user.click(scope.getByRole('button', { name: 'Alterar senha' }));

    expect(await screen.findByText('Senha alterada com sucesso.')).toBeInTheDocument();
    expect(scope.getByLabelText('Senha atual')).toHaveValue('');
    await repository.logout();
    await expect(
      repository.login({ email: DEMO.email, password: 'novaSenha1' }),
    ).resolves.toBeDefined();
  });

  it('altera a preferência de tema', async () => {
    const user = userEvent.setup();
    await renderApp('/configuracoes', { authenticated: true });

    await user.click(await screen.findByRole('radio', { name: 'Claro' }));
    expect(document.documentElement).not.toHaveClass('dark');
    await user.click(screen.getByRole('radio', { name: 'Escuro' }));
    expect(document.documentElement).toHaveClass('dark');
  });
});
