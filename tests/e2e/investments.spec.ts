import { expect, test, type Page } from '@playwright/test';

const DEMO = { email: 'demo@fincore.dev', password: 'Demo@2026' };

async function login(page: Page) {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(DEMO.email);
  await page.getByLabel('Senha', { exact: true }).fill(DEMO.password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
}

test('cadastra ativo, registra compra e persiste a posição', async ({ page }) => {
  await login(page);
  await page.goto('/investimentos');
  await expect(page.getByRole('region', { name: 'Resumo da carteira' })).toBeVisible();

  await page.getByRole('button', { name: 'Novo ativo' }).click();
  await page.getByRole('dialog').getByLabel('Nome').fill('Ativo E2E');
  await page.getByRole('dialog').getByLabel('Código / ticker (opcional)').fill('etoe11');
  await page.getByRole('dialog').getByRole('button', { name: 'Cadastrar ativo' }).click();

  const movement = page.getByRole('dialog');
  await expect(movement.getByText(/Nova movimentação — ETOE11/)).toBeVisible();
  await movement.getByLabel('Valor total').fill('1.000,00');
  await movement.getByLabel('Quantidade').fill('8');
  await movement.getByRole('button', { name: 'Registrar' }).click();
  await expect(page.getByText('Movimentação registrada: compra.')).toBeVisible();

  const position = page.getByRole('region', { name: 'Posição' });
  await expect(position.getByText('Preço médio R$ 125,00')).toBeVisible();
  await page.reload();
  await expect(position.getByText('Preço médio R$ 125,00')).toBeVisible();

  await page.goto('/investimentos');
  await expect(page.getByRole('link', { name: 'ETOE11' }).filter({ visible: true })).toBeVisible();
});
