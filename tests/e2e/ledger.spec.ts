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

test('cria despesa recorrente, persiste após recarregar e aparece no extrato', async ({ page }) => {
  await login(page);
  await page.goto('/transacoes');
  await page.getByRole('button', { name: 'Novo lançamento' }).first().click();
  await page.getByRole('menuitem', { name: 'Despesa' }).click();

  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Descrição').fill('Assinatura E2E');
  await dialog.getByLabel('Valor').fill('39,90');
  await choose(page, 'Conta', 'Conta corrente');
  await choose(page, 'Categoria', 'Assinaturas');
  await dialog.getByRole('checkbox', { name: 'Já paga' }).check();
  await dialog.getByRole('radio', { name: 'Recorrente' }).click();
  await dialog.getByRole('button', { name: 'Adicionar' }).click();
  await expect(page.getByText(/lançamentos? criados?\./)).toBeVisible();

  await page.getByLabel('Pesquisar lançamentos').fill('assinatura e2e');
  await expect(page).toHaveURL(/q=assinatura/);
  await expect(page.getByText('Assinatura E2E').filter({ visible: true }).first()).toBeVisible();

  // Persistência no IndexedDB.
  await page.reload();
  await expect(page.getByText('Assinatura E2E').filter({ visible: true }).first()).toBeVisible();

  await page.goto('/contas/acc-corrente');
  await expect(page.getByText('Assinatura E2E').filter({ visible: true }).first()).toBeVisible();
});

test('transferência entre contas pela tela de contas', async ({ page }) => {
  await login(page);
  await page.goto('/contas');
  await expect(page.getByText('Poupança').first()).toBeVisible();
  await page.getByRole('button', { name: 'Transferir' }).click();
  await choose(page, 'De (origem)', 'Conta corrente');
  await choose(page, 'Para (destino)', 'Poupança');
  await page.getByRole('dialog').getByLabel('Valor').fill('100');
  await page.getByRole('dialog').getByRole('button', { name: 'Transferir' }).click();
  await expect(page.getByText('Transferência registrada.')).toBeVisible();
});
