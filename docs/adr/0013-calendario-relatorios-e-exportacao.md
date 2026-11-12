# ADR 0013 — Calendário financeiro, relatórios e exportação CSV/PDF

- **Status:** Aceito
- **Data:** 11/11/2026

## Contexto

A Fase 8 pede um calendário financeiro, relatórios com indicadores históricos e
exportação em PDF e CSV, com a exigência de que os relatórios sejam coerentes com
os demais módulos e que o exportado corresponda exatamente ao período e filtros
da tela. Lembretes não podem depender de infraestrutura inexistente.

## Decisões

### Calendário (`features/calendar`)

1. **Eventos derivados, nada armazenado** (`buildCalendarEvents`):
   - contas a pagar/receber e transferências agendadas a partir dos lançamentos
     (data = pagamento se liquidado; senão, vencimento/competência); transferência
     aparece uma vez (perna de saída); cancelados, pagamentos de fatura e
     aplicações não viram evento;
   - ocorrências futuras de recorrências ainda não geradas → **Previsto**;
   - vencimento de cada fatura (mesmo cálculo de `buildInvoiceForMonth`): paga →
     realizado; vencida; fechada/parcial → pendente; aberta/futura → previsto;
   - prazos de metas (atingida → realizado; vencida; pendente com o que falta).
2. Situações: realizado, pendente, vencido, previsto. Por padrão os realizados
   ficam ocultos (filtro "Mostrar realizados"); filtros por tipo, visão mensal
   (semanas de domingo a sábado) e semanal, dia selecionado e filtros na URL
   (`visao`, `mes`, `dia`, `tipos`, `realizados`).
3. **Lembretes:** nenhum envio é simulado. Vencimentos próximos já aparecem na
   central de notificações; e-mail/push ficam como contrato para o backend.

### Relatórios (`features/reports`)

4. **Uma estrutura, três saídas.** Cada relatório é uma função pura que produz
   `ReportTable` (colunas, linhas, totais, observações). A tela, o CSV e o PDF são
   gerados da MESMA tabela — por construção, o exportado é o exibido.
5. Mesmas regras dos módulos (sem recalcular de outro jeito): receitas/despesas
   por competência como no dashboard (cartão pelas parcelas; transferências,
   faturas, aplicações e cancelados fora); saldos por `computeAccountBalance`;
   orçamentos por `sumBudgetSpending`; patrimônio = contas + investimentos −
   dívida de cartões; compromissos futuros pela agenda do planejamento.
6. Relatórios: resumo/indicadores, receitas e despesas por mês, despesas e
   receitas por categoria, movimentação por conta, fluxo de caixa,
   orçamento × realizado, evolução patrimonial, evolução dos investimentos,
   histórico de economia e compromissos futuros (12 meses a partir de hoje).
7. Indicadores: taxa de poupança (resultado ÷ receitas), **comprometimento da
   renda = despesas fixas ÷ receitas** (natureza da categoria), média mensal de
   despesas (÷ meses do período), patrimônio líquido e investido na data final
   (ou hoje).
8. Filtros: período reutiliza o filtro do dashboard (`?periodo=`), relatório
   (`?relatorio=`) e conta (`?conta=`). Com conta filtrada, parcelas de cartão
   (que não pertencem a conta) ficam de fora e, no fluxo de caixa, transferências
   passam a contar; patrimônio e orçamentos não usam o filtro — sempre informado
   nas observações do relatório.
9. Relatórios de posição (patrimônio, investimentos, fluxo de caixa) só mostram
   meses até o atual.

### Exportação (`lib/export`)

10. **CSV** para planilhas em pt-BR: `;` como separador, vírgula decimal, UTF-8
    com BOM, CRLF, escape de aspas e **proteção contra injeção de fórmulas**
    (texto iniciado por `= + - @` recebe apóstrofo; números não). Valores sem
    "R$"/"%" (a unidade vai no cabeçalho).
11. **PDF** com **jsPDF 4.2.1 + jspdf-autotable 5.0.9** (versões fixadas): título,
    período/conta, data de geração, aviso "DADOS DE DEMONSTRAÇÃO" quando for o
    caso, tabela com totais, observações e numeração de páginas. As bibliotecas
    são carregadas **sob demanda** (import dinâmico) e ficam fora do carregamento
    inicial. Fontes padrão (WinAnsi): acentos funcionam; espaços especiais, sinal
    de menos e setas são normalizados (`toPdfText`).
12. Arquivos gerados no navegador e baixados localmente (nada é enviado a
    servidores); nome com relatório e período (`fincore-<relatório>-<início>-a-<fim>`).

## Consequências

- Relatórios coerentes com os módulos por reutilizarem as mesmas funções.
- `npm audit --omit=dev`: 0 vulnerabilidades após adicionar jsPDF.
- Dependências opcionais do jsPDF (html2canvas, dompurify) viram chunks separados
  que só seriam carregados por `pdf.html()` — não usado.
- Pendências: relatórios com gráficos por categoria no PDF, agendamento/envio de
  relatórios e lembretes (backend), comparação com indicadores de mercado.
