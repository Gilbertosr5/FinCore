# FinCore

Plataforma de gestão financeira pessoal — receitas, despesas, contas, cartões de
crédito, orçamentos, metas, investimentos, planejamento e relatórios — com foco
em **precisão financeira**, **arquitetura evolutiva** e **experiência premium**.

> **Status:** em desenvolvimento por fases. Consulte [`PROJECT_STATUS.md`](./PROJECT_STATUS.md)
> para o que já está implementado. O backend (Java + Spring Boot + PostgreSQL)
> será desenvolvido futuramente; hoje a aplicação roda com dados de demonstração.

## Objetivo

Oferecer uma visão completa e confiável da vida financeira, permitindo planejar,
acompanhar e tomar decisões baseadas em dados. O frontend nasce preparado para
consumir uma API REST, integrar instituições financeiras e receber novos módulos
sem reestruturação.

## Funcionalidades (roadmap)

| Fase | Entrega                                                                      | Status       |
| ---- | ---------------------------------------------------------------------------- | ------------ |
| 1    | Fundação arquitetural, design tokens, qualidade, núcleo monetário e de datas | ✅ Concluída |
| 2    | Autenticação (adaptadores dev/REST), rotas protegidas, layout completo       | ✅ Concluída |
| 3    | Dashboard com indicadores e gráficos                                         | ⏳           |
| 4    | Receitas, despesas, contas, transferências, recorrências, parcelamentos      | ⏳           |
| 5    | Cartões, faturas, orçamentos e alertas                                       | ⏳           |
| 6    | Metas e planejamento financeiro                                              | ⏳           |
| 7    | Investimentos                                                                | ⏳           |
| 8    | Calendário e relatórios (PDF/CSV)                                            | ⏳           |
| 9    | Qualidade final: acessibilidade, performance, segurança                      | ⏳           |

## Stack tecnológica

React 19 · TypeScript 6 (strict) · Vite 8 · React Router 8 · TanStack Query 5 ·
Zustand 5 · React Hook Form + Zod 4 · Tailwind CSS 4 · shadcn/ui (Radix) ·
Lucide · Axios · date-fns 4 · decimal.js · Vitest 5 + Testing Library ·
Playwright · ESLint 9 + Prettier.

Recharts e Dexie (IndexedDB) entram nas fases em que são usados.
Justificativas de versão em [ADR 0002](./docs/adr/0002-stack-e-versoes.md).

## Arquitetura

Feature-Based + Clean Architecture pragmática
([ADR 0001](./docs/adr/0001-arquitetura-feature-based-clean.md)):

```
Presentation (páginas, componentes, hooks de query)
      │ usa
Application (casos de uso)
      │ usa
Domain (entidades, regras puras, contratos de repositório)
      ▲ implementa
Infrastructure (Mock*Repository / Api*Repository, mappers)
```

- O domínio não depende de React, Axios ou infraestrutura (verificado pelo ESLint).
- Componentes não acessam HTTP diretamente (verificado pelo ESLint).
- Dados de servidor no TanStack Query; estado de interface no Zustand.

### Estrutura de pastas

```
fincore/
├── docs/                  # ADRs e contrato HTTP
├── public/
├── src/
│   ├── app/
│   │   ├── config/        # validação das variáveis de ambiente (Zod)
│   │   ├── layout/        # AppLayout (shell autenticado)
│   │   ├── providers/     # Theme, Query, Auth e composição de providers
│   │   └── router/        # rotas, ProtectedRoute, GuestRoute
│   ├── components/
│   │   ├── ui/            # design system (padrão shadcn/ui)
│   │   ├── layout/        # Sidebar, Header, busca global, notificações
│   │   └── feedback/      # loaders, erros, telas de status
│   ├── constants/         # rotas, navegação, chaves de storage
│   ├── features/
│   │   ├── auth/          # domain / application / infrastructure / presentation
│   │   └── settings/      # configurações do usuário
│   ├── hooks/
│   ├── lib/
│   │   ├── money/         # value object Money (decimal.js) + formatação BRL
│   │   ├── dates/         # IsoDate: datas de calendário sem bugs de fuso
│   │   ├── errors/        # DomainError e mensagens seguras para o usuário
│   │   ├── forms/         # integração de erros da API com formulários
│   │   └── query-client.ts
│   ├── services/
│   │   ├── api/           # cliente HTTP (Axios), refresh de sessão, erros
│   │   └── auth/          # eventos de sessão
│   ├── stores/            # Zustand (tema, interface)
│   ├── styles/            # globals.css com design tokens
│   ├── App.tsx
│   └── main.tsx
└── tests/
    ├── setup.ts
    ├── helpers/
    ├── integration/
    └── e2e/               # Playwright
```

