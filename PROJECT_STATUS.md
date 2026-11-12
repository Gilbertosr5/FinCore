# FinCore — Status do Projeto

_Última atualização: 12/11/2026 — integração com o backend finalizada e validada (ADR 0015)._

> Para retomar em um novo chat, leia [`CONTINUAR.md`](./CONTINUAR.md). Pendências consolidadas: [`PENDENCIAS.md`](./PENDENCIAS.md).

## Fases

| Fase | Descrição               | Status       |
| ---- | ----------------------- | ------------ |
| 1    | Fundação arquitetural   | ✅ Concluída |
| 2    | Autenticação e layout   | ✅ Concluída |
| 3    | Dashboard               | ✅ Concluída |
| 4    | Gestão financeira       | ✅ Concluída |
| 5    | Cartões e orçamentos    | ✅ Concluída |
| 6    | Metas e planejamento    | ✅ Concluída |
| 7    | Investimentos           | ✅ Concluída |
| 8    | Calendário e relatórios | ✅ Concluída |
| 9    | Finalização e qualidade | ✅ Concluída |

## Integração com o backend — finalizada (12/11/2026)

Decisões em [ADR 0015](./docs/adr/0015-integracao-com-o-backend.md). Backend em
[`../fincore-api`](../fincore-api/README.md).

**Implementado**

- Backend: validação do pagamento de fatura (`CARD_PAYMENT_EXCEEDS_OUTSTANDING`,
  `INVOICE_NOT_OPEN`, `INVOICE_NOT_PAYABLE`, `CARD_PAYMENT_FUTURE_DATE`) com o cálculo de
  faturas portado do front; resgate acima do valor da posição (`MOVEMENT_EXCEEDS_POSITION`).
- Gravações atômicas: `PUT /goals/contributions/{id}` com as pernas da transferência e
  `PUT /investments/movements/{id}` com o lançamento; os `DELETE` removem os vinculados.
  No front, as portas só preparam os lançamentos e o repositório grava tudo de uma vez (uma
  requisição na API; uma transação do IndexedDB na demonstração). A compensação no cliente
  deixou de existir.
- Testes dos adaptadores REST com HTTP falso e E2E do modo API (`npm run test:e2e:api`).
- Correção: valor monetário inválido numa resposta da API gerava `TypeError` em vez de
  `DataIntegrityError` (`moneyField` com `abort: true`).

**Verificação (12/11/2026)**

| Portão                                   | Resultado                                                   |
| ---------------------------------------- | ----------------------------------------------------------- |
| `fincore`: `npm run check`               | ✅ 49 arquivos, 530 testes (13 novos de adaptadores REST)   |
| `fincore`: `npm run build`               | ✅ chunk `App` 214 kB (63 kB gzip)                          |
| `fincore`: `npm run test:e2e`            | ✅ 51 passaram, 1 ignorado de propósito (Ctrl+K no celular) |
| `fincore`: `npm run test:e2e:api`        | ✅ 14 (7 fluxos × desktop/celular) contra API + PGlite      |
| `fincore-api`: `npm run check` + `build` | ✅ 6 arquivos, 46 testes (8 novos em `integrity.test.ts`)   |

**Navegador interno contra a API** (`fincore-api` + `npm run dev:api`): cadastro e dashboard
(escuro, desktop); aporte em meta **com transferência** — um único `PUT`, nenhuma chamada
a `/transactions/batch`, as duas pernas criadas — e exclusão do aporte removendo as pernas;
cartões (claro, celular) com limite, fatura aberta e a pagar; aporte em CDB debitando a
conta — movimentação e lançamento vinculados numa só gravação. Console: só os `401`
esperados antes do login e o `501` dos indicadores de mercado; servidor sem erros.

## Fase 9 — Implementado

Decisões em [ADR 0014](./docs/adr/0014-qualidade-acessibilidade-performance-seguranca.md);
segurança do front e headers do servidor em [`docs/seguranca.md`](./docs/seguranca.md).

**Acessibilidade**

- Auditoria axe-core (WCAG 2.1 A/AA) no E2E: rotas públicas e 15 rotas autenticadas,
  temas claro e escuro, desktop e celular — 0 violações.
