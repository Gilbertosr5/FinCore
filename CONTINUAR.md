# Como continuar o FinCore (guia para um novo chat)

> Leia este arquivo inteiro antes de qualquer alteração. Ele resume tudo o que
> um assistente sem histórico precisa saber para dar prosseguimento ao projeto.
> Atualize a seção **Estado atual** ao final de cada fase.

## 1. O que é

**FinCore** — aplicação web de gestão financeira pessoal (React + TypeScript),
desenvolvida em **9 fases** a partir de um "prompt mestre" do usuário. O usuário
escreve em **português do Brasil**; responda sempre em pt-BR.

- Código: `C:\Users\gilberto.ribeiro\Documents\Gil\FinProject\fincore`
- Requisitos completos das fases restantes: [`docs/ROADMAP.md`](./docs/ROADMAP.md)
- O que já foi entregue, testes e problemas conhecidos: [`PROJECT_STATUS.md`](./PROJECT_STATUS.md)
- **Todas as pendências acumuladas** (fases restantes, itens adiados, backend, decisões a confirmar): [`PENDENCIAS.md`](./PENDENCIAS.md)
- Prompt pronto para abrir uma nova sessão: [`docs/PROMPT_NOVA_SESSAO.md`](./docs/PROMPT_NOVA_SESSAO.md)
- Decisões arquiteturais: [`docs/adr/`](./docs/adr/) (0001–0013)
- Contratos HTTP com o backend futuro: [`docs/api-contract.md`](./docs/api-contract.md),
  [`docs/auth-contract.md`](./docs/auth-contract.md)

## 2. Estado atual

| Fase | Descrição                                                             | Status                                                                                        |
| ---- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 1–4  | Fundação, autenticação/layout, dashboard, gestão financeira           | ✅ (commits "Fase 1 e Fase 2", "Fase 3", "Fase 4")                                            |
| 5–7  | Cartões e orçamentos; metas e planejamento; investimentos             | ✅ concluídas em 11/11/2026 — **não commitadas** (junto com a Fase 8)                         |
| 8    | Calendário e relatórios (eventos derivados, 11 relatórios, CSV e PDF) | ✅ concluída em 11/11/2026 — **não commitada** (o usuário faz o commit; confira `git status`) |
| 9    | Finalização e qualidade                                               | ⏳ **próxima**                                                                                |

Última verificação completa: `npm run check` (508 testes), `npm run build` e
`npm run test:e2e` (39 aprovados, 1 ignorado de propósito) — tudo verde.
Detalhes do que existe: [`PROJECT_STATUS.md`](./PROJECT_STATUS.md).

### Fase 9 — roteiro sugerido (Finalização e qualidade)

