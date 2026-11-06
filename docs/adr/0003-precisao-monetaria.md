# ADR 0003 — Precisão monetária

- **Status:** Aceito
- **Data:** 05/11/2026

## Contexto

`0.1 + 0.2 !== 0.3` em JavaScript. Um sistema financeiro não pode acumular erros
de ponto flutuante em saldos, parcelas, orçamentos ou rentabilidade.

## Decisão

- Todo valor monetário é um **value object `Money`** (`src/lib/money/money.ts`),
  imutável, baseado em `decimal.js` com um construtor `Decimal` isolado
  (não altera a configuração global).
- **Escala fixa de 2 casas** (centavos). Toda operação que pode gerar mais casas
  (multiplicação, conversão) é arredondada imediatamente.
- **Arredondamento HALF_EVEN** (bancário), alinhado à ABNT NBR 5891 e ao
  `RoundingMode.HALF_EVEN` do Java — o backend deve usar a mesma regra.
- **Parcelamento sem perda de centavos**: `allocate(n)` distribui o resto um
  centavo por vez a partir da primeira parcela (R$ 100,00 / 3 = 33,34 + 33,33 + 33,33).
  A soma das parcelas é sempre igual ao total (testado de 1 a 24 parcelas).
- **Serialização**: string decimal com ponto (`"1234.56"`) em JSON — nunca
  `number` — evitando perda de precisão no transporte. No backend: `BigDecimal`.
- **Formatação**: `formatMoney` usa `Intl.NumberFormat('pt-BR')` recebendo a
  string decimal (sem passar por `float`). Resultado: `R$ 1.234,56`.
- **Entrada do usuário**: `parseMoneyInput` aceita formatos brasileiros
  (`1.234,56`, `R$ 1.234,56`) e rejeita entradas ambíguas.
- `toNumberForDisplay()` existe **apenas** para bibliotecas de gráficos;
  nunca usar o resultado em cálculos.
- Operações entre moedas diferentes lançam `CurrencyMismatchError`.

## Consequências

- Nenhum cálculo financeiro usa `number` diretamente.
- Percentuais (ex.: consumo de orçamento) retornam `Decimal` e `null` quando o
  total é zero (indefinido), forçando a interface a tratar o caso.