- Tokens de cor ajustados para contraste AA (primária, texto secundário, sucesso, atenção,
  erro); no tema escuro a primária é violeta claro com texto escuro.
- Tabelas largas viram região rolável nomeada e focável (teclado).

**Performance**: gerador do seed e Dexie sob demanda — chunk `App` 339 kB → 231 kB
(66 kB gzip); no modo API não são baixados.

**Segurança**: CSP por meta tag no build (`build/csp-plugin.ts`; script de tema por hash,
sem `'unsafe-inline'` em scripts; `connect-src` com a origem da API) e
`Referrer-Policy`; `npm audit --omit=dev`: 0.

**Tratamento de erros**: mensagens orientativas para cota/indisponibilidade/bloqueio do
IndexedDB e para falha ao carregar módulos (tela "Atualização necessária").

**Pendências fechadas**: busca global (Ctrl+K) com contas, cartões, metas, ativos,
orçamentos e lançamentos recentes (feature `search`); exportação de todos os dados em
JSON (Configurações → Seus dados).

## Testes executados (Fase 9)

| Verificação                     | Resultado                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------ |
| `npm run typecheck`             | ✅ sem erros                                                                   |
| `npm run lint`                  | ✅ 0 erros, 0 avisos                                                           |
| `npm run format:check`          | ✅                                                                             |
| `npm test`                      | ✅ 48 arquivos, 517 testes                                                     |
| `npm run test:e2e`              | ✅ 51 aprovados, 1 ignorado de propósito (atalho de teclado no mobile)         |
| `npm run build`                 | ✅ `App` 230,8 kB (66,4 kB gzip); seed, Dexie e jsPDF sob demanda; CSP no HTML |
| Verificação manual no navegador | ✅ dashboard (escuro), busca Ctrl+K, cartões (claro), celular                  |

Novas suítes: `tests/e2e/accessibility.spec` (axe), `tests/e2e/security.spec` (CSP),
`search-entities`, mensagens de erro de armazenamento/carregamento e testes de
integração da busca e da exportação.

## Funcionalidades pendentes

- Todas as 9 fases do plano estão entregues; o que sobrou está em `PENDENCIAS.md`.
- Anexos em lançamentos (depende de armazenamento de arquivos no backend).
- Configurações: moeda, formato de data, fuso, notificações, exclusão da conta.
- Detalhes em [`PENDENCIAS.md`](./PENDENCIAS.md).

## Problemas conhecidos

- Nenhum problema crítico.
- O seed é relativo à data em que foi gerado; as recorrências avançam sozinhas,
  mas gastos variáveis só existem até a data de geração — use Configurações →
  Restaurar dados para um cenário atualizado.
- CSP por `<meta>`: `frame-ancestors`, HSTS e demais headers precisam ser definidos
  no servidor (`docs/seguranca.md`); estilos ainda exigem `'unsafe-inline'`.
- `npm audit`: vulnerabilidades moderadas apenas em dependências de
  desenvolvimento (plugins de ESLint); produção: 0.
- Investimentos: retorno simples (não TWR/MWR), sem IR/come-cotas nem eventos
  corporativos; valores dependem de avaliações manuais até haver cotações (ADR 0012).
- Projeções do planejamento são simplificadas (sem sazonalidade, inflação ou data
  exata de pagamento das faturas — ADR 0011) e sempre rotuladas como estimativa.
- Histórico de orçamentos compara períodos passados com o limite **atual**; alterar
  os dias de fechamento de um cartão recalcula todas as faturas (ADR 0010).

## Decisões arquiteturais

- ADR 0001–0008 (Fases 1–3).
- **ADR 0009** — ids no cliente (gravações idempotentes), lote atômico do livro de
  lançamentos, transferências, parcelas, recorrências materializadas, situações,
  contas, categorias e histórico de alterações.
- **ADR 0010** — faturas derivadas e fatura aberta pelo calendário, compra como
  registro único, limite disponível, pagamento como `card_payment` (parcial,
  antecipado, estorno), orçamentos (unicidade, consumo compartilhado, histórico) e
  central de notificações.
- **ADR 0011** — metas (progresso derivado, aporte com transferência opcional e
  compensação, projeção pelo ritmo), planejamento sem gravação (fluxos por
  competência, estimativa de variáveis, projeção de saldo, cenários, grande compra,
  plano anual/mensal) e simulador de juros compostos.
