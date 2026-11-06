# FinCore — Status do Projeto

_Última atualização: 05/11/2026 — Fase 2 concluída._

## Fases

| Fase | Descrição               | Status       |
| ---- | ----------------------- | ------------ |
| 1    | Fundação arquitetural   | ✅ Concluída |
| 2    | Autenticação e layout   | ✅ Concluída |
| 3    | Dashboard               | ⏳ Próxima   |
| 4    | Gestão financeira       | —            |
| 5    | Cartões e orçamentos    | —            |
| 6    | Metas e planejamento    | —            |
| 7    | Investimentos           | —            |
| 8    | Calendário e relatórios | —            |
| 9    | Finalização e qualidade | —            |

## Fase 2 — Implementado

**Feature `auth` (Clean Architecture completa)**

- Domínio: `User`, `AuthError` (códigos estáveis, mensagens pt-BR), regras de
  credenciais (política de senha, e-mail, nome) e contrato `AuthRepository`.
- Aplicação: `LoginUseCase`, `RegisterUseCase`, `LogoutUseCase`,
  `GetCurrentUserUseCase`, `RecoverPasswordUseCase`, `ResetPasswordUseCase`,
  `ChangePasswordUseCase` — validam e normalizam dados antes do repositório.
- Infraestrutura:
  - `DevAuthRepository` — adaptador de desenvolvimento, sinalizado na interface,
    sem persistir senhas (contas em memória; marcador de sessão sem token em
    `sessionStorage`, TTL 8 h); tokens de redefinição de uso único (30 min).
  - `ApiAuthRepository` — adaptador REST com validação do DTO (Zod) e mapeamento
    de erros HTTP para erros de domínio.
  - Contrato HTTP documentado em `docs/auth-contract.md`.
- Apresentação: telas de **login**, **cadastro**, **recuperação de senha**,
  **redefinição de senha**, **sessão expirada** e **acesso não autorizado**;
  formulários com React Hook Form + Zod reutilizando as regras do domínio.

**Sessão e rotas**

- `AuthProvider` (composição por configuração, injetável em testes); usuário atual
  no TanStack Query.
- `ProtectedRoute` (com estado de erro e "tentar novamente"), `GuestRoute`,
  rotas públicas; redirecionamento pós-login com proteção contra open redirect.
- Cliente HTTP: renovação de sessão única e compartilhada em `401`, repetição da
  requisição original, evento de sessão expirada; endpoints públicos isentos.
- Logout, expiração e redefinição de senha limpam todo o cache de dados.
- Code splitting por rota (`lazy`) para as páginas de autenticação e configurações.

**Layout**

- Header: título, busca global (Ctrl/⌘+K, navegação por teclado, busca sem acentos),
  central de notificações (estado vazio até existirem alertas), selo de modo
  demonstração, alternância de tema e menu do usuário (configurações, sair).
- Sidebar recolhível no desktop; gaveta acessível (Radix Dialog: foco preso, Esc,
  overlay) no celular/tablet.
- `AppLayout` movido para `src/app/layout` (a camada `app` compõe features e
  componentes; `components/` não depende de features).

**Configurações (parcial)**

- Perfil (somente leitura), aparência (escuro/claro/sistema), alteração de senha,
  encerrar sessão. Itens dependentes de fases futuras listados como "Em breve".

**Componentes compartilhados**

- `Input`, `PasswordInput`, `Label`, `FormField` (rótulo/descrição/erro com ARIA),
  `Alert`, `Dialog`, `Sheet`, `DropdownMenu`, `Popover`, `RadioGroup`, `Spinner`,
  `EmptyState`, `FullPageLoader`.
- `DomainError` + `getErrorMessage` (mensagens seguras) e `applyApiFieldErrors`
  (erros 422 por campo nos formulários).

**Ferramentas**

- Playwright configurado (desktop + Pixel 7) contra o build de demonstração.
- Scripts `build:demo` (`.env.demo`) e `test:e2e`. Removido `test:coverage`
  (dependia de pacote não instalado).
- Fonte: pilha de fontes do sistema (decisão da pendência da Fase 1).

## Fase 1 — Implementado (resumo)

Vite + React + TypeScript strict, ESLint (com fronteiras arquiteturais),
Prettier, Tailwind 4 com design tokens (escuro/claro), shadcn/ui, providers,
roteamento, `Money` (decimal.js, HALF_EVEN, alocação sem perda de centavos),
`IsoDate` (datas sem bugs de fuso), configuração de ambiente validada, cliente
HTTP com erros normalizados (RFC 9457), ADRs 0001–0005.

## Testes executados (Fase 2)

| Verificação                     | Resultado                                                                  |
| ------------------------------- | -------------------------------------------------------------------------- |
| `npm run typecheck`             | ✅ sem erros                                                               |
| `npm run lint`                  | ✅ 0 erros, 0 avisos                                                       |
| `npm run format:check`          | ✅                                                                         |
| `npm test`                      | ✅ 15 arquivos, 215 testes (unitários + integração)                        |
| `npm run test:e2e`              | ✅ 13 aprovados, 1 ignorado de propósito (atalho de teclado no mobile)     |
| `npm run build`                 | ✅                                                                         |
| Verificação manual no navegador | ✅ login demo, redirecionamento ao destino, menu do usuário, configurações |

Novas suítes: `credentials.rules`, `auth.use-cases`, `dev-auth.repository`,
`api-auth.repository`, `safe-redirect`, `http-client` (refresh de sessão),
`filter-navigation`, `tests/integration/auth-flow`, `tests/e2e/auth.spec`.

## Funcionalidades pendentes

- **Fase 3 — Dashboard:** persistência de demonstração (IndexedDB/Dexie) com seed
  determinístico, repositórios mock/API, indicadores, gráficos (Recharts), filtros
  de período, últimas movimentações, vencimentos e alertas.
- Configurações: moeda, formato de data, fuso, categorias, notificações,
  exportação de dados, exclusão de conta, histórico de sessões.
- Breadcrumbs: serão exibidos quando existirem rotas aninhadas (ex.: detalhe de conta).
- Notificações: alimentadas pelos alertas das Fases 3 e 5; push depende do backend.

## Problemas conhecidos

- Nenhum problema crítico.
- Contas criadas no adaptador de desenvolvimento somem ao recarregar a página
  (decisão deliberada: nenhuma senha é guardada no navegador). Use a conta demo.
- O chunk compartilhado de formulários (Zod + React Hook Form) tem ~60 kB gzip;
  aceitável, reavaliar na Fase 9.

## Decisões arquiteturais

- ADR 0001–0005 (Fase 1).
- **ADR 0006** — autenticação independente de provedor, proteção de rotas,
  redirecionamento seguro e tratamento de expiração de sessão (incluindo a ordem
  navegação → limpeza de cache, necessária pelas transições do React Router).
- Contrato HTTP de autenticação: `docs/auth-contract.md`.

## Próximas etapas

Iniciar a **Fase 3 — Dashboard**.
