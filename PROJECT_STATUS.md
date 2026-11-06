# FinCore — Status do Projeto

_Última atualização: 06/11/2026 — Fase 3 concluída._

## Fases

| Fase | Descrição               | Status       |
| ---- | ----------------------- | ------------ |
| 1    | Fundação arquitetural   | ✅ Concluída |
| 2    | Autenticação e layout   | ✅ Concluída |
| 3    | Dashboard               | ✅ Concluída |
| 4    | Gestão financeira       | ⏳ Próxima   |
| 5    | Cartões e orçamentos    | —            |
| 6    | Metas e planejamento    | —            |
| 7    | Investimentos           | —            |
| 8    | Calendário e relatórios | —            |
| 9    | Finalização e qualidade | —            |

## Fase 3 — Implementado

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

## Testes executados (Fase 3)

| Verificação                     | Resultado                                                              |
| ------------------------------- | ---------------------------------------------------------------------- |
| `npm run typecheck`             | ✅ sem erros                                                           |
| `npm run lint`                  | ✅ 0 erros, 0 avisos                                                   |
| `npm run format:check`          | ✅                                                                     |
| `npm test`                      | ✅ 27 arquivos, 302 testes                                             |
| `npm run test:e2e`              | ✅ 19 aprovados, 1 ignorado de propósito (atalho de teclado no mobile) |
| `npm run build`                 | ✅                                                                     |
| Verificação manual no navegador | ✅ desktop, celular, tema claro e escuro                               |

Novas suítes: `transaction-effects`, `account-balance`, `credit-cards`,
`budget-usage`, `goal-progress`, `portfolio`, `period`, `dashboard-overview`
(cenário com valores calculados à mão), `use-period-selection`, `demo-seed`,
`demo-data-store`, `tests/integration/dashboard`, `tests/e2e/dashboard.spec`.

**Bug encontrado pelos testes e corrigido:** o alerta de orçamento usava o
percentual arredondado — R$ 639,99 de R$ 800 (79,998%) disparava o alerta de 80%.

## Funcionalidades pendentes

- **Fase 4 — Gestão financeira:** CRUD de lançamentos (receitas, despesas,
  transferências, duplicar, cancelar, marcar pago/recebido), recorrências,
  parcelamentos em conta, categorias personalizadas, contas (criar, editar,
  arquivar, extrato), escrita nos repositórios e invalidação de cache do dashboard.
- Notificações: alimentar a central com os alertas do dashboard.
- Configurações: moeda, formato de data, fuso, categorias, exportação/exclusão.

## Problemas conhecidos

- Nenhum problema crítico.
- O seed é relativo à data em que foi gerado: em um novo mês, use
  **Configurações → Restaurar dados** para que o "mês atual" tenha dados.
- Bundle inicial ~148 kB gzip (inclui Dexie, Zod e o gerador de seed). Avaliar
  carregar o seed sob demanda na Fase 9.
- `npm audit`: 8 vulnerabilidades moderadas apenas em dependências de
  desenvolvimento (minimatch via plugins de ESLint); produção: 0.
- Cálculo de investimentos é uma versão inicial (sem custo médio, TWR/MWR, IR,
  inflação) — limitações documentadas no ADR 0007 e sinalizadas na interface.

## Decisões arquiteturais

- ADR 0001–0006 (Fases 1–2).
- **ADR 0007** — modelo financeiro: tipos de movimentação, competência, cartões e
  faturas derivadas, orçamentos, metas, investimentos (e limitações), patrimônio,
  cores de gráficos.
- **ADR 0008** — repositórios por feature, IndexedDB de demonstração e seed.
- Contrato dos recursos de leitura em `docs/api-contract.md`.

## Próximas etapas

Iniciar a **Fase 4 — Gestão financeira**. Requisitos completos das Fases 4 a 9 em
[`docs/ROADMAP.md`](./docs/ROADMAP.md).