- **ADR 0012** — investimentos: custo médio e resultados realizados, valor atual
  ajustado após a avaliação, movimentações com lançamento opcional na conta
  (compensação), reavaliação sugerida e contrato de indicadores de mercado.
- **ADR 0013** — calendário com eventos derivados, relatórios como tabela única
  (tela = CSV = PDF), indicadores, CSV pt-BR com proteção contra fórmulas e PDF com
  jsPDF sob demanda; lembretes apenas como contrato.
- **ADR 0014** — auditoria axe e contraste dos tokens, tabelas roláveis acessíveis,
  seed/Dexie sob demanda, CSP no build, mensagens de erro de armazenamento e
  carregamento, busca global com entidades e exportação JSON.

## Próximas etapas

As 9 fases estão concluídas. Próximos passos sugeridos (detalhes em
[`PENDENCIAS.md`](./PENDENCIAS.md)): validar todos os módulos contra o backend
(`../fincore-api`, E2E no modo API), completar Configurações (moeda, formato de data,
fuso) e preparar o deploy com os headers de `docs/seguranca.md`.

## Histórico — Fase 8

### Fase 8 — Implementado

Regras em [ADR 0013](./docs/adr/0013-calendario-relatorios-e-exportacao.md).

**Calendário (`/calendario`)**

- Eventos derivados dos módulos: contas a pagar/receber, transferências agendadas,
  recorrências futuras (previstas), vencimentos de faturas e prazos de metas.
- Visão mensal (semanas de domingo a sábado) e semanal, navegação, dia selecionado
  com detalhes e link para o módulo, filtros por tipo e "mostrar realizados" (na URL),
  resumo do período (a pagar, a receber, vencidos).
- Lembretes: vencimentos na central de notificações; e-mail/push só como contrato.

**Relatórios (`/relatorios`)**

- 11 relatórios: resumo e indicadores, receitas e despesas por mês, despesas e receitas
  por categoria (fixas × variáveis), movimentação por conta, fluxo de caixa, orçamento ×
  realizado, evolução patrimonial, evolução dos investimentos, histórico de economia e
  compromissos futuros.
- Indicadores: taxa de poupança, comprometimento da renda, média mensal de despesas,
  patrimônio líquido e investido.
- Filtros na URL (período do dashboard, relatório, conta); observações de metodologia.
- **Exportação CSV** (pt-BR, `;`, BOM, proteção contra fórmulas) e **PDF** (jsPDF sob
  demanda, com período, conta, data de geração e aviso de demonstração) — gerados da
  mesma tabela exibida.

**Infraestrutura**: features `calendar` e `reports` (domínio puro + leitura única dos
repositórios), `lib/export` (CSV, PDF, download), `dayOfWeek`/`startOfWeek` em
`lib/dates`, `PeriodFilter` exportado pelo dashboard. Dependências novas:
`jspdf@4.2.1` e `jspdf-autotable@5.0.9` (`npm audit --omit=dev`: 0).

**Correções durante a fase**: escapes `\u` gravados como caracteres invisíveis
(espaço não separável, BOM, acentos combinantes) — trocados por `String.fromCharCode`
e verificados por varredura; todos os módulos da navegação passaram a ter tela real.

### Testes executados (Fase 8)

| Verificação                     | Resultado                                                                 |
| ------------------------------- | ------------------------------------------------------------------------- |
| `npm run typecheck`             | ✅ sem erros                                                              |
| `npm run lint`                  | ✅ 0 erros, 0 avisos                                                      |
| `npm run format:check`          | ✅                                                                        |
| `npm test`                      | ✅ 46 arquivos, 508 testes                                                |
| `npm run test:e2e`              | ✅ 39 aprovados, 1 ignorado de propósito (atalho de teclado no mobile)    |
| `npm run build`                 | ✅ sem aviso de chunk acima de 500 kB; jsPDF fora do carregamento inicial |
| Verificação manual no navegador | ✅ calendário (celular, escuro) e relatórios (desktop, claro)             |

