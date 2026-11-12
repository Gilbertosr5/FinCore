import { expect, test, type Page } from '@playwright/test';

const DEMO = { email: 'demo@fincore.dev', password: 'Demo@2026' };

async function login(page: Page) {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(DEMO.email);
  await page.getByLabel('Senha', { exact: true }).fill(DEMO.password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
}

test('cria meta, registra aporte e persiste após recarregar', async ({ page }) => {
  await login(page);
  await page.goto('/metas');
  await expect(page.getByRole('list', { name: 'Metas' })).toBeVisible();

  await page.getByRole('button', { name: 'Nova meta' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nome').fill('Meta E2E');
  await dialog.getByLabel('Valor desejado').fill('1.200,00');
  await dialog.getByRole('button', { name: 'Criar meta' }).click();
  await expect(page.getByText('Meta criada.')).toBeVisible();

  await page.getByRole('link', { name: 'Meta E2E' }).click();
  await expect(page.getByRole('heading', { name: 'Meta E2E' })).toBeVisible();
  await page.getByRole('button', { name: 'Aportar' }).click();
  await page.getByRole('dialog').getByLabel('Valor').fill('300,00');
  await page.getByRole('dialog').getByRole('button', { name: 'Registrar aporte' }).click();
  await expect(page.getByText('Aporte registrado.')).toBeVisible();

  const progress = page.getByRole('progressbar', { name: 'Progresso da meta Meta E2E' });
  await expect(progress).toHaveAttribute('aria-valuenow', '25');
  await page.reload();
  await expect(progress).toHaveAttribute('aria-valuenow', '25');
});

test('planejamento projeta o saldo e reage à grande compra simulada', async ({ page }) => {
  await login(page);
  await page.goto('/planejamento');
  const summary = page.getByRole('region', { name: 'Resumo da projeção' });
  await expect(summary.getByText('Ponto de partida')).toBeVisible();

  await page.getByRole('checkbox', { name: 'Simular uma grande compra' }).click();
  await page.getByLabel('Valor da compra').fill('900.000,00');
  await expect(page.getByText(/Com a compra, o saldo projetado fica negativo/)).toBeVisible();

  await expect(page.getByRole('table', { name: /mês a mês/ })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Resultado da simulação' })).toBeVisible();
});
