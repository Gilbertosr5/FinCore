# Contrato HTTP com o backend (rascunho)

> **Status:** implementado pelo backend **Node.js + TypeScript + PostgreSQL** em
> [`../../fincore-api`](../../fincore-api/README.md) (11/11/2026; antes previsto em
> Java + Spring Boot). Exceções: `GET /market/indicators` responde `501`. Ainda não
> testado ponta a ponta com o frontend. Menções a Spring abaixo descrevem o
> comportamento equivalente (ex.: cookie `XSRF-TOKEN`).

## Convenções gerais

| Item                | Convenção                                                                   |
| ------------------- | --------------------------------------------------------------------------- |
| Base URL            | `VITE_API_BASE_URL` (ex.: `https://api.fincore.app/api/v1`)                 |
| Formato             | JSON (`application/json`), UTF-8                                            |
| Valores monetários  | string decimal com ponto e 2 casas: `"1234.56"` (`BigDecimal`, `HALF_EVEN`) |
| Datas de calendário | `"YYYY-MM-DD"` (`LocalDate`)                                                |
| Instantes           | ISO 8601 com offset: `"2026-11-05T14:30:00-03:00"` (`OffsetDateTime`)       |
| Identificadores     | string (UUID recomendado)                                                   |
| Sessão              | cookie HttpOnly + Secure + SameSite, emitido pelo backend                   |
| CSRF                | cookie `XSRF-TOKEN` → header `X-XSRF-TOKEN` (padrão Spring Security)        |
| Rastreamento        | header de resposta `X-Request-Id` (exibido em erros para suporte)           |

## Formato de erro — RFC 9457 (Problem Details)

Suportado nativamente pelo Spring Boot 3 (`ProblemDetail`,
`spring.mvc.problemdetails.enabled=true`). Extensões usadas pelo frontend:
`code` (código estável de negócio) e `errors` (erros por campo).

```json
{
  "type": "https://fincore.app/problems/validation",
  "title": "Dados inválidos",
  "status": 422,
  "detail": "O valor deve ser maior que zero.",
  "instance": "/api/v1/transactions",
  "code": "TRANSACTION_INVALID_AMOUNT",
  "errors": [{ "field": "amount", "message": "Deve ser maior que zero" }]
}
```

### Tratamento padronizado no frontend (`src/services/api/api-error.ts`)

| Status | `ApiError.kind`       | Comportamento                                                                   |
| ------ | --------------------- | ------------------------------------------------------------------------------- |
| 400    | `bad_request`         | Exibe `detail`/`title`. Sem retry.                                              |
| 401    | `unauthorized`        | Dispara `onUnauthorized` (sessão expirada/refresh — Fase 2).                    |
| 403    | `forbidden`           | Mensagem de permissão. Sem retry.                                               |
| 404    | `not_found`           | Mensagem de recurso inexistente.                                                |
| 409    | `conflict`            | Indica conflito (ex.: edição concorrente, duplicidade).                         |
| 422    | `validation`          | `errors[]` mapeados para os campos do formulário.                               |
| 429    | `rate_limited`        | Lê `Retry-After`. Sem retry automático.                                         |
| 5xx    | `server`              | Mensagem genérica (detalhes internos **não** são exibidos). Retry em consultas. |
| —      | `network` / `timeout` | Mensagem de conectividade. Retry em consultas.                                  |

Mutações (operações financeiras) **nunca** são reenviadas automaticamente, para
evitar lançamentos duplicados. Recomenda-se que o backend aceite um header
`Idempotency-Key` em operações de criação (a ser detalhado na Fase 4).

## Recursos de leitura usados pelo dashboard (Fase 3)

Cada `Api*Repository` já consome os endpoints abaixo e valida cada item com o
mesmo schema Zod usado no IndexedDB de demonstração. Todos retornam um array
JSON (paginação e filtros no servidor serão definidos nas fases de cada módulo).
Regras de contabilização que o backend deve respeitar:
[ADR 0007](./adr/0007-regras-financeiras-e-contabilizacao.md).