Novas suítes: `calendar` (eventos e grade), `reports` (entradas, indicadores e
relatórios com valores calculados à mão), `export` (CSV, nome de arquivo, PDF real),
`report-export` (CSV/PDF = tabela), `tests/integration/calendar-reports`
(inclui CSV baixado = tabela da tela), `tests/e2e/calendar-reports.spec` (downloads).

## Histórico — Fase 7

### Fase 7 — Implementado

Regras em [ADR 0012](./docs/adr/0012-investimentos-custo-medio-e-indicadores.md).

**Carteira (`/investimentos`)**

- Resumo: valor atual (com aviso "Inclui estimativas"), custo das posições, retorno
  total (não realizado + realizado + proventos) e proventos dos últimos 12 meses.
- Evolução da carteira (valor × aplicado), posições com quantidade, **preço médio**,
  custo, valor atual com **origem** (manual, estimativa, pelo custo, ajustado),
  resultado e participação; distribuição por classe; proventos mês a mês.
- **Indicadores de mercado** (CDI, IPCA, Selic, Ibovespa): contrato pronto, exibidos
  como "integração ainda não disponível" — nada é inventado; aviso de que nada é
  recomendação de investimento.

**Ativo (`/investimentos/:id`)**

- Cadastrar/editar/excluir ativo (nome, código, classe, instituição, observações).
- **Movimentações**: compra/venda (com quantidade) ou aporte/resgate, dividendos,
  juros, rendimentos, taxas e impostos; opção de lançar na conta (aplicação/resgate
  como `investment`, proventos como receita); exclusão remove o lançamento.
- **Avaliações** (valor atual manual ou estimado, uma por data) e **reavaliação
  sugerida** quando a operação é anterior à última avaliação.
- Quantidade, preço médio, custo, resultado realizado e não realizado, proventos,
  retorno total, evolução da posição e histórico de alterações.

**Infraestrutura**: `InvestmentRepository` com escrita (Demo + Api),
`MarketIndicatorRepository` (Demo indisponível; Api `GET /market/indicators`),
`transactionId` nas movimentações, `InvestmentLedgerCommands` na feature de
transações, domínio com custo médio (`replayMovements`, `findOversell`) e análises
(`buildEvolution`, `buildIncomeByMonth`), histórico com `asset`.

**Correções durante a fase**: o valor atual ficava "parado" na última avaliação e
ignorava aplicações posteriores — agora são somadas pelo custo e sinalizadas.

### Testes executados (Fase 7)

| Verificação                     | Resultado                                                                                     |
| ------------------------------- | --------------------------------------------------------------------------------------------- |
| `npm run typecheck`             | ✅ sem erros                                                                                  |
| `npm run lint`                  | ✅ 0 erros, 0 avisos                                                                          |
| `npm run format:check`          | ✅                                                                                            |
| `npm test`                      | ✅ 41 arquivos, 478 testes                                                                    |
| `npm run test:e2e`              | ✅ 35 aprovados, 1 ignorado de propósito (atalho de teclado no mobile)                        |
| `npm run build`                 | ✅ sem aviso de chunk acima de 500 kB                                                         |
| Verificação manual no navegador | ✅ carteira, compra com conta, reavaliação sugerida — celular e desktop, temas escuro e claro |

Novas suítes: `investment-use-cases`, `market-indicators` (REST), casos novos em
`portfolio` (custo médio, realizado, renda fixa, ordem no dia),
`tests/integration/investments`, `tests/e2e/investments.spec`.

## Histórico — Fase 6

### Fase 6 — Implementado

Regras em [ADR 0011](./docs/adr/0011-metas-e-planejamento.md).

**Metas (`/metas`, `/metas/:id`)**

- Resumo: acumulado, falta acumular e soma dos aportes mensais necessários.
- Criar/editar (nome, tipo, valor desejado, datas, prioridade, conta da meta,
  descrição), concluir, cancelar, reativar e excluir (só sem aportes).
- **Aportes e retiradas** com opção de registrar também a **transferência** entre
  contas (nunca receita); exclusão do aporte remove a transferência vinculada.
- Progresso, valor restante, aporte mensal necessário, prazo vencido, **ritmo atual**
  e **conclusão estimada** (rotulados como estimativa); histórico de aportes e de
  alterações.

**Planejamento (`/planejamento`)** — nada é gravado; tudo rotulado como estimativa.