## Requisitos

- Node.js **22.12+** (testado com Node 24)
- npm 10+

## Instalação e execução

```bash
npm install
```

```bash
cp .env.example .env.local
```

```bash
npm run dev
```

A aplicação abre em `http://localhost:5173`. Com o adaptador de desenvolvimento
(padrão local), entre com a conta de demonstração **demo@fincore.dev / Demo@2026**
— a tela de login oferece um botão para preenchê-la.

## Variáveis de ambiente

| Variável                | Padrão                                       | Descrição                                                                   |
| ----------------------- | -------------------------------------------- | --------------------------------------------------------------------------- |
| `VITE_APP_NAME`         | `FinCore`                                    | Nome exibido na interface                                                   |
| `VITE_DATA_SOURCE`      | `mock`                                       | `mock` (IndexedDB de demonstração) ou `api` (REST)                          |
| `VITE_AUTH_ADAPTER`     | `dev` em desenvolvimento, `rest` em produção | Adaptador de autenticação                                                   |
| `VITE_API_BASE_URL`     | `http://localhost:8080/api/v1`               | URL base da API REST                                                        |
| `VITE_API_TIMEOUT_MS`   | `15000`                                      | Timeout HTTP (1.000–120.000 ms)                                             |
| `VITE_DEFAULT_TIMEZONE` | `America/Sao_Paulo`                          | Fuso IANA padrão                                                            |
| `VITE_DEMO_MODE`        | `false`                                      | Permite autenticação de desenvolvimento em build de produção (demonstração) |

Todas são validadas na inicialização; valores inválidos exibem uma tela de erro
de configuração. Variáveis `VITE_*` são públicas — nunca coloque segredos.

## Scripts

| Script                            | Descrição                                                    |
| --------------------------------- | ------------------------------------------------------------ |
| `npm run dev`                     | Servidor de desenvolvimento                                  |
| `npm run build`                   | Typecheck + build de produção em `dist/`                     |
| `npm run build:demo`              | Build de demonstração (`.env.demo`: auth e dados simulados)  |
| `npm run preview`                 | Serve o build de produção localmente                         |
| `npm run typecheck`               | Verificação de tipos (app e arquivos de configuração)        |
| `npm run lint`                    | ESLint (zero avisos tolerados)                               |
| `npm run lint:fix`                | ESLint com correção automática                               |
| `npm run format` / `format:check` | Prettier                                                     |
| `npm test`                        | Testes unitários e de integração (Vitest)                    |
| `npm run test:watch`              | Vitest em modo observação                                    |
| `npm run test:e2e`                | Playwright (desktop + mobile) contra o build de demonstração |
| `npm run check`                   | Typecheck + lint + formatação + testes                       |

## Testes

- **Unitários** junto ao código (`*.test.ts`): `Money`, formatação/parse BRL,
  datas (bissextos, virada de mês, fuso), configuração, erros HTTP, refresh de sessão,
  política de retry, regras de credenciais, casos de uso e adaptadores de autenticação,
  proteção contra open redirect.
- **Integração** em `tests/integration`: app completa em memória — rotas protegidas,
  login, cadastro, logout, sessão expirada, recuperação/redefinição e alteração de
  senha, navegação, busca global, tema e sidebar.
