# ADR 0010 — Cartões, faturas, orçamentos e central de notificações

- **Status:** Aceito
- **Data:** 11/11/2026

## Contexto

A Fase 5 torna graváveis os cartões de crédito e os orçamentos, cujo domínio de
leitura (calendário de faturas, parcelas, dívida, uso de orçamento) já existia
desde a Fase 3 (ADR 0007). Era preciso definir onde vivem compras e pagamentos,
como manter faturas consistentes com compras, contas e indicadores, e como os
alertas chegam ao cabeçalho.

## Decisões

1. **Faturas continuam derivadas, nunca armazenadas.** Fatura = parcelas das
   compras do mês + pagamentos `card_payment` liquidados que apontam para o mês.
   Não há como o total divergir das compras. A **fatura aberta** passa a ser a do
   mês em que uma compra feita hoje entraria (`getOpenInvoiceMonth`) — antes era
   "o primeiro mês com parcelas ainda não fechado", o que marcava uma fatura
   futura como aberta quando o mês corrente não tinha compras. Fatura fechada sem
   valor é considerada paga (nada a pagar).
2. **Compra = um registro** (`CardPurchase`), avulsa ou parcelada; as parcelas são
   derivadas (`Money.allocate`, soma exata, centavo residual nas primeiras).
   Regras do caso de uso: cartão **ativo**, data **não futura**, categoria de
   despesa, 1–48 parcelas e **limite disponível suficiente** para o valor total
   (a compra é recusada, como faria o emissor). A compra não altera saldo de conta.
3. **Edição de compra** recalcula as parcelas (o limite desconsidera a própria
   compra); não é possível trocar o cartão. **Cancelar** = estorno da compra
   inteira: as parcelas saem de todas as faturas, o limite é liberado e o
   registro fica no histórico. Faturas já pagas que perderem parcelas ficam com
   pagamento maior que o total ("paga"); crédito em fatura não é modelado.
4. **Pagamento de fatura = transação `card_payment`** no livro de lançamentos
   (`TransactionRepository.commit`), liquidada, sem categoria, com
   `cardPayment.invoiceMonth`. Reduz o saldo da conta escolhida (padrão: conta de
   pagamento do cartão) e libera limite, mas **nunca é despesa** — o consumo já
   está nas parcelas. Aceita pagamento **parcial** e **antecipado** (fatura
   aberta); recusa fatura futura, valor acima do saldo em aberto, data futura e
   conta arquivada. **Estornar** cancela a transação (sem efeito em saldo); o
   módulo de Transações continua sem editar `card_payment` (ADR 0009).
5. **Cartões** — criar, editar, bloquear/desbloquear, cancelar/reativar. Excluir
   só sem compras nem pagamentos (senão, cancelar). Cancelados saem dos totais de
   limite, mas faturas pendentes continuam pagáveis. Alterar os dias de
   fechamento/vencimento **recalcula o calendário de todas as faturas** (inclusive
   passadas) — aviso exibido no formulário.
6. **Orçamentos** — CRUD, mensal ou anual, por categoria de despesa ou geral
   (`categoryId = null`), limiar de alerta 1–100%. Só um orçamento **ativo** por
   (categoria, período); pausar tira o orçamento de alertas e contagens. O
   consumo usa as mesmas entradas do dashboard (`getFinancialEntries`: despesas de
   conta por competência, inclusive pendentes, + parcelas de cartão por
   competência; nunca transferências, pagamentos de fatura ou cancelados) por
   meio de `sumBudgetSpending`, agora compartilhado com o dashboard.
7. **Histórico de orçamentos** — planejado × realizado dos últimos 12 meses
   (mensal) ou 5 anos (anual), **com o limite atual**: alterações de limite ficam
   no histórico de alterações, mas não são versionadas por período.
8. **Histórico de alterações** — novas entidades `credit_card`, `card_purchase` e
   `budget`. Pagamentos e estornos geram entrada na transação e no cartão.
9. **Central de notificações** — `NotificationsButton` (componente genérico) recebe
   itens prontos; `FinancialNotifications` (feature dashboard) usa os alertas do
   dashboard do **mês atual**, compartilhando o cache da mesma consulta, e cada
   alerta aponta para o módulo onde é resolvido (`DashboardAlert.module`). O
   contador considera apenas alertas críticos e de atenção. Não há "marcar como
   lida" (exigiria persistência no backend).
10. **Cache** — `QUERY_ROOTS` ganhou `credit-cards` e `budgets`; toda mutação de
    cartão, compra, pagamento ou orçamento chama `invalidateFinancialData`.

## Contrato HTTP

Novos recursos em [`docs/api-contract.md`](../api-contract.md#escrita-fase-5):
`PUT/GET/DELETE /credit-cards/{id}`, `PUT/GET /credit-cards/purchases/{id}`,
`PUT/GET/DELETE /budgets/{id}`. Pagamentos usam o lote existente
`POST /transactions/batch`.

## Consequências

- Compras, faturas, contas e indicadores ficam consistentes por construção: não
  existe total de fatura ou saldo armazenado que possa divergir.
- Uma compra parcelada grande é um único registro: editar/cancelar é atômico.
- O backend precisa reaplicar as mesmas regras (limite, datas, valor máximo do
  pagamento, unicidade de orçamento ativo) — o cliente não é barreira de segurança.
- Limitações aceitas: sem crédito/estorno parcial de compra, sem versionamento do
  limite de orçamento por período, sem notificação persistida ("lida").
