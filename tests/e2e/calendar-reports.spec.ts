import { expect, test, type Page } from '@playwright/test';

const DEMO = { email: 'demo@fincore.dev', password: 'Demo@2026' };

async function login(page: Page) {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(DEMO.email);
  await page.getByLabel('Senha', { exact: true }).fill(DEMO.password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
}

test('calendário mostra o mês e os eventos do dia selecionado', async ({ page }) => {
  await login(page);
  await page.goto('/calendario');
  const grid = page.getByRole('grid', { name: 'Calendário do mês' });
  await expect(grid).toBeVisible();
  await grid
    .getByRole('button', { name: /eventos?/ })
    .first()
    .click();
  await expect(page).toHaveURL(/dia=\d{4}-\d{2}-\d{2}/);
  await page.getByRole('button', { name: 'Semana' }).click();
  await expect(page).toHaveURL(/visao=semana/);
  await expect(page.getByRole('list', { name: 'Dias da semana' })).toBeVisible();
});

test('relatório exporta CSV e PDF com o período no nome do arquivo', async ({ page }) => {
  await login(page);
  await page.goto('/relatorios?relatorio=receitas-despesas-mensal&periodo=ano');
  await expect(page.getByRole('table', { name: /Receitas e despesas por mês/ })).toBeVisible();

  const [csv] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exportar CSV' }).click(),
  ]);
  expect(csv.suggestedFilename()).toMatch(
    /^fincore-receitas-despesas-mensal-\d{4}-01-01-a-\d{4}-12-31\.csv$/,
  );

  const [pdf] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exportar PDF' }).click(),
  ]);
  expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);
});
