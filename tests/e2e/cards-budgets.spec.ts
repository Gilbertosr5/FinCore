import { expect, test, type Page } from '@playwright/test';

const DEMO = { email: 'demo@fincore.dev', password: 'Demo@2026' };

async function login(page: Page) {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(DEMO.email);
  await page.getByLabel('Senha', { exact: true }).fill(DEMO.password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
}

async function choose(page: Page, label: string, option: string) {
  await page.getByRole('dialog').getByLabel(label).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

test('registra compra parcelada no cartão, persiste e paga a fatura', async ({ page }) => {
  await login(page);
  await page.goto('/cartoes');
  await expect(page.getByText('Roxinho Platinum')).toBeVisible();

  await page.getByRole('button', { name: 'Nova compra' }).click();
  const dialog = page.getByRole('dialog');
  await choose(page, 'Cartão', 'Roxinho Platinum');
  await dialog.getByLabel('Descrição').fill('Compra E2E');
  await dialog.getByLabel('Valor total').fill('250,00');
  await choose(page, 'Categoria', 'Compras');
  await dialog.getByLabel('Parcelas').fill('2');
  await expect(dialog.getByText(/2x de R\$\s125,00/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Registrar compra' }).click();
  await expect(page.getByText('Compra registrada.')).toBeVisible();

  await page.goto('/cartoes/card-roxinho');
  const purchases = page.getByRole('list', { name: 'Compras do cartão' });
  await expect(purchases.getByText('Compra E2E')).toBeVisible();

  // Persistência no IndexedDB.
  await page.reload();
  await expect(purchases.getByText('Compra E2E')).toBeVisible();

  // A fatura exibida tem saldo (fechada ou a aberta com a compra nova): paga integralmente.
  await page.getByRole('button', { name: 'Pagar fatura' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar pagamento' }).click();
  await expect(page.getByText('Fatura paga.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pagar fatura' })).toHaveCount(0);
  await expect(
    page.getByRole('list', { name: 'Pagamentos de fatura' }).getByRole('listitem').first(),
  ).toBeVisible();
});

test('cria orçamento e mostra o consumo do mês', async ({ page }) => {
  await login(page);
  await page.goto('/orcamentos');
  await expect(page.getByRole('list', { name: 'Orçamentos' })).toBeVisible();

  await page.getByRole('button', { name: 'Novo orçamento' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nome').fill('Saúde E2E');
  await choose(page, 'Categoria', 'Saúde');
  await dialog.getByLabel('Limite').fill('5000,00');
  await dialog.getByRole('button', { name: 'Criar orçamento' }).click();
  await expect(page.getByText('Orçamento criado.')).toBeVisible();

  const item = page
    .getByRole('list', { name: 'Orçamentos' })
    .getByRole('listitem')
    .filter({ hasText: 'Saúde E2E' });
  await expect(
    item.getByRole('progressbar', { name: 'Consumo do orçamento Saúde E2E' }),
  ).toBeVisible();
  await expect(item.getByText('Disponível')).toBeVisible();
});

test('central de notificações leva ao módulo do alerta', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: /^Notificações/ }).click();
  const panel = page.getByRole('dialog', { name: 'Notificações' });
  await expect(panel).toBeVisible();
  // Os alertas dependem da data real; sem alertas, o estado vazio é exibido.
  if ((await panel.getByRole('link').count()) === 0) {
    await expect(panel.getByText('Nenhuma notificação')).toBeVisible();
    return;
  }
  await panel.getByRole('link').first().click();
  await expect(panel).toBeHidden();
  await expect(page).not.toHaveURL(/\/entrar/);
});
