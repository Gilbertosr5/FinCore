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
