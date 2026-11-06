import { expect, test } from '@playwright/test';

const DEMO = { email: 'demo@fincore.dev', password: 'Demo@2026' };

test.beforeEach(async ({ page }) => {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(DEMO.email);
  await page.getByLabel('Senha', { exact: true }).fill(DEMO.password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
});

test('dashboard carrega indicadores, gráficos e listas a partir do IndexedDB', async ({ page }) => {
  const indicators = page.getByRole('region', { name: 'Indicadores principais' });
  await expect(indicators.getByText('Patrimônio líquido')).toBeVisible();
  await expect(indicators.getByText(/R\$\s[\d.]+,\d{2}/).first()).toBeVisible();

  await expect(page.getByText('Receitas x despesas')).toBeVisible();
  await expect(page.getByText('Despesas por categoria')).toBeVisible();
  await expect(page.getByText('Evolução do patrimônio')).toBeVisible();
  await expect(page.getByText('Últimas movimentações')).toBeVisible();
  await expect(page.getByText('Metas em andamento')).toBeVisible();

  // Os gráficos SVG do Recharts são de fato renderizados no navegador real.
  await expect(page.locator('.recharts-surface').first()).toBeVisible();
});

test('filtro de período atualiza a URL e persiste ao recarregar', async ({ page }) => {
  await page.getByRole('button', { name: 'Últimos 90 dias' }).click();
  await expect(page).toHaveURL(/periodo=90d/);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Últimos 90 dias' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('dados de demonstração persistem entre recarregamentos', async ({ page }) => {
  const indicators = page.getByRole('region', { name: 'Indicadores principais' });
  const card = indicators.getByText('Patrimônio líquido').locator('..');
  const before = /[\d.]+,\d{2}/.exec(await card.innerText())?.[0];
  expect(before).toBeDefined();
  await page.reload();
  await expect(card).toContainText(before ?? 'valor ausente');
});