- **Projeção de saldo** (6, 12 ou 24 meses): ponto de partida (contas − faturas
  devidas), receitas/despesas agendadas, recorrências futuras, parcelas do cartão e
  média dos variáveis; gráfico, tabela, menor saldo previsto.
- **Cenários** base, otimista, conservador e personalizado (variação de receitas e
  de gastos variáveis), com comparação entre cenários.
- **Grande compra simulada** (valor, mês, parcelas) com aviso se o saldo projetado
  ficar negativo.
- **Plano anual e mensal**: 12 meses com realizado, em andamento e previsto, total do
  ano, orçado; detalhamento do mês por categoria com orçamento.
- **Simulação de economia e aportes**: juros compostos, total aportado, rendimentos,
  aporte necessário para um objetivo e tempo até atingi-lo.

**Infraestrutura**: `GoalRepository` com escrita (Demo + Api), `transferId` nos
aportes, `GoalTransferPort` ligado aos casos de uso de lançamentos, feature
`planning` (domínio puro: `collectFlows`, `buildBalanceProjection`,
`buildAnnualPlan`/`buildMonthPlan`, `simulateSavings`), `TableFooter` no design
system, `TrendChart` movido para `components/data-display`, histórico com `goal`.

**Correções durante a fase**: reexportar o `TrendChart` pelo índice do dashboard
levava o Recharts ao carregamento inicial (chunk de 675 kB) — movido para
`components/data-display` (381 kB).

### Testes executados (Fase 6)

| Verificação                     | Resultado                                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `npm run typecheck`             | ✅ sem erros                                                                                                       |
| `npm run lint`                  | ✅ 0 erros, 0 avisos                                                                                               |
| `npm run format:check`          | ✅                                                                                                                 |
| `npm test`                      | ✅ 38 arquivos, 443 testes                                                                                         |
| `npm run test:e2e`              | ✅ 33 aprovados, 1 ignorado de propósito (atalho de teclado no mobile)                                             |
| `npm run build`                 | ✅ sem aviso de chunk acima de 500 kB                                                                              |
| Verificação manual no navegador | ✅ metas, aporte com transferência, planejamento (cenários, plano anual) — celular e desktop, temas escuro e claro |

Novas suítes: `goal-use-cases`, casos novos em `goal-progress` (projeção),
`planning` (projeção, cenários, compra, plano anual/mensal, simulador),
`tests/integration/goals-planning`, `tests/e2e/goals-planning.spec`.

## Histórico — Fase 5

### Fase 5 — Implementado

Regras em [ADR 0010](./docs/adr/0010-cartoes-orcamentos-e-notificacoes.md) (base: ADR 0007).

**Cartões (`/cartoes`, `/cartoes/:id`)**

- Resumo: limite disponível, utilizado (inclui parcelas futuras) e faturas a pagar.
- Cartões com barra de limite, fatura aberta, próxima fatura a pagar e parcelas futuras.
- Cadastrar/editar (nome, instituição, bandeira, limite, fechamento, vencimento,
  conta de pagamento), bloquear/desbloquear, cancelar/reativar, excluir (só sem uso).
- **Compras** avulsas e parceladas (1–48x) com prévia "Nx de R$ … a partir da fatura
  de …"; editar e cancelar (estorno integral). Recusa: cartão inativo, data futura,
  categoria que não é de despesa e **limite insuficiente**.
- **Faturas** por mês (aberta, fechada, parcialmente paga, paga, vencida, futura)
  com dados de fechamento/vencimento, total, pago, em aberto e parcelas.
- **Pagar fatura** (total, parcial ou antecipado; conta escolhida) → transação
  `card_payment` que reduz o saldo da conta e nunca é despesa; **estornar** pagamento.
- Histórico de pagamentos, parcelas futuras por mês e histórico de alterações.

**Orçamentos (`/orcamentos`)**

- Mensal ou anual, por categoria de despesa ou geral, limiar de alerta (padrão 80%).
- Navegação por mês (`?mes=`), indicadores (planejado × realizado dos mensais por
  categoria, dentro do limite, em alerta, excedidos), barra de consumo, disponível
  ou **excedente**; pausar/reativar, editar, excluir; um único orçamento ativo por
  categoria e período.
