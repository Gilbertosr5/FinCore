import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Auditoria automática de acessibilidade (axe-core, WCAG 2.1 A/AA) em todas as
 * rotas, nos temas escuro e claro, nos projetos desktop e mobile. Complementa —
 * não substitui — a revisão manual (teclado, leitor de tela).
 */

const DEMO = { email: 'demo@fincore.dev', password: 'Demo@2026' };
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const PUBLIC_ROUTES = ['/entrar', '/cadastro', '/recuperar-senha'];
const PRIVATE_ROUTES = [
  '/dashboard',
  '/transacoes',
  '/contas',
  '/contas/acc-corrente',
  '/cartoes',
  '/cartoes/card-roxinho',
  '/orcamentos',
  '/metas',
  '/metas/goal-viagem',
  '/investimentos',
  '/investimentos/asset-itsa4',
  '/planejamento',
  '/calendario',
  '/relatorios',
  '/configuracoes',
];

async function setTheme(page: Page, preference: 'dark' | 'light') {
  await page.addInitScript((value) => {
    localStorage.setItem(
      'fincore:theme',
      JSON.stringify({ state: { preference: value }, version: 1 }),
    );
  }, preference);
}

async function login(page: Page) {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(DEMO.email);
  await page.getByLabel('Senha', { exact: true }).fill(DEMO.password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
}

/** Violações da página atual, uma linha por regra (com até 4 elementos de exemplo). */
async function audit(page: Page, label: string): Promise<string[]> {
  // Espera o carregamento: nenhum esqueleto animado na área principal.
  await expect(page.locator('main .animate-pulse')).toHaveCount(0, { timeout: 10_000 });
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  return results.violations.map((violation) => {
    const examples = violation.nodes
      .slice(0, 4)
      .map((node) => {
        const detail = (node.any[0]?.message ?? '').replace(/\s+/g, ' ').slice(0, 90);
        return `${node.target.join(' ')} [${detail}]`;
      })
      .join(' | ');
    return `${label} › ${violation.id} (${violation.impact ?? '?'}): ${violation.help} — ${examples}`;
  });
}

for (const theme of ['dark', 'light'] as const) {
  test.describe(`acessibilidade — tema ${theme === 'dark' ? 'escuro' : 'claro'}`, () => {
    test('telas públicas', async ({ page }) => {
      await setTheme(page, theme);
      const found: string[] = [];
      for (const route of PUBLIC_ROUTES) {
        await page.goto(route);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        found.push(...(await audit(page, route)));
      }
      expect(found, found.join('\n')).toEqual([]);
    });

    test('telas autenticadas', async ({ page }) => {
      test.setTimeout(180_000);
      await setTheme(page, theme);
      await login(page);
      const found: string[] = [];
      for (const route of PRIVATE_ROUTES) {
        await page.goto(route);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        found.push(...(await audit(page, route)));
      }
      expect(found, found.join('\n')).toEqual([]);
    });
  });
}
