# FinCore — Status do Projeto

_Última atualização: 11/11/2026 — Fase 4 concluída._

> Para retomar em um novo chat, leia [`CONTINUAR.md`](./CONTINUAR.md). Pendências consolidadas: [`PENDENCIAS.md`](./PENDENCIAS.md).

## Fases

| Fase | Descrição               | Status       |
| ---- | ----------------------- | ------------ |
| 1    | Fundação arquitetural   | ✅ Concluída |
| 2    | Autenticação e layout   | ✅ Concluída |
| 3    | Dashboard               | ✅ Concluída |
| 4    | Gestão financeira       | ✅ Concluída |
| 5    | Cartões e orçamentos    | ⏳ Próxima   |
| 6    | Metas e planejamento    | —            |
| 7    | Investimentos           | —            |
| 8    | Calendário e relatórios | —            |
| 9    | Finalização e qualidade | —            |

## Fase 4 — Implementado

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

## Testes executados (Fase 4)

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

## Funcionalidades pendentes

- **Fase 5 — Cartões e orçamentos:** CRUD de cartões, compras (avulsas e
  parceladas), faturas (tela), pagamento de fatura (gera `card_payment`),
  histórico de pagamentos, orçamentos (CRUD, mensal/anual, planejado × realizado,
  histórico) e alimentar a central de notificações com os alertas.
- Anexos em lançamentos (depende de armazenamento de arquivos no backend).
- Configurações: moeda, formato de data, fuso, notificações, exportação/exclusão.

## Problemas conhecidos

- Nenhum problema crítico.
- O seed é relativo à data em que foi gerado; as recorrências avançam sozinhas,
  mas gastos variáveis só existem até a data de geração — use Configurações →
  Restaurar dados para um cenário atualizado.
- Bundle inicial ~150 kB gzip; avaliar carregar o seed sob demanda na Fase 9.
- `npm audit`: vulnerabilidades moderadas apenas em dependências de
  desenvolvimento (plugins de ESLint); produção: 0.
- Investimentos em versão inicial (ver ADR 0007).

## Decisões arquiteturais

- ADR 0001–0008 (Fases 1–3).
- **ADR 0009** — ids no cliente (gravações idempotentes), lote atômico do livro de
  lançamentos, transferências, parcelas, recorrências materializadas, situações,
  contas, categorias e histórico de alterações.

## Próximas etapas

Iniciar a **Fase 5 — Cartões e orçamentos** (requisitos em
[`docs/ROADMAP.md`](./docs/ROADMAP.md)).

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
