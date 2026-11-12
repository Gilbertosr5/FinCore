# ADR 0011 — Metas, aportes, planejamento e projeções

- **Status:** Aceito
- **Data:** 11/11/2026

## Contexto

A Fase 6 torna as metas graváveis (o progresso já era derivado dos aportes,
ADR 0007) e cria o planejamento: previsão mensal/anual, projeção de saldo,
cenários, grandes compras e simulações de economia. Era preciso decidir como
aportes se relacionam com as contas, de onde vêm as previsões e como deixar
claro que projeções são estimativas.

## Decisões

### Metas

1. **Progresso continua derivado** de `GoalContribution` (aportes − retiradas até
   hoje); nada de "valor acumulado" armazenado.
2. **Aporte nunca é receita.** Cada aporte/retirada pode, opcionalmente, registrar
   também uma **transferência** entre uma conta escolhida e a conta da meta
   (`GoalContribution.transferId`). Sem transferência, registra-se só a destinação
   (o dinheiro já estava na conta). A transferência é criada pelos casos de uso de
   lançamentos, injetados como porta (`GoalTransferPort`) — o módulo de metas não
   duplica a lógica de transferências.
3. **Gravação em duas etapas com compensação:** a transferência é gravada antes do
   aporte; se o aporte falhar, a transferência é desfeita. O backend deve fazer as
   duas gravações na mesma transação (`POST` único — ver contrato).
4. Excluir um aporte exclui a transferência vinculada. Excluir a transferência em
   Transações **não** apaga o aporte (a destinação continua válida).
5. Regras: meta ativa para aportar; data não futura e não anterior ao início;
   retirada limitada ao acumulado na data e sem deixar o saldo da meta negativo
   em nenhum momento (o mesmo vale ao excluir um aporte); conta da meta
   obrigatória para registrar transferência; contas arquivadas não são aceitas.
6. Concluir é permitido mesmo sem atingir o valor (com aviso); cancelar e reativar
   preservam aportes; excluir só sem aportes.
7. **Projeção da meta** (`projectGoal`): ritmo = (aportes − retiradas) dos últimos
   6 meses ÷ meses desde o início da janela (ou da meta); conclusão estimada =
   faltante ÷ ritmo, sem rendimentos. Sempre exibida como **estimativa**.

### Planejamento (feature `planning`)

8. **Nada é gravado.** `LoadPlanningDataUseCase` lê os dados uma vez; projeções,
   cenários e simulações são funções puras do domínio recalculadas na hora, e a
   consulta é invalidada por qualquer alteração financeira.
9. **Fluxos por competência** (`collectFlows`): lançamentos de conta (receitas e
   despesas não canceladas), ocorrências futuras de recorrências ainda não
   materializadas (mesma agenda da Fase 4) e parcelas de cartão. Transferências,
   pagamentos de fatura e aplicações nunca são fluxo.
10. **Estimativa de variáveis:** média mensal, por categoria, dos fluxos que não vêm
    de recorrência nem de parcelamento nos últimos **3 meses completos** (menos, se
    o histórico for curto). No mês atual, proporcional aos dias restantes.
11. **Projeção de saldo:** ponto de partida = saldo das contas ativas − parcelas de
    cartão já devidas por competência e não pagas (dívida do cartão − parcelas
    futuras). Cada mês soma pendentes, recorrências futuras, parcelas futuras do
    cartão e a estimativa de variáveis. No mês atual entram também os pendentes
    atrasados. A saída de caixa do cartão é aproximada pela competência.
12. **Cenários:** Base (0/0), Otimista (receitas +5%, gastos variáveis −10%),
    Conservador (receitas −10%, gastos variáveis +10%) e Personalizado. O ajuste
    de receitas vale para toda receita prevista; o de despesas só para a parte
    **estimada** — compromissos fixos (recorrências, parcelas, pendentes) não mudam.
13. **Grande compra simulada:** valor total dividido em 1–48 parcelas a partir do
    mês escolhido; a interface indica se o menor saldo projetado fica negativo.
14. **Plano anual/mensal:** por mês, realizado (competência até hoje), agendado e
    estimado, por categoria, com o orçamento mensal ativo da categoria e o total
    orçado do mês (orçamento geral ou soma dos por categoria).
15. **Simulador de economia:** juros compostos mensais, aportes no fim do mês, sem
    impostos/inflação, cálculo em `decimal.js`; aporte necessário arredondado para
    cima; prazo máximo 600 meses, taxa 0–20% a.m.
16. **Gráficos compartilhados:** `TrendChart` e os formatadores de gráfico passaram
    para `components/data-display`. Reexportá-los pelo índice do dashboard (que o
    cabeçalho importa de forma imediata) levava o Recharts ao carregamento inicial.

## Consequências

- Metas, saldos e indicadores ficam consistentes: aportes não inflam receitas e o
  dinheiro só se move quando o usuário pede a transferência.
- Projeções são reprodutíveis e testáveis (funções puras), mas simples: sem
  sazonalidade, inflação, rendimentos de contas ou data exata de pagamento das
  faturas. Tudo é rotulado como estimativa.
- Cenários personalizados e grandes compras não são salvos (exigiria persistência
  no backend).