- **Histórico**: planejado × realizado dos últimos 12 meses (ou 5 anos) e alterações.

**Central de notificações** do cabeçalho alimentada pelos alertas do dashboard do
mês atual (saldo negativo, contas vencidas/a vencer, faturas, orçamentos, limite do
cartão, resultado negativo), com contador de alertas importantes e link para o módulo.

**Infraestrutura**: `CreditCardRepository` (`save`, `remove`, `findById`,
`savePurchase`, `findPurchaseById`) e `BudgetRepository` (`save`, `remove`,
`findById`) — Demo e Api; casos de uso em `features/credit-cards/application` e
`features/budgets/application`; contextos e hooks; `sumBudgetSpending` compartilhado
com o dashboard; histórico com `credit_card`, `card_purchase` e `budget`;
contrato REST da Fase 5 em `docs/api-contract.md`.

**Correções durante a fase**: a fatura aberta podia ser marcada no mês errado quando
o mês corrente não tinha compras; fatura fechada sem valor aparecia como "fechada"
(agora "paga"); após pagar, a tela de detalhes pulava para outra fatura.

### Testes executados (Fase 5)

| Verificação                     | Resultado                                                                                                              |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`             | ✅ sem erros                                                                                                           |
| `npm run lint`                  | ✅ 0 erros, 0 avisos                                                                                                   |
| `npm run format:check`          | ✅                                                                                                                     |
| `npm test`                      | ✅ 35 arquivos, 403 testes                                                                                             |
| `npm run test:e2e`              | ✅ 29 aprovados, 1 ignorado de propósito (atalho de teclado no mobile)                                                 |
| `npm run build`                 | ✅                                                                                                                     |
| Verificação manual no navegador | ✅ cartões, detalhes, pagamento parcial, orçamentos, histórico, notificações — celular e desktop, temas escuro e claro |

Novas suítes: `credit-card-use-cases`, `budget-use-cases`, `NotificationsButton`,
casos novos em `credit-cards` (fatura aberta), `tests/integration/cards-budgets`,
`tests/e2e/cards-budgets.spec`.

## Histórico — Fase 4

### Fase 4 — Implementado

Regras em [ADR 0009](./docs/adr/0009-escrita-recorrencias-e-historico.md).

**Lançamentos (`/transacoes`)**

- Criar receitas e despesas avulsas, **parceladas** (valor total dividido com
  `Money.allocate`, mês a mês com ajuste de fim de mês) ou **recorrentes**
  (diária, semanal, quinzenal, mensal, bimestral, trimestral, semestral, anual;
  data final opcional).
- Editar (em séries: "somente este" ou "este e os próximos pendentes"), duplicar,
  marcar como pago/recebido (com data), desfazer pagamento, cancelar, reativar e
  excluir (com confirmação e alcance em séries).
- Transferências entre contas (duas pernas atômicas; datas futuras agendadas).
- Filtros na URL: mês, tipo, situação, categoria, conta, busca sem acentos (descrição,
  categoria, tags), ordenação por data/valor, paginação; totais do filtro.
- Tabela no desktop, cartões no celular; detalhes com **histórico de alterações**.

**Recorrências**

- Entidade `Recurrence` + agenda; ocorrências materializadas até o fim do mês
  seguinte por `RecurrenceScheduler` (idempotente, 1×/dia), executado antes de
  listar lançamentos, contas e dashboard. Exceções e encerramento de séries.
- Seed de demonstração v2 com as despesas fixas e o salário como recorrências.

**Contas (`/contas`, `/contas/:id`)**

- Saldo atual, a pagar/receber, saldo previsto, destaque de saldo negativo, total
  das contas ativas; criar, editar, arquivar/restaurar; transferir; novo
  lançamento na conta; **extrato** mensal com saldo inicial, saldo acumulado,
  entradas, saídas, saldo final e pendentes.

**Categorias** (Configurações): criar, editar, excluir (bloqueado se em uso por
lançamentos, recorrências, compras ou orçamentos); nome único por tipo.

**Infraestrutura**: escrita atômica no IndexedDB (`DemoDataStore.write`, schema
Dexie v2 com `recurrences` e `auditLog`); `TransactionRepository.commit`
(lote atômico), `AccountRepository.save`, `CategoryRepository.save/remove`,
implementações Demo e Api; feature `history`; invalidação de cache centralizada
(`invalidateFinancialData`); contrato REST de escrita em `docs/api-contract.md`.

**UI**: `Select`, `Checkbox`, `Textarea`, `Table`, `MoneyInput`,
`ConfirmDialog`, `Pagination`, `MonthNavigator`, `HistoryTimeline`.

**Correções durante a fase**: rótulos de selects não associados ao campo
(acessibilidade); seed gerava despesas variáveis futuras como pendentes;
capitalização "Novembro De 2026".

### Testes executados (Fase 4)

| Verificação                     | Resultado                                                              |
| ------------------------------- | ---------------------------------------------------------------------- |
| `npm run typecheck`             | ✅ sem erros                                                           |
| `npm run lint`                  | ✅ 0 erros, 0 avisos                                                   |
| `npm run format:check`          | ✅                                                                     |
| `npm test`                      | ✅ 31 arquivos, 354 testes                                             |
| `npm run test:e2e`              | ✅ 23 aprovados, 1 ignorado de propósito (atalho de teclado no mobile) |
| `npm run build`                 | ✅                                                                     |
| Verificação manual no navegador | ✅ criar parcelado, busca, contas, extrato (desktop e celular)         |

Novas suítes: `ledger-commands`, `queries-and-categories`, `account-use-cases`,
`demo-data-store` (escrita atômica), `tests/integration/ledger`, `tests/e2e/ledger.spec`.

## Histórico — Fase 3

### Fase 3 — Implementado

**Domínio financeiro (base para as Fases 4–7)** — regras em ADR 0007

- `accounts`: contas e saldo em qualquer data (saldo inicial + liquidados).
- `transactions`: movimentações (`income`, `expense`, `transfer`, `card_payment`,
  `investment`), categorias e as regras únicas de efeito no saldo e no resultado.
  Transferências, pagamentos de fatura e aplicações nunca são receita/despesa.
- `credit-cards`: calendário de faturas (fechamento/vencimento, fim de mês,
  "melhor dia de compra"), parcelamento sem perda de centavos, faturas derivadas
  com status (futura, aberta, fechada, parcialmente paga, paga, vencida), dívida e
  uso de limite.
- `budgets`: uso no período, alerta no limiar (comparação exata) e excedente.
- `goals`: progresso por aportes/retiradas, restante, aporte mensal necessário.
- `investments`: valor aplicado líquido, avaliação mais recente com origem
  (manual / cotação / estimativa / sem avaliação), proventos, distribuição por classe.

**Camada de dados** — ADR 0008

- Contratos de repositório (leitura) por feature + implementações `Demo*`
  (IndexedDB/Dexie) e `Api*` (REST, validadas com Zod).
- Composição única por `VITE_DATA_SOURCE` (`create-data-layer.ts`) e `DataProvider`.
- Seed determinístico de 12 meses (4 contas, 14 categorias, 2 cartões com
  compras parceladas, faturas pagas, 7 orçamentos, 3 metas, 6 ativos com
  avaliações mensais, lançamentos pendentes e um cancelado), restaurável em
  Configurações.

**Dashboard**

- 8 indicadores, 6 gráficos (Recharts) com legenda, resumo acessível e visão em
  tabela; paleta categórica validada para daltonismo (claro e escuro), cor
  estável por entidade.
- Últimas movimentações (transferência exibida uma vez), próximas contas
  (vencidas + 30 dias), próximas faturas, orçamentos próximos do limite, metas e
  alertas por severidade (2 visíveis no celular, 4 no desktop, "ver todos").
- Filtros: mês atual, 30/90 dias, ano atual e personalizado (validado), na URL.
- Estados: skeleton, erro com "tentar novamente", dados anteriores esmaecidos
  durante a atualização, estados vazios.
- Rota carregada sob demanda (Recharts fica fora do bundle inicial).

**Outros**

- `Money.divide`, `max`, `min`; `formatCompactCurrency`, `formatPercent`; `MonthKey`
  e utilitários de mês.
- Componentes `StatCard`, `ChartCard`, `ChartLegend`, `ChartTooltipContent`,
  `ProgressBar`.
- Configurações: seção "Ambiente de demonstração" com restauração confirmada.
