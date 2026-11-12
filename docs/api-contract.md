# Contrato HTTP com o backend (rascunho)

> **Status:** o backend (Java + Spring Boot + PostgreSQL) **ainda não existe**.
> Este documento define as convenções que o frontend espera. Nenhum endpoint
> descrito aqui está disponível. Os contratos de cada módulo serão adicionados
> nas fases correspondentes (autenticação na Fase 2).

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
