# ADR 0007 — Modelo financeiro e regras de contabilização

- **Status:** Aceito
- **Data:** 06/11/2026

## Contexto

O dashboard (Fase 3) é o primeiro consumidor de todos os módulos. As regras de
contabilização precisam estar definidas antes das telas de cadastro (Fases 4–7)
para que nenhum valor seja contado duas vezes ou esquecido.

## Decisões

### 1. Tipos de movimentação de conta (`Transaction.kind`)

| Tipo                                                | Saldo da conta     | Resultado (receita/despesa)               |
| --------------------------------------------------- | ------------------ | ----------------------------------------- |
| `income`                                            | + quando liquidada | Receita (competência)                     |
| `expense`                                           | − quando liquidada | Despesa (competência)                     |
| `transfer` (par saída/entrada, mesmo `transfer.id`) | − / +              | **Nunca**                                 |
| `card_payment` (fatura de um cartão/mês)            | −                  | **Nunca** (o consumo já está nas compras) |
| `investment` (aplicação/resgate de um ativo)        | − / +              | **Nunca** (muda a forma do patrimônio)    |

- Valores são sempre positivos; o sentido vem do tipo.
- `status`: `pending` (a pagar/receber), `paid` (liquidada, com `paidDate`),
  `cancelled` (sem efeito algum).
- Saldo de conta = saldo inicial + efeitos das movimentações **liquidadas** até a data.
- Todas as regras ficam em `transaction-effects.ts`; nenhum outro código decide
  se algo é receita, despesa ou altera saldo.

### 2. Regime de competência no resultado

Receitas e despesas do período usam a **data de competência**, incluindo
lançamentos pendentes (o KPI informa quanto ainda está a pagar/receber).
Cancelados nunca entram.

### 3. Cartões de crédito

- Compra no cartão **não altera saldo de conta**: compromete limite e gera parcelas.
- Fatura do mês M: fecha no `closingDay` de M; vence no `dueDay` de M (se
  `dueDay > closingDay`) ou de M+1. Dias inexistentes são ajustados ao fim do mês.
- Compra **antes** da data de fechamento entra na fatura de M; **no dia** do
  fechamento ou depois, na fatura seguinte.
- Parcelas: `Money.allocate` (soma exata; centavo residual nas primeiras); parcela
  _i_ na fatura (primeira + _i_); competência da parcela = data da compra + _i_ meses.
- **Faturas não são armazenadas**: são derivadas das compras e dos pagamentos
  (`card_payment` com `cardPayment.invoiceMonth`). Status: futura, aberta,
  fechada, parcialmente paga, paga, vencida.
- Consumo = parcelas; pagamento da fatura nunca é despesa → sem dupla contagem.
- Dívida/limite comprometido = parcelas de compras até a data (inclusive
  futuras) − pagamentos até a data.

### 4. Orçamentos

Gasto = despesas de conta + parcelas de cartão da(s) categoria(s) no período do
orçamento (mês ou ano corrente). Alerta quando gasto × 100 ≥ limite × limiar
(comparação exata — 79,998% não dispara o alerta de 80%); excedido quando
gasto > limite, informando o excedente.

### 5. Metas

Progresso = aportes − retiradas até hoje (`GoalContribution`). Aportes são
destinação de dinheiro já existente (normalmente acompanhados de uma
transferência para a conta da meta) e **nunca** são receita. Aporte mensal
necessário = restante ÷ meses até a data-alvo (estimativa linear, sem rendimento).

### 6. Investimentos — versão inicial e limitações

> **Substituída na Fase 7** por [ADR 0012](./0012-investimentos-custo-medio-e-indicadores.md)
> (custo médio, resultados realizados e valor atual ajustado). Mantida como histórico.

- **Valor aplicado líquido** = aportes + compras + taxas − vendas − resgates
  (fluxo de capital). **Não é custo médio contábil**; custo médio, preço médio e
  apuração de IR entram na Fase 7.
- **Valor atual** = avaliação mais recente até a data, com origem explícita:
  `manual` (informado), `market_quote` (cotação externa — integração futura) ou
  `estimate`. Sem avaliação, exibe-se o valor aplicado com origem `cost` e a
  interface sinaliza "inclui estimativas".
- **Resultado** = valor atual − aplicado líquido. É uma variação patrimonial
  simples, não rentabilidade ponderada no tempo (TWR/MWR) e não desconta
  inflação, IR ou come-cotas. Proventos são exibidos separadamente.
- Nenhuma recomendação de compra/venda é gerada.

### 7. Patrimônio líquido

Patrimônio = saldo das contas + valor atual da carteira − dívida dos cartões.
A série mensal usa o fim de cada mês (ou hoje, no mês corrente) — o último ponto
coincide com o indicador.

### 8. Cores dos gráficos

Paleta categórica de 8 cores em ordem fixa, validada para daltonismo contra as
superfícies claro/escuro (script do _dataviz_). A cor segue a entidade
(categoria/classe), nunca a posição no ranking. Cores de status
(sucesso/atenção/erro) não são usadas como séries. Todo gráfico tem legenda
(≥ 2 séries), resumo acessível e visão em tabela.

## Consequências

- Os módulos das Fases 4–7 só precisam produzir os registros corretos; os
  cálculos já existem e estão cobertos por testes.
- O backend deve aplicar exatamente as mesmas regras (ver `docs/api-contract.md`).