Requisitos em [`docs/ROADMAP.md`](./docs/ROADMAP.md#fase-9--finalização-e-qualidade) e
pendências técnicas em [`PENDENCIAS.md`](./PENDENCIAS.md). Todos os módulos estão
entregues; a fase é de **revisão**, não de funcionalidades novas grandes.

- [ ] **Acessibilidade**: auditoria (axe/Lighthouse) em todas as rotas, desktop e celular,
      temas claro e escuro; navegação por teclado (grade do calendário, menus, diálogos);
      contraste dos tons de alerta; foco após fechar diálogos
- [ ] **Performance**: carregar o seed de demonstração e o dashboard sob demanda (chunk
      `App` ~339 kB); medir com o build de produção; memoização dos cálculos pesados
      (relatórios com 5 anos, carteira); revisar consultas que leem tudo
- [ ] **Segurança**: revisar CSP/headers do build, `npm audit` (dev), dados no IndexedDB,
      exportações (injeção em CSV já tratada), mensagens de erro
- [ ] **Tratamento de erros**: estados de erro/repetição em todas as telas; erros de
      gravação no IndexedDB; testes dos adaptadores REST (fake HTTP)
- [ ] **Pendências pequenas** de `PENDENCIAS.md` que cabem na fase (ex.: busca global com
      entidades, breadcrumbs gerais, Configurações: moeda/formato de data/fuso/exportar dados)
- [ ] **E2E**: revisar a suíte (fluxos ponta a ponta por módulo), estabilidade e tempo
- [ ] **Documentação final**: README, guia de arquitetura, contratos, ADR 0014; este arquivo

## 3. Como rodar

```bash
cd fincore
npm install
npm run dev          # http://localhost:5173
```

Login de demonstração (adaptador local, **não** é autenticação real):
**demo@fincore.dev / Demo@2026**. Dados de demonstração ficam no IndexedDB do
navegador e podem ser recriados em Configurações → Restaurar dados.

Navegador interno do app: `FinProject/.claude/launch.json` tem a configuração
`fincore-dev` (roda `npm run dev --prefix fincore`). Se o HMR ficar em estado
estranho após muitas edições, reinicie o servidor.

## 4. Portão de qualidade (obrigatório ao fim de cada fase)

```bash
npm run check        # typecheck + lint (0 avisos) + prettier + vitest
npm run build
npm run test:e2e     # Playwright desktop + mobile (1ª vez: npx playwright install chromium)
```

Depois: verificar no navegador (desktop, celular, tema claro/escuro), atualizar
`PROJECT_STATUS.md`, `PENDENCIAS.md` e este arquivo. Não commitar sem o usuário pedir (ele tem
feito os commits por conta própria, um por fase).

## 5. Arquitetura em 1 minuto

- **Feature-based + Clean Architecture** (`src/features/<feature>/{domain,application,infrastructure,presentation}`).
  Domínio não importa React/Axios/serviços (regra do ESLint). Componentes não fazem HTTP.
- Outras features e a camada `app` importam uma feature **pelo `index.ts`**
  (exceção: páginas lazy nas rotas). Domínio pode importar domínio de outra feature por caminho direto.
- **Composição** em `src/app/composition/create-data-layer.ts` (Demo × Api por
  `VITE_DATA_SOURCE`) e `src/app/providers/*Provider.tsx` (casos de uso por contexto).
- Estado de servidor no **TanStack Query**; estado de UI no **Zustand**.
- Repositórios: contrato no domínio; `Demo*Repository` (IndexedDB/Dexie) e
  `Api*Repository` (REST) validam registros com os **mesmos schemas Zod**.

## 6. Regras que não podem ser quebradas

- Dinheiro sempre com `Money` (`src/lib/money`, decimal.js, HALF_EVEN). Nunca `number` em cálculo.
- Datas de calendário com `IsoDate`/`MonthKey` (`src/lib/dates`), nunca `new Date('YYYY-MM-DD')`.
- Contabilização (ADR 0007): transferência, pagamento de fatura e aplicação em
  investimento **nunca** são receita/despesa; cancelados não afetam nada; compra no
  cartão não mexe em saldo de conta. Use `transaction-effects.ts`.
- TypeScript strict, sem `any`, sem `@ts-ignore`, sem desabilitar regras do ESLint.
- Cores só por tokens (`src/styles/globals.css`); gráficos usam a paleta validada `--chart-1..8`.
- localStorage só para preferências de UI; nada de senhas/tokens no navegador.
- Não deixar botões/formulários decorativos; não inventar endpoints como existentes (documentar contrato).

## 7. Versões fixadas de propósito (ADR 0002)

TypeScript **6.0** (typescript-eslint não suporta 7), ESLint **9** (jsx-a11y não
suporta 10), Vite 8, React 19, React Router 8, Tailwind 4, Vitest 5, Recharts 3, Dexie 4, Zod 4.

## 8. Armadilhas já encontradas (economizam tempo)

- **Testes e `R$`:** o Intl usa espaço não separável (U+00A0); o Testing Library
  normaliza o DOM para espaço comum. Nos testes, compare com `formatMoney(x).replace(/\s/g, ' ')`.
- **Não escreva NBSP literal em código** (ESLint `no-irregular-whitespace`); use `\s` ou `\u00A0`.
- **StrictMode + Dexie:** não feche o banco em cleanup de efeito (o StrictMode
  desmonta/remonta e o banco fica fechado — `DatabaseClosedError`).
- **React Router e redirecionamentos:** a navegação acontece em transição; a rota
  antiga continua montada. Limpar cache antes de navegar pode disparar o redirect
  do `ProtectedRoute` (por isso a tela de sessão expirada limpa o cache ao montar).
- **`npx eslint . --fix`** pode trocar `as Tipo` por `!` (non-null assertion, proibido)
  e remover casts "desnecessários"; revise depois.
- **Shell no Windows (Git Bash):** heredocs com aspas simples dentro de scripts
  `node -e` quebram com facilidade; prefira a ferramenta de escrita/edição de arquivos
  ou scripts `.cjs` no scratchpad.
- Rode `npx prettier --write src tests` após gerar arquivos.
- **Zod + React Hook Form:** `refine(isIsoDate)` (type guard) estreita o tipo de saída e quebra o `zodResolver`. Em schemas de formulário use `refine((v): boolean => isIsoDate(v), msg)` e converta com `asIsoDate`.
- **Select do Radix em testes (jsdom):** `tests/setup.ts` já tem polyfills de `hasPointerCapture`/`scrollIntoView`. Selecione com clique no campo (pelo rótulo) e depois `findByRole('option')`.
- **`FormField`** passa `id`/ARIA ao controle; não sobrescreva o `id` do `SelectTrigger` (o rótulo deixa de ser associado).
- **E2E no celular:** listas têm tabela (desktop, oculta) e cartões (celular); use `.filter({ visible: true })`.
- **Transações via UI:** formulários aparecem só após carregar contas e categorias — em testes, aguarde o primeiro campo com `findByLabelText`.
- Testes de integração usam `tests/helpers/render-app.tsx` (app completo em memória,
  `fake-indexeddb`, banco isolado por teste, hoje fixo `2026-11-06`).
- Testes de regras usam `tests/helpers/in-memory-ledger.ts`, `tests/helpers/in-memory-cards.ts`
  (livro + cartões + orçamentos em memória) e `tests/helpers/finance-fixtures.ts`.
- **Rotas `lazy` em testes de integração:** a navegação só conclui depois de carregar a
  página — use `await waitFor(() => expect(router.state.location.pathname)...)` e
  `findByRole` para o título (o `h1` do cabeçalho troca depois).
- **Botões habilitados só com dados carregados** (ex.: "Nova compra"): aguarde um texto
  da lista antes de clicar, senão o clique cai num botão desabilitado.
- **Cabeçalho:** `Header` recebe `userMenu` e `notifications` como slots; a central
  (`FinancialNotifications`) vem da feature dashboard e reutiliza o cache do mês atual.
  Com dados de demonstração há alertas — o estado vazio é testado no componente.
- **Rolagem em listas:** não use `scrollIntoView` para centralizar itens ao montar
  (rola a página inteira); ajuste `scrollLeft/scrollTop` do próprio contêiner
  (ver `InvoicePanel`).
- **Recharts no carregamento inicial:** o `AppLayout` importa `@/features/dashboard` (central de
  notificações) de forma imediata. Não reexporte componentes de gráfico por índices de
  feature: gráficos compartilhados ficam em `components/data-display` (ex.: `TrendChart`).
  Confira o tamanho do chunk `App` no `npm run build` (hoje ~381 kB).
- **Planejamento** não grava nada: `usePlanningSnapshot` lê os dados e as páginas
  calculam projeções com funções puras (`buildBalanceProjection` etc.) em `useMemo`.
  Memoize entradas derivadas (cenário, compra) para não precisar de `eslint-disable`.
- **Metas:** aportes com transferência usam `GoalTransferPort` (ligado em `DataProvider`
  aos casos de uso de lançamentos). `tests/helpers/in-memory-goals.ts` simula falha de
  gravação para testar a compensação.
- **Escapes de Unicode viram caracteres reais** ao gravar arquivos pelas ferramentas (NBSP, BOM,
  acentos combinantes) — o ESLint pega só alguns. Use `String.fromCharCode(0xa0)` e similares e
  rode a varredura de caracteres invisíveis (ver Fase 8 no `PROJECT_STATUS.md`).
- **Servidor de preview**: `preview_stop` + `preview_start` pode trocar a porta; outra sessão
  costuma ocupar a 5173. Se o navegador interno recusar a nova porta, reinicie de novo até
  voltar a uma porta já liberada. HMR com módulo "sem export" = reinicie o servidor.
- **Relatórios = tabela única** (`ReportTable`): tela, CSV e PDF vêm dela. Novos relatórios
  devem só produzir a tabela; nunca formatar exportação à parte.
- **Investimentos:** lançamentos de conta de aplicações/resgates/proventos são criados por
  `InvestmentLedgerCommands` (porta `InvestmentLedgerPort`); `tests/helpers/in-memory-investments.ts`
  simula falha para testar a compensação. Valor atual = última avaliação + operações
  posteriores pelo custo; operação anterior à avaliação devolve `revaluation` (a tela
  pede para confirmar o valor).
- **Console do navegador interno** acumula erros antigos de HMR: use `limit` baixo em
  `read_console_messages` e compare a contagem antes/depois de recarregar.
- **Scripts de edição:** heredocs com template strings/aspas quebram no Git Bash — grave
  o script `.cjs` no scratchpad com a ferramenta de escrita e execute com `node`.
- **Fatura aberta** = `getOpenInvoiceMonth(card, hoje)` (mês em que uma compra de hoje
  entraria). Pagamentos de fatura são transações `card_payment` — use os casos de uso de
  cartões, nunca os de Transações (que recusam editá-las).

## 9. Para retomar

Diga ao assistente: **"Leia `fincore/CONTINUAR.md` e inicie a Fase 9"** (ou a
próxima fase pendente). Ele deve:

1. ler este arquivo, `PENDENCIAS.md`, `docs/ROADMAP.md` e `PROJECT_STATUS.md`;
2. rodar `git status` e `npm run check` para confirmar a base;
3. seguir o checklist da fase atual;
4. fechar com o portão de qualidade e atualizar a documentação.