| Método | Caminho                   | Item                                                                                                    |
| ------ | ------------------------- | ------------------------------------------------------------------------------------------------------- |
| GET    | `/accounts`               | `{ id, name, type, institution, initialBalance, initialBalanceDate, archived }`                         |
| GET    | `/categories`             | `{ id, name, kind: "income"\|"expense", nature: "fixed"\|"variable" }`                                  |
| GET    | `/transactions`           | ver abaixo                                                                                              |
| GET    | `/credit-cards`           | `{ id, name, institution, brand, limit, closingDay, dueDay, paymentAccountId, status }`                 |
| GET    | `/credit-cards/purchases` | `{ id, cardId, description, categoryId, totalAmount, purchaseDate, installmentCount, status }`          |
| GET    | `/budgets`                | `{ id, name, categoryId, amount, period: "monthly"\|"yearly", alertThresholdPercent, active }`          |
| GET    | `/goals`                  | `{ id, name, description, category, targetAmount, startDate, targetDate, priority, accountId, status }` |
| GET    | `/goals/contributions`    | `{ id, goalId, date, amount, type: "deposit"\|"withdrawal" }`                                           |
| GET    | `/investments/assets`     | `{ id, name, ticker, assetClass, institution, notes }`                                                  |
| GET    | `/investments/movements`  | `{ id, assetId, type, date, quantity, amount }`                                                         |
| GET    | `/investments/valuations` | `{ id, assetId, date, value, source: "manual"\|"market_quote"\|"estimate" }`                            |

### Transação

```json
{
  "id": "tx-123",
  "kind": "expense",
  "description": "Aluguel",
  "amount": "2200.00",
  "accountId": "acc-1",
  "categoryId": "cat-moradia",
  "competenceDate": "2026-11-10",
  "dueDate": "2026-11-10",
  "paidDate": null,
  "status": "pending",
  "transfer": null,
  "cardPayment": null,
  "investment": null,
  "recurrenceId": "rec-aluguel",
  "installment": null,
  "tags": [],
  "notes": null
}
```

- `kind`: `income` | `expense` | `transfer` | `card_payment` | `investment`.
- `transfer` (obrigatório se `kind = transfer`): `{ id, direction: "in"|"out", counterpartAccountId }` — as duas pernas compartilham `id`.
- `cardPayment` (obrigatório se `kind = card_payment`): `{ cardId, invoiceMonth: "YYYY-MM" }`.
- `investment` (obrigatório se `kind = investment`): `{ assetId, direction: "application"|"redemption" }`.
- `amount` é sempre positivo.

Faturas **não** são um recurso: são derivadas das compras e dos pagamentos.

## Escrita (Fase 4)

Identificadores são gerados no cliente (UUID v4) e as gravações são "cria ou
substitui" — idempotentes. Regras de negócio: [ADR 0007](./adr/0007-regras-financeiras-e-contabilizacao.md)
e [ADR 0009](./adr/0009-escrita-recorrencias-e-historico.md). O backend deve
revalidar tudo (o cliente não é barreira de segurança).

