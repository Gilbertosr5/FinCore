import { expect, test, type Page } from '@playwright/test';

/**
 * Fluxos principais contra a API real (playwright.api.config.ts, ADR 0015).
 * Cada teste cadastra o próprio usuário (banco PGlite em memória compartilhado),
 * então nada depende de dados de demonstração nem da ordem dos testes.
 */

const PASSWORD = 'Segura123';

async function signUp(page: Page, name = 'Ana Integração'): Promise<string> {
  const email = `e2e-${crypto.randomUUID()}@exemplo.com`;
  await page.goto('/cadastro');
  await page.getByLabel('Nome completo').fill(name);
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirmar senha').fill(PASSWORD);
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
  return email;
}

async function choose(page: Page, label: string, option: string) {
  await page.getByRole('dialog').getByLabel(label, { exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

async function createAccount(page: Page, name: string, balance: string) {
  await page.goto('/contas');
  await page.getByRole('button', { name: 'Nova conta' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nome').fill(name);
  await dialog.getByLabel('Saldo inicial', { exact: true }).fill(balance);
  await dialog.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page.getByText('Conta criada.')).toBeVisible();
  await expect(dialog).toBeHidden();
}

test('cadastro, logout e login com sessão por cookie', async ({ page }) => {
  const email = await signUp(page);

  // Sessão (cookie HttpOnly) sobrevive ao recarregar.
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
  const cookies = await page.context().cookies();
  expect(cookies.find((cookie) => cookie.name === 'fincore_session')?.httpOnly).toBe(true);

  await page.getByRole('button', { name: /Menu do usuário/ }).click();
  await page.getByRole('menuitem', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/entrar$/);

  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha', { exact: true }).fill('SenhaErrada9');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('E-mail ou senha incorretos.');

  await page.getByLabel('Senha', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
});

test('lançamentos: despesa recorrente persistida no servidor e transferência', async ({ page }) => {
  await signUp(page);
  await createAccount(page, 'Conta corrente', '2.000,00');
  await createAccount(page, 'Poupança', '0,00');

  await page.goto('/transacoes');
  await page.getByRole('button', { name: 'Novo lançamento' }).first().click();
  await page.getByRole('menuitem', { name: 'Despesa' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Descrição').fill('Assinatura API');
  await dialog.getByLabel('Valor').fill('39,90');
  await choose(page, 'Conta', 'Conta corrente');
  await choose(page, 'Categoria', 'Assinaturas');
  await dialog.getByRole('checkbox', { name: 'Já paga' }).check();
  await dialog.getByRole('radio', { name: 'Recorrente' }).click();
  await dialog.getByRole('button', { name: 'Adicionar' }).click();
  await expect(page.getByText(/lançamentos? criados?\./)).toBeVisible();

  // Recarregar = ler de novo do servidor (nada fica no navegador).
  await page.reload();
  await page.getByLabel('Pesquisar lançamentos').fill('assinatura api');
  await expect(page.getByText('Assinatura API').filter({ visible: true }).first()).toBeVisible();

  await page.goto('/contas');
  await page.getByRole('button', { name: 'Transferir' }).click();
  await choose(page, 'De (origem)', 'Conta corrente');
  await choose(page, 'Para (destino)', 'Poupança');
  await page.getByRole('dialog').getByLabel('Valor').fill('100');
  await page.getByRole('dialog').getByRole('button', { name: 'Transferir' }).click();
  await expect(page.getByText('Transferência registrada.')).toBeVisible();
});

test('cartão: compra parcelada, pagamento da fatura e recusa acima do saldo', async ({ page }) => {
  await signUp(page);
  await createAccount(page, 'Conta corrente', '5.000,00');

  await page.goto('/cartoes');
  await page.getByRole('button', { name: 'Novo cartão' }).first().click();
  const cardDialog = page.getByRole('dialog');
  await cardDialog.getByLabel('Nome do cartão').fill('Cartão API');
  await cardDialog.getByLabel('Limite total').fill('3.000,00');
  await cardDialog.getByLabel('Dia de fechamento').fill('5');
  await cardDialog.getByLabel('Dia de vencimento').fill('12');
  await choose(page, 'Conta de pagamento', 'Conta corrente');
  await cardDialog.getByRole('button', { name: 'Cadastrar cartão' }).click();
  await expect(page.getByText('Cartão cadastrado.')).toBeVisible();

  await page.getByRole('button', { name: 'Nova compra' }).first().click();
  const dialog = page.getByRole('dialog');
  await choose(page, 'Cartão', 'Cartão API');
  await dialog.getByLabel('Descrição').fill('Compra API');
  await dialog.getByLabel('Valor total').fill('300,00');
  await choose(page, 'Categoria', 'Compras');
  await dialog.getByLabel('Parcelas').fill('3');
  await dialog.getByRole('button', { name: 'Registrar compra' }).click();
  await expect(page.getByText('Compra registrada.')).toBeVisible();

  await page
    .getByRole('link', { name: /Cartão API/ })
    .first()
    .click();
  const purchases = page.getByRole('list', { name: 'Compras do cartão' });
  await expect(purchases.getByText('Compra API')).toBeVisible();
  await page.reload();
  await expect(purchases.getByText('Compra API')).toBeVisible();

  // Fatura aberta (antecipação) com R$ 100,00: valor acima é recusado no cliente e no servidor.
  await page.getByRole('button', { name: 'Pagar fatura' }).click();
  const pay = page.getByRole('dialog');
  await pay.getByLabel('Valor do pagamento').fill('100,01');
  await pay.getByRole('button', { name: 'Confirmar pagamento' }).click();
  await expect(pay.getByText(/excede o saldo em aberto/)).toBeVisible();
  await pay.getByLabel('Valor do pagamento').fill('100,00');
  await pay.getByRole('button', { name: 'Confirmar pagamento' }).click();
  await expect(page.getByText('Fatura paga.')).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('list', { name: 'Pagamentos de fatura' }).getByRole('listitem').first(),
  ).toBeVisible();
});

test('orçamento mostra o consumo vindo do servidor', async ({ page }) => {
  await signUp(page);
  await page.goto('/orcamentos');
  await page.getByRole('button', { name: 'Novo orçamento' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nome').fill('Saúde API');
  await choose(page, 'Categoria', 'Saúde');
  await dialog.getByLabel('Limite').fill('800,00');
  await dialog.getByRole('button', { name: 'Criar orçamento' }).click();
  await expect(page.getByText('Orçamento criado.')).toBeVisible();

  await page.reload();
  const item = page
    .getByRole('list', { name: 'Orçamentos' })
    .getByRole('listitem')
    .filter({ hasText: 'Saúde API' });
  await expect(
    item.getByRole('progressbar', { name: 'Consumo do orçamento Saúde API' }),
  ).toBeVisible();
});

test('meta: aporte com transferência gravado na mesma requisição', async ({ page }) => {
  await signUp(page);
  await createAccount(page, 'Conta corrente', '3.000,00');
  await createAccount(page, 'Reserva', '0,00');

  await page.goto('/metas');
  await page.getByRole('button', { name: 'Nova meta' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nome').fill('Meta API');
  await dialog.getByLabel('Valor desejado').fill('1.200,00');
  await choose(page, 'Conta da meta (opcional)', 'Reserva');
  await dialog.getByRole('button', { name: 'Criar meta' }).click();
  await expect(page.getByText('Meta criada.')).toBeVisible();

  await page.getByRole('link', { name: 'Meta API' }).click();
  await expect(page.getByRole('heading', { name: 'Meta API' })).toBeVisible();
  await page.getByRole('button', { name: 'Aportar' }).click();
  const contribution = page.getByRole('dialog');
  await contribution.getByLabel('Valor').fill('300,00');
  await contribution.getByRole('checkbox', { name: /Registrar também a transferência/ }).check();
  await choose(page, 'Conta de origem', 'Conta corrente');
  await contribution.getByRole('button', { name: 'Registrar aporte' }).click();
  await expect(page.getByText('Aporte registrado.')).toBeVisible();

  const progress = page.getByRole('progressbar', { name: 'Progresso da meta Meta API' });
  await expect(progress).toHaveAttribute('aria-valuenow', '25');
  await page.reload();
  await expect(progress).toHaveAttribute('aria-valuenow', '25');

  // A transferência foi criada no servidor na mesma requisição do aporte.
  await page.goto('/transacoes');
  await page.getByLabel('Pesquisar lançamentos').fill('Meta API');
  await expect(
    page.getByText('Aporte na meta "Meta API"').filter({ visible: true }).first(),
  ).toBeVisible();
});

test('investimento: aplicação debitando a conta gera o lançamento junto', async ({ page }) => {
  await signUp(page);
  await createAccount(page, 'Conta corrente', '5.000,00');

  await page.goto('/investimentos');
  await page.getByRole('button', { name: 'Novo ativo' }).first().click();
  await page.getByRole('dialog').getByLabel('Nome').fill('Ativo API');
  await page.getByRole('dialog').getByLabel('Código / ticker (opcional)').fill('apie11');
  await page.getByRole('dialog').getByRole('button', { name: 'Cadastrar ativo' }).click();

  const movement = page.getByRole('dialog');
  await expect(movement.getByText(/Nova movimentação — APIE11/)).toBeVisible();
  await movement.getByLabel('Valor total').fill('1.000,00');
  await movement.getByLabel('Quantidade').fill('8');
  await movement.getByRole('checkbox', { name: 'Debitar o valor de uma conta' }).check();
  await choose(page, 'Conta', 'Conta corrente');
  await movement.getByRole('button', { name: 'Registrar' }).click();
  await expect(page.getByText('Movimentação registrada: compra.')).toBeVisible();

  const position = page.getByRole('region', { name: 'Posição' });
  await expect(position.getByText('Preço médio R$ 125,00')).toBeVisible();
  await page.reload();
  await expect(position.getByText('Preço médio R$ 125,00')).toBeVisible();

  await page.goto('/transacoes');
  await page.getByLabel('Pesquisar lançamentos').fill('APIE11');
  await expect(
    page
      .getByText(/Aplicação — APIE11/)
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
});

test('relatórios, busca global e exportação JSON', async ({ page, isMobile }) => {
  await signUp(page);
  await createAccount(page, 'Conta corrente', '1.500,00');

  await page.goto('/relatorios?relatorio=receitas-despesas-mensal&periodo=ano');
  await expect(page.getByRole('table', { name: /Receitas e despesas por mês/ })).toBeVisible();
  const [csv] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exportar CSV' }).click(),
  ]);
  expect(csv.suggestedFilename()).toMatch(/\.csv$/);

  if (!isMobile) {
    await page.keyboard.press('Control+k');
    await page.getByRole('combobox', { name: 'Buscar' }).fill('Conta corrente');
    await expect(page.getByRole('option', { name: /Conta corrente/ }).first()).toBeVisible();
    await page.keyboard.press('Escape');
  }

  await page.goto('/configuracoes');
  // Guarda o Blob gerado no navegador para conferir o conteúdo exportado.
  await page.evaluate(() => {
    const original = URL.createObjectURL.bind(URL);
    const captured: Blob[] = [];
    Object.assign(window, { capturedExports: captured });
    URL.createObjectURL = (blob: Blob | MediaSource) => {
      if (blob instanceof Blob) captured.push(blob);
      return original(blob);
    };
  });
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exportar meus dados' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^fincore-dados-\d{4}-\d{2}-\d{2}\.json$/);
  const json = await page.evaluate(async () => {
    const [blob] = (window as unknown as { capturedExports: Blob[] }).capturedExports;
    return blob ? blob.text() : '';
  });
  const exported = JSON.parse(json) as {
    source: string;
    data: { accounts: { name: string }[]; categories: unknown[] };
  };
  expect(exported.source).toBe('api');
  expect(exported.data.accounts.map((account) => account.name)).toEqual(['Conta corrente']);
  expect(exported.data.categories).toHaveLength(14);
});
