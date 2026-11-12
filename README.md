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
| 3    | Dashboard com indicadores e gráficos                                         | ✅ Concluída |
| 4    | Receitas, despesas, contas, transferências, recorrências, parcelamentos      | ✅ Concluída |
| 5    | Cartões, faturas, orçamentos e alertas                                       | ⏳           |
| 6    | Metas e planejamento financeiro                                              | ⏳           |
| 7    | Investimentos                                                                | ⏳           |
| 8    | Calendário e relatórios (PDF/CSV)                                            | ⏳           |
| 9    | Qualidade final: acessibilidade, performance, segurança                      | ⏳           |

## Stack tecnológica

React 19 · TypeScript 6 (strict) · Vite 8 · React Router 8 · TanStack Query 5 ·
Zustand 5 · React Hook Form + Zod 4 · Tailwind CSS 4 · shadcn/ui (Radix) ·
Lucide · Axios · date-fns 4 · decimal.js · Recharts 3 · Dexie 4 (IndexedDB) ·
Vitest 5 + Testing Library · Playwright · ESLint 9 + Prettier.

Biblioteca de PDF entra na Fase 8.
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
│   │   ├── composition/   # escolha mock × API de todos os repositórios
│   │   ├── config/        # validação das variáveis de ambiente (Zod)
│   │   ├── demo-data/     # seed determinístico de demonstração
│   │   ├── layout/        # AppLayout (shell autenticado)
│   │   ├── providers/     # Theme, Query, Auth, Data e composição de providers
│   │   └── router/        # rotas, ProtectedRoute, GuestRoute
│   ├── components/
│   │   ├── ui/            # design system (padrão shadcn/ui)
│   │   ├── layout/        # Sidebar, Header, busca global, notificações
│   │   ├── data-display/  # cartões de indicador, gráficos (moldura + tabela), progresso
│   │   └── feedback/      # loaders, erros, telas de status
│   ├── constants/         # rotas, navegação, chaves de storage
│   ├── features/
│   │   ├── auth/          # domain / application / infrastructure / presentation
│   │   ├── accounts/      # contas, saldos, extrato (CRUD e arquivamento)
│   │   ├── transactions/  # lançamentos, transferências, parcelas, recorrências, categorias
│   │   ├── history/       # histórico de alterações (auditoria funcional)
│   │   ├── credit-cards/  # cartões, parcelas e faturas
│   │   ├── budgets/       # orçamentos e consumo
│   │   ├── goals/         # metas e progresso
│   │   ├── investments/   # carteira e avaliações
│   │   ├── dashboard/     # agregação, período, alertas e tela
│   │   └── settings/      # configurações do usuário
│   ├── hooks/
│   ├── lib/
│   │   ├── money/         # value object Money (decimal.js) + formatação BRL
│   │   ├── dates/         # IsoDate: datas de calendário sem bugs de fuso
│   │   ├── errors/        # DomainError e mensagens seguras para o usuário
│   │   ├── forms/         # integração de erros da API com formulários
│   │   ├── schemas/       # campos e validação de registros/DTOs (Zod)
│   │   └── query-client.ts
│   ├── services/
│   │   ├── api/           # cliente HTTP (Axios), refresh de sessão, erros
│   │   ├── auth/          # eventos de sessão
│   │   └── storage/       # IndexedDB de demonstração (Dexie)
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
  proteção contra open redirect; regras financeiras (efeitos de cada tipo de
  movimentação, saldos, transferências, faturas, parcelamento, pagamento de fatura,
  orçamentos, metas, carteira, períodos), agregação do dashboard em cenário
  calculado à mão, seed (determinismo, coerência, contas nunca negativas) e IndexedDB.
- **Integração** em `tests/integration`: app completa em memória — rotas protegidas,
  login, cadastro, logout, sessão expirada, recuperação/redefinição e alteração de
  senha, navegação, busca global, tema, sidebar, dashboard (valores exibidos =
  caso de uso, filtros, URL, visão em tabela), restauração dos dados de demonstração,
  criação/edição/pagamento/exclusão de lançamentos, parcelamento, transferências,
  contas, extrato e categorias.
- **Regras de lançamentos** com repositórios em memória (`tests/helpers/in-memory-ledger.ts`):
  recorrências (todas as frequências, idempotência, exceções, encerramento), parcelas,
  transferências, situações, listagem/filtros/paginação, categorias, contas e extrato.
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

## Lançamentos e contas

- **Transações** (`/transacoes`): receitas, despesas e transferências com filtros na
  URL (mês, tipo, situação, categoria, conta, busca sem acentos, ordenação, página),
  totais do filtro, tabela no desktop e cartões no celular. Ações: editar, duplicar,
  marcar como pago/recebido, desfazer, cancelar, reativar e excluir — em séries, com
  escolha "somente este" ou "este e os próximos". Detalhes com histórico de alterações.
- **Repetição**: parcelado (valor total dividido sem perder centavos) ou recorrente
  (diária a anual, com data final opcional; ocorrências geradas automaticamente até
  o fim do mês seguinte, sem duplicar).
- **Contas** (`/contas`): saldos, a pagar/receber, saldo previsto, saldo negativo
  destacado, criar/editar/arquivar, transferir e **extrato** (`/contas/:id`) com
  saldo acumulado.
- **Categorias** personalizadas em Configurações.
- Regras: [ADR 0009](./docs/adr/0009-escrita-recorrencias-e-historico.md).

## Dashboard

Indicadores (patrimônio líquido, saldo, receitas, despesas, resultado, taxa de
economia, total investido e comprometido em faturas), gráficos (receitas x
despesas, despesas por categoria, evolução do patrimônio, do saldo e dos
investimentos, distribuição patrimonial), últimas movimentações, próximas contas
e faturas, orçamentos próximos do limite, metas e alertas. Filtros: mês atual,
30 e 90 dias, ano atual e período personalizado (guardados na URL). Todos os
valores são calculados a partir dos dados — regras em
[ADR 0007](./docs/adr/0007-regras-financeiras-e-contabilizacao.md). Cada gráfico
tem legenda, resumo para leitores de tela e visão em tabela.

## Estratégia de persistência

- **Demonstração (`VITE_DATA_SOURCE=mock`):** IndexedDB (Dexie) com seed
  determinístico de 12 meses (contas, receitas, despesas, cartões com compras
  parceladas, faturas, orçamentos, metas e investimentos), gerado na primeira
  carga e restaurável em **Configurações → Restaurar dados**. A interface
  identifica os dados como demonstração.
- **Produção (`VITE_DATA_SOURCE=api`):** API REST. Os `Api*Repository` implementam
  os mesmos contratos dos `Demo*Repository` e validam as respostas com os mesmos
  schemas. Ver [ADR 0008](./docs/adr/0008-persistencia-de-demonstracao.md).
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
- [0007 — Modelo financeiro e regras de contabilização](./docs/adr/0007-regras-financeiras-e-contabilizacao.md)
- [0008 — Repositórios, IndexedDB de demonstração e seed](./docs/adr/0008-persistencia-de-demonstracao.md)
- [0009 — Escrita de lançamentos, recorrências e histórico](./docs/adr/0009-escrita-recorrencias-e-historico.md)
