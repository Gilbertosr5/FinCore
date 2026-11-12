# ADR 0009 — Escrita de lançamentos, recorrências e histórico de alterações

- **Status:** Aceito
- **Data:** 11/11/2026

## Contexto

A Fase 4 introduz gravação de dados: lançamentos avulsos, parcelados e
recorrentes, transferências, contas e categorias. Era preciso garantir que nada
fique "pela metade" (uma perna de transferência sem a outra, parcelas
faltando), que recorrências não dupliquem ocorrências e que as alterações
importantes fiquem registradas.

## Decisões

1. **Ids gerados no cliente (UUID v4).** Toda gravação é "cria ou substitui"
   (PUT/upsert) e, portanto, idempotente: reenviar a mesma operação não duplica
   lançamentos. Mutações nunca têm retry automático (TanStack Query).
2. **Lote atômico do livro de lançamentos** — `TransactionRepository.commit(LedgerChanges)`
   aplica `upsert`/`remove` de transações e recorrências em uma única transação
   (IndexedDB) ou requisição (`POST /transactions/batch`). Transferências,
   parcelamentos e recorrências sempre usam um único lote.
3. **Transferência** = duas transações `kind: transfer` com o mesmo `transfer.id`
   (ids `${id}_out` e `${id}_in`). Pagar, cancelar, excluir ou editar afeta as duas.
   Datas futuras ficam agendadas (pendentes).
4. **Parcelamento em conta** — o valor informado é o **total**, dividido com
   `Money.allocate` (soma exata); parcela _i_ em competência/vencimento + _i_ meses
   (ajuste de fim de mês). Somente a 1ª parcela pode nascer paga.
5. **Recorrências** — entidade `Recurrence` (frequência, início, fim opcional,
   modelo e `excludedDates`). Frequências: diária, semanal, quinzenal (15 dias),
   mensal, bimestral, trimestral, semestral e anual. A n-ésima data é calculada
   sempre a partir da data inicial (sem "derivar" o dia).
   - Ocorrências são **materializadas** como transações comuns, com id
     determinístico `${recorrência}_${data}`, até o **fim do mês seguinte**.
   - `RecurrenceScheduler` roda antes de listar lançamentos, contas e o
     dashboard; é idempotente, executa no máximo uma vez por dia e compartilha a
     execução entre chamadas simultâneas.
   - Excluir uma ocorrência registra a data em `excludedDates` (não volta a ser
     gerada). "Esta e as próximas" encerra a série (data final = véspera).
   - Editar "esta e as próximas" altera as ocorrências **pendentes** seguintes e o
     modelo; as já pagas são preservadas.
6. **Situações** — pagar/receber exige data ≤ hoje; "desfazer pagamento" volta a
   pendente; cancelar mantém no histórico sem efeito em saldos e indicadores;
   reativar volta um cancelado a pendente. Pagamentos de fatura e aplicações em
   investimentos não são editáveis neste módulo (pertencem às Fases 5 e 7).
7. **Contas** — criar, editar (inclusive saldo inicial, com registro no
   histórico), arquivar/restaurar. Arquivadas saem dos totais e das seleções e
   não recebem novos lançamentos; o histórico é preservado. Extrato = lançamentos
   liquidados por data de pagamento, com saldo acumulado; pendentes à parte.
8. **Categorias** — nome único por tipo (sem diferenciar acentos/maiúsculas);
   exclusão e troca de tipo só quando não há uso em lançamentos, recorrências,
   compras de cartão ou orçamentos.
9. **Histórico de alterações** — feature `history` (`AuditEntry`: entidade,
   ação, instante, resumo legível, sem dados sensíveis). No modo demonstração é
   gravado pelos casos de uso; com a API, o backend deve registrá-lo na mesma
   transação da alteração (o cliente só consulta `GET /audit-log`).
10. **Cache** — qualquer mutação financeira invalida transações, contas,
    categorias, dashboard e histórico (`invalidateFinancialData`).

## Consequências

- Os Repositórios `Demo*` e `Api*` continuam intercambiáveis; o contrato REST de
  escrita está em `docs/api-contract.md`.
- A materialização antecipada torna as contas fixas do próximo mês visíveis em
  "Próximas contas a vencer" e no calendário (Fase 8).
- Seed de demonstração passou à versão 2 (inclui recorrências).
