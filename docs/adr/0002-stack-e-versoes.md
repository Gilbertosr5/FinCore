# ADR 0002 — Stack e compatibilidade de versões

- **Status:** Aceito
- **Data:** 05/11/2026

## Contexto

O requisito é usar versões modernas **compatíveis entre si**. Na data da
implementação, as versões mais recentes de algumas ferramentas ainda não eram
suportadas pelo restante do ecossistema.

## Decisões

| Ferramenta        | Versão                                        | Motivo                                                                                                                    |
| ----------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| TypeScript        | **6.0.x** (não 7.x)                           | `typescript-eslint` 8.x declara suporte a `typescript <6.1`. O TS 7 (port nativo) quebraria o lint com checagem de tipos. |
| ESLint            | **9.x** (não 10.x)                            | `eslint-plugin-jsx-a11y` e `eslint-plugin-react` ainda não suportam ESLint 10; acessibilidade é requisito.                |
| Vite              | 8.x                                           | Build e dev server.                                                                                                       |
| React / React DOM | 19.x                                          | —                                                                                                                         |
| React Router      | 8.x (pacote `react-router`)                   | Data router (`createBrowserRouter`).                                                                                      |
| Tailwind CSS      | 4.x via `@tailwindcss/vite`                   | Configuração CSS-first (`@theme`), sem `tailwind.config.js`.                                                              |
| shadcn/ui         | componentes copiados para `src/components/ui` | Base `radix-ui` (pacote unificado). `components.json` permite usar a CLI do shadcn para novos componentes.                |
| Vitest            | 5.x + jsdom                                   | Mesmo pipeline de transformação do Vite.                                                                                  |
| decimal.js        | 10.x                                          | Precisão monetária (ADR 0003).                                                                                            |

### Dependências adiadas (instaladas quando houver uso real)

- **Recharts** — Fase 3 (gráficos do dashboard).
- **Dexie** (IndexedDB) — Fase 3/4 (persistência de demonstração).
- **Playwright** — instalado na Fase 2 (E2E de autenticação e navegação).
- Geração de PDF — Fase 8 (biblioteca a definir conforme necessidade dos relatórios).

## Consequências

- Atualizar para TS 7 / ESLint 10 quando o ecossistema de plugins suportar;
  revisar este ADR nesse momento.