| Método | Caminho                            | Corpo                                                                                                      | Observações                                                                                                                                  |
| ------ | ---------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/transactions/{id}`               | —                                                                                                          | `404` → inexistente                                                                                                                          |
| POST   | `/transactions/batch`              | `{ upsert: Transação[], remove: string[], upsertRecurrences: Recorrência[], removeRecurrences: string[] }` | **Atômico** (tudo ou nada). Usado em transferências, parcelamentos, recorrências e mudanças de situação. `422` com `errors[]` para validação |
| GET    | `/recurrences`                     | —                                                                                                          | Lista de recorrências                                                                                                                        |
| PUT    | `/accounts/{id}`                   | Conta                                                                                                      | Cria ou substitui (inclui `archived`)                                                                                                        |
| GET    | `/accounts/{id}`                   | —                                                                                                          | `404` → inexistente                                                                                                                          |
| PUT    | `/categories/{id}`                 | Categoria                                                                                                  | Nome único por tipo → `409`                                                                                                                  |
| DELETE | `/categories/{id}`                 | —                                                                                                          | `409` se houver uso (lançamentos, recorrências, compras, orçamentos)                                                                         |
| GET    | `/audit-log?entityType=&entityId=` | —                                                                                                          | Histórico registrado pelo backend na mesma transação da alteração                                                                            |

### Recorrência

```json
{
  "id": "4f0c…",
  "frequency": "monthly",
  "startDate": "2026-01-10",
  "endDate": null,
  "template": {
    "kind": "expense",
    "description": "Aluguel",
    "amount": "2200.00",
    "accountId": "acc-1",
    "categoryId": "cat-moradia",
    "tags": [],
    "notes": null
  },
  "excludedDates": ["2026-03-10"]
}
```

`frequency`: `daily` | `weekly` | `biweekly` (15 dias) | `monthly` | `bimonthly` |
`quarterly` | `semiannual` | `yearly`. Ocorrências usam o id
`${recurrenceId}_${YYYY-MM-DD}`; o backend pode materializá-las por conta própria
desde que respeite esse formato (evita duplicidade com o cliente).

### Histórico (`AuditEntry`)

```json
{
  "id": "…",
  "entityType": "transaction",
  "entityId": "tx-123",
  "action": "paid",
  "at": "2026-11-11T14:30:00-03:00",
  "summary": "Pago em 11/11/2026."
}
```

`action`: `created` | `updated` | `deleted` | `cancelled` | `paid` | `unpaid` | `archived` | `restored`.

## Escrita (Fase 5)

Regras: [ADR 0007](./adr/0007-regras-financeiras-e-contabilizacao.md) e
[ADR 0010](./adr/0010-cartoes-orcamentos-e-notificacoes.md). Ids gerados no
cliente; `PUT` cria ou substitui (idempotente). Faturas continuam **derivadas**
(não são recurso).

| Método | Caminho                        | Corpo                                  | Observações                                                                                                                                     |
| ------ | ------------------------------ | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/credit-cards/{id}`           | —                                      | `404` → inexistente                                                                                                                             |
| PUT    | `/credit-cards/{id}`           | Cartão                                 | Cria/edita; inclui `status` (`active`/`blocked`/`cancelled`). `422` para dias fora de 1–31 ou limite ≤ 0                                        |
| DELETE | `/credit-cards/{id}`           | —                                      | `409` se houver compras ou pagamentos (cancelar em vez de excluir)                                                                              |
| GET    | `/credit-cards/purchases/{id}` | —                                      | `404` → inexistente                                                                                                                             |
| PUT    | `/credit-cards/purchases/{id}` | Compra                                 | Cria/edita/cancela (`status: "cancelled"`). `422`: cartão inativo, data futura, 1–48 parcelas, **limite insuficiente**                          |
| POST   | `/transactions/batch`          | `{ upsert: [Transação card_payment] }` | Pagamento de fatura (total, parcial ou antecipado) e estorno (`status: "cancelled"`). `422` se exceder o saldo em aberto ou a fatura for futura |
| GET    | `/budgets/{id}`                | —                                      | `404` → inexistente                                                                                                                             |
| PUT    | `/budgets/{id}`                | Orçamento                              | `409` se já houver orçamento **ativo** para a mesma categoria (ou geral) e período                                                              |
| DELETE | `/budgets/{id}`                | —                                      | Remove o orçamento (lançamentos não são afetados)                                                                                               |

Histórico (`/audit-log`): `entityType` passa a aceitar também `credit_card`,
`card_purchase` e `budget`.

## Escrita (Fase 6)

Regras: [ADR 0011](./adr/0011-metas-e-planejamento.md). Planejamento e projeções
**não** têm endpoints: são calculados no cliente a partir dos recursos existentes.

