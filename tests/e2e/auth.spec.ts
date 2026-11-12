import { expect, test, type Page } from '@playwright/test';

/** Conta de demonstração do adaptador de desenvolvimento (src/features/auth/infrastructure/dev). */
const DEMO = { email: 'demo@fincore.dev', password: 'Demo@2026' };

async function login(page: Page, email = DEMO.email, password = DEMO.password) {
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
}

test.describe('autenticação', () => {
  test('rota protegida exige login e retorna ao destino original', async ({ page }) => {
    await page.goto('/orcamentos');

    await expect(page).toHaveURL(/\/entrar$/);
    await expect(page.getByText('Faça login para acessar esta página.')).toBeVisible();

    await login(page);

    await expect(page).toHaveURL(/\/orcamentos$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Orçamentos' })).toBeVisible();
  });

  test('credenciais inválidas exibem erro sem revelar qual campo está errado', async ({ page }) => {
    await page.goto('/entrar');
    await login(page, DEMO.email, 'senhaErrada1');
    await expect(page.getByRole('alert')).toContainText('E-mail ou senha incorretos.');
    await expect(page).toHaveURL(/\/entrar$/);
  });

  test('sessão persiste ao recarregar e termina no logout', async ({ page }) => {
    await page.goto('/entrar');
    await login(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();

    await page.getByRole('button', { name: /Menu do usuário/ }).click();
    await page.getByRole('menuitem', { name: 'Sair' }).click();

    await expect(page).toHaveURL(/\/entrar$/);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/entrar$/);
  });

  test('nenhuma senha é gravada no armazenamento do navegador', async ({ page }) => {
    await page.goto('/entrar');
    await login(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();

    const stored = await page.evaluate(() =>
      JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)]),
    );
    expect(stored).not.toContain(DEMO.password);
  });

  test('cadastro cria a conta e abre o dashboard', async ({ page }) => {
    await page.goto('/cadastro');
    await page.getByLabel('Nome completo').fill('Bruno Lima');
    await page.getByLabel('E-mail').fill('bruno@exemplo.com');
    await page.getByLabel('Senha', { exact: true }).fill('segura123');
    await page.getByLabel('Confirmar senha').fill('segura123');
    await page.getByRole('button', { name: 'Criar conta' }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('button', { name: 'Menu do usuário Bruno Lima' })).toBeVisible();
  });
});

test.describe('navegação', () => {
  test('navega pelos módulos no desktop e no celular', async ({ page, isMobile }) => {
    await page.goto('/entrar');
    await login(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();

    if (isMobile) {
      await page.getByRole('button', { name: 'Abrir menu' }).click();
      await page
        .getByRole('dialog', { name: 'Menu de navegação' })
        .getByRole('link', { name: 'Metas' })
        .click();
      await expect(page.getByRole('dialog')).toBeHidden();
    } else {
      await page
        .getByRole('navigation', { name: 'Navegação principal' })
        .getByRole('link', { name: 'Metas' })
        .click();
    }

    await expect(page).toHaveURL(/\/metas$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Metas' })).toBeVisible();
  });

  test('busca global abre com Ctrl+K e navega pelo teclado', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Atalho de teclado aplicável apenas ao desktop.');
    await page.goto('/entrar');
    await login(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();

    await page.keyboard.press('Control+k');
    await page.getByRole('combobox', { name: 'Buscar' }).fill('relat');
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/\/relatorios$/);
  });
});
