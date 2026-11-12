import { expect, test, type Page } from '@playwright/test';

/**
 * O build de produção (E2E usa `vite preview`) traz Content Security Policy
 * (ADR 0014). Nenhuma tela ou exportação pode violá-la.
 */

const DEMO = { email: 'demo@fincore.dev', password: 'Demo@2026' };

function collectCspViolations(page: Page): string[] {
  const violations: string[] = [];
  page.on('console', (message) => {
    if (/Content Security Policy|Refused to/i.test(message.text())) violations.push(message.text());
  });
  return violations;
}

test('CSP presente e script de tema permitido pelo hash', async ({ page }) => {
  const violations = collectCspViolations(page);
  await page.addInitScript(() => {
    localStorage.setItem(
      'fincore:theme',
      JSON.stringify({ state: { preference: 'light' }, version: 1 }),
    );
  });
  await page.goto('/entrar');
  const csp = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute('content');
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  // O script inline de tema rodou (hash aceito): o tema claro foi aplicado.
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  expect(violations).toEqual([]);
});

test('navegação e exportação em PDF não violam a CSP', async ({ page }) => {
  const violations = collectCspViolations(page);
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(DEMO.email);
  await page.getByLabel('Senha', { exact: true }).fill(DEMO.password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();

  for (const route of ['/transacoes', '/cartoes', '/investimentos', '/planejamento']) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  }
  await page.goto('/relatorios?relatorio=resumo&periodo=ano');
  await expect(page.getByRole('table', { name: /Resumo e indicadores/ })).toBeVisible();
  const [pdf] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exportar PDF' }).click(),
  ]);
  expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);
  expect(violations).toEqual([]);
});