| Método | Caminho                     | Corpo  | Observações                                                                                                                                              |
| ------ | --------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/goals/{id}`               | —      | `404` → inexistente                                                                                                                                      |
| PUT    | `/goals/{id}`               | Meta   | Cria/edita; inclui `status` (`active`/`completed`/`cancelled`). `422`: valor ≤ 0, data final ≤ inicial, conta arquivada                                  |
| DELETE | `/goals/{id}`               | —      | `409` se houver aportes (cancelar em vez de excluir)                                                                                                     |
| PUT    | `/goals/contributions/{id}` | Aporte | `{ id, goalId, date, amount, type: "deposit"\|"withdrawal", transferId }`. `422`: meta inativa, data futura/antes do início, retirada acima do acumulado |
| DELETE | `/goals/contributions/{id}` | —      | `409` se deixar retiradas posteriores sem saldo                                                                                                          |

**Recomendado ao backend:** aceitar o aporte com transferência em uma única
requisição (ex.: `POST /goals/{id}/contributions` com `counterpartAccountId`),
gravando a transferência e o aporte na mesma transação. Hoje o cliente grava a
transferência (`POST /transactions/batch`) e depois o aporte, desfazendo a
transferência se o aporte falhar.

Histórico (`/audit-log`): `entityType` aceita também `goal`.

## Escrita (Fase 7)

Regras: [ADR 0012](./adr/0012-investimentos-custo-medio-e-indicadores.md).

| Método | Caminho                           | Corpo        | Observações                                                                                                                                                           |
| ------ | --------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PUT    | `/investments/assets/{id}`        | Ativo        | `{ id, name, ticker, assetClass, institution, notes }`. `409` se o ticker já existir                                                                                  |
| DELETE | `/investments/assets/{id}`        | —            | `409` se houver movimentações                                                                                                                                         |
| PUT    | `/investments/movements/{id}`     | Movimentação | `{ id, assetId, type, date, quantity, amount, transactionId }`. `422`: data futura, tipo incompatível com a classe, venda acima da quantidade, resgate acima do valor |
| DELETE | `/investments/movements/{id}`     | —            | `409` se deixar vendas posteriores sem quantidade                                                                                                                     |
| PUT    | `/investments/valuations/{id}`    | Avaliação    | Uma por ativo e data. `source`: `manual` \| `estimate` (cliente) — `market_quote` só pelo backend                                                                     |
| DELETE | `/investments/valuations/{id}`    | —            |                                                                                                                                                                       |
| GET    | `/market/indicators` (**futuro**) | —            | `[{ code: "cdi"\|"ipca"\|"selic"\|"ibovespa", date, value: "10.65", unit: "percent_year"\|"percent_12m"\|"points", source }]`. `404`/`501` = indisponível             |

Lançamentos de conta gerados por movimentações usam `POST /transactions/batch`
(`kind: investment` para aplicação/resgate; `income` para proventos). Recomendado
ao backend: aceitar movimentação + lançamento em uma única requisição atômica.

Histórico (`/audit-log`): `entityType` aceita também `asset`.

## Calendário, relatórios e lembretes (Fase 8)

Regras: [ADR 0013](./adr/0013-calendario-relatorios-e-exportacao.md). Calendário e
relatórios **não** têm endpoints próprios: são derivados dos recursos existentes e
exportados no navegador (CSV/PDF). Com volume real, o backend poderá oferecer
agregações paginadas (ex.: `GET /reports/{tipo}?de=&ate=&conta=`) devolvendo a mesma
estrutura de tabela (`columns`, `rows`, `totals`, `notes`).

**Lembretes (contrato futuro — não implementado):**

| Método | Caminho                  | Corpo                       | Observações                                                      |
| ------ | ------------------------ | --------------------------- | ---------------------------------------------------------------- |
| GET    | `/reminders/preferences` | —                           | `{ channels: ["email"\|"push"], daysBefore: number, types: [] }` |
| PUT    | `/reminders/preferences` | Preferências                | Tipos: `payable`, `receivable`, `invoice`, `goal`                |
| POST   | `/push/subscriptions`    | Web Push `PushSubscription` | Registro do navegador para notificações push                     |

O cliente não agenda nem envia lembretes; os vencimentos próximos aparecem na
central de notificações (ADR 0010).
