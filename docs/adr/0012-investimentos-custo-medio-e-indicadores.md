# ADR 0012 — Investimentos: custo médio, movimentações com conta e indicadores de mercado

- **Status:** Aceito (substitui a seção 6 do ADR 0007, "versão inicial")
- **Data:** 11/11/2026

## Contexto

A Fase 7 torna a carteira gravável e exige cálculos documentados por tipo de
ativo, diferenciação clara entre valor manual, cotação externa e estimativa, e a
preparação (sem inventar) de integrações com CDI, IPCA, Selic e Ibovespa.

## Decisões

### Cálculos (`domain/services/portfolio.ts`)

1. **Classes negociadas em quantidade** (ações, FIIs, ETFs, cripto — `QUANTITY_ASSET_CLASSES`)
   usam compra/venda com quantidade obrigatória (até 8 casas). As demais (renda
   fixa, Tesouro, CDB, LCI, LCA, fundos, outros) usam aporte/resgate sem quantidade.
2. **Custo médio:** compras e **taxas** somam ao custo; a venda baixa o custo
   proporcional à quantidade (`custo × qtd vendida ÷ qtd em carteira`, venda total
   zera o custo exato) e gera **resultado realizado** = valor da venda − custo baixado.
   Preço médio = custo ÷ quantidade. Sem quantidade, o resgate abate primeiro o
   principal; o que exceder é resultado realizado.
3. Ordem no mesmo dia: entradas, taxas, proventos, impostos e, por último, saídas.
4. **Valor atual** = última avaliação até a data + aplicações − retiradas
   **posteriores** a ela (pelo custo), sinalizado como "Ajustado". Sem avaliação,
   exibe-se o custo (origem `cost`, "Pelo custo"). Posição com quantidade zerada vale zero.
5. **Proventos líquidos** = dividendos + juros + rendimentos − impostos (impostos
   são tratados como retidos sobre proventos/ganhos).
6. **Retorno total** = não realizado (valor atual − custo) + realizado + proventos;
   percentual **simples** sobre o total aplicado (compras + aportes + taxas). Não é
   TWR/MWR, não desconta inflação, IR sobre ganho de capital ou come-cotas —
   limitação explícita na interface.
7. O **valor aplicado líquido** (fluxo de capital) continua alimentando o
   patrimônio do dashboard, sem mudança de comportamento.

### Movimentações e contas

8. Uma movimentação pode, opcionalmente, gerar lançamento na conta:
   aplicação/compra → `kind: investment` (saída), venda/resgate → `kind: investment`
   (entrada) — nunca receita/despesa; proventos → **receita** com categoria escolhida.
   Taxas e impostos ficam só na carteira (normalmente descontados pela corretora).
9. Os lançamentos são criados por `InvestmentLedgerCommands` (feature de transações)
   via porta `InvestmentLedgerPort`; continuam **gerenciados** (Transações não os
   edita). Mesmo padrão de compensação do ADR 0011: o lançamento é gravado antes e
   desfeito se a movimentação falhar; excluir a movimentação exclui o lançamento.
10. Validações: data não futura; valor > 0; tipo compatível com a classe; nenhuma
    venda pode exceder a quantidade em carteira em nenhum momento (inclusive ao
    excluir compras); resgate limitado ao valor da posição na data.
11. **Reavaliação sugerida:** se a operação for anterior (ou do mesmo dia) à última
    avaliação, ela não entra no valor atual sozinha; a interface pede para confirmar o
    valor atual, sugerindo a avaliação anterior ajustada pela operação.
12. **Avaliações:** uma por ativo e data (registrar de novo substitui); origem
    `manual` ou `estimate` pelo usuário; `market_quote` fica reservada à integração.
13. Ativos só podem ser excluídos sem movimentações; a classe só muda se as
    movimentações existentes continuarem compatíveis.

### Indicadores de mercado

14. Porta `MarketIndicatorRepository` + entidade `MarketIndicatorQuote` (CDI, IPCA,
    Selic, Ibovespa; valor, unidade, data, fonte). Demonstração: sempre
    **indisponível**. API: `GET /market/indicators` (contrato futuro); 404/501 =
    indisponível, outros erros propagam. A interface mostra "Integração ainda não
    disponível" — nenhum valor é inventado — e aviso de que nada é recomendação.

## Consequências

- Preço médio, realizados e proventos ficam corretos e testados para ações e renda
  fixa; o dashboard não muda.
- Valores dependem de avaliações manuais até existir a integração de cotações.
- Pendentes: TWR/MWR, IR e come-cotas, eventos corporativos (desdobramento,
  grupamento, bonificação), comparação com CDI/IPCA quando houver dados.