- **E2E** em `tests/e2e` (Playwright, Chromium desktop e Pixel 7). Na primeira vez:
  `npx playwright install chromium`.

Os testes rodam com `TZ=America/Sao_Paulo` fixo.

## Build de produção

```bash
npm run build
```

```bash
npm run preview
```

Em produção, `VITE_AUTH_ADAPTER=dev` é bloqueado (exceto com `VITE_DEMO_MODE=true`).

## Estratégia de persistência

- **Desenvolvimento/demonstração:** IndexedDB (Dexie) com seed determinístico e
  restaurável, a partir das Fases 3/4. Dados claramente identificados como demonstração.
- **Produção:** API REST. Os repositórios `Api*Repository` implementam os mesmos
  contratos dos `Mock*Repository`; a escolha é feita por `VITE_DATA_SOURCE`.
- `localStorage` guarda apenas preferências de interface (tema, sidebar).

## Estratégia de autenticação

Abstração independente de provedor: contrato `AuthRepository`, casos de uso
(`LoginUseCase`, `RegisterUseCase`, `LogoutUseCase`, `GetCurrentUserUseCase`,
`RecoverPasswordUseCase`, `ResetPasswordUseCase`, `ChangePasswordUseCase`) e dois
adaptadores:

- **Desenvolvimento** (`VITE_AUTH_ADAPTER=dev`): simulação local, sinalizada na
  interface, **não é autenticação real**; senhas nunca são persistidas.
- **REST** (`VITE_AUTH_ADAPTER=rest`): sessão por cookie **HttpOnly, Secure,
  SameSite** emitido pelo backend, renovação automática única em `401` e tela de
  sessão expirada. O frontend não armazena tokens.

Contrato HTTP em [`docs/auth-contract.md`](./docs/auth-contract.md); decisões em
[ADR 0005](./docs/adr/0005-seguranca-sessao-e-configuracao.md) e
[ADR 0006](./docs/adr/0006-autenticacao-e-rotas.md).

## Integração futura com o backend

Convenções de payload, valores monetários, datas, CSRF e formato de erro
(RFC 9457 / `ProblemDetail` do Spring Boot) em [`docs/api-contract.md`](./docs/api-contract.md).
Endpoints de autenticação em [`docs/auth-contract.md`](./docs/auth-contract.md).
Nenhum endpoint de produção existe ainda; os contratos de cada módulo são
documentados nas respectivas fases.

## Convenções de desenvolvimento

- TypeScript strict, sem `any`; `@ts-ignore` proibido (`@ts-expect-error` apenas com descrição).
- Imports com alias `@/`, ordenados automaticamente; sem dependências circulares.
- Cores somente via tokens semânticos (`src/styles/globals.css`) — nada de hex em componentes.
- Valores monetários sempre com `Money`; datas de calendário sempre com `IsoDate`.
- Rotas em `src/constants/routes.ts`; nunca URLs literais em componentes.
- Mutações nunca têm retry automático (evita lançamentos duplicados).
- Outras features e a camada `app` importam uma feature somente pelo seu `index.ts`
  (exceção: páginas carregadas sob demanda nas rotas, para code splitting).
- Rode `npm run check` antes de cada commit.

## Decisões arquiteturais (ADRs)

- [0001 — Arquitetura Feature-Based + Clean Architecture](./docs/adr/0001-arquitetura-feature-based-clean.md)
- [0002 — Stack e compatibilidade de versões](./docs/adr/0002-stack-e-versoes.md)
- [0003 — Precisão monetária](./docs/adr/0003-precisao-monetaria.md)
- [0004 — Datas de calendário e fuso horário](./docs/adr/0004-datas-e-fuso-horario.md)
- [0005 — Sessão, armazenamento e configuração](./docs/adr/0005-seguranca-sessao-e-configuracao.md)
- [0006 — Autenticação independente de provedor e proteção de rotas](./docs/adr/0006-autenticacao-e-rotas.md)
