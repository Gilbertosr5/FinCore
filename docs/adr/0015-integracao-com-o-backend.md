# ADR 0015 — Integração com o backend: regras no servidor, gravações atômicas e testes

- **Status:** Aceito
- **Data:** 12/11/2026

## Contexto

O backend (`../fincore-api`, Node.js + Fastify + Drizzle + PostgreSQL/PGlite) já
implementava os contratos de `api-contract.md`, e a integração básica tinha sido
verificada à mão (11/11/2026). Faltavam:

- regras que só o cliente aplicava (pagamento de fatura acima do saldo ou de fatura
  futura; resgate acima do valor da posição) — o cliente não é barreira de segurança;
- duas operações que o cliente gravava em **duas requisições com compensação**
  (aporte de meta + transferência; movimentação de investimento + lançamento na
  conta): se a segunda falhasse e a compensação também, sobrava um registro órfão;
- testes automatizados do modo API (adaptadores REST e fluxos ponta a ponta).

## Decisões

### 1. Regras portadas para o servidor (mesma fórmula do cliente)

- **Pagamento de fatura** (`POST /transactions/batch`, `kind: card_payment`, `paid`):
  o servidor deriva a fatura das compras (porte fiel de `invoice-schedule.ts` /
  `invoices.ts` em `fincore-api/src/modules/credit-cards/invoices.ts`: fechamento,
  "melhor dia de compra", parcelas com o centavo residual nas primeiras) e recusa com
  `422`:
  `CARD_PAYMENT_FUTURE_DATE` (data de pagamento futura), `INVOICE_NOT_OPEN` (mês depois
  da fatura aberta), `INVOICE_NOT_PAYABLE` (sem saldo em aberto) e
  `CARD_PAYMENT_EXCEEDS_OUTSTANDING` (valor acima do saldo — a mensagem traz o saldo).
  Pagamentos do mesmo lote somam entre si; estornos/remoções no lote liberam saldo.
  Só é revalidado o pagamento que **passa a liquidar mais** (novo, reativado, valor
  maior ou outra fatura) — regravar um pagamento antigo (ex.: trocar a descrição)
  continua aceito mesmo que as compras tenham mudado depois.
- **Resgate** (`type: redemption`): recusado com `422 MOVEMENT_EXCEEDS_POSITION` se o
  valor exceder o valor da posição na data (porte de `computePosition` em
  `fincore-api/src/modules/investments/position.ts`: última avaliação + fluxo
  posterior; sem avaliação, custo médio).

### 2. Gravações atômicas (contrato estendido, compatível com o anterior)

- `PUT /goals/contributions/{id}` aceita `transactions: [Transação, Transação]` — as
  duas pernas da transferência (`transfer.id = transferId`; a perna da conta da meta
  é a de entrada no aporte e a de saída na retirada). Aporte e pernas são gravados na
  **mesma transação do banco** (`422 CONTRIBUTION_TRANSFER_MISMATCH` se não
  corresponderem).
- `PUT /investments/movements/{id}` aceita `transaction: Transação | null` — o
  lançamento da conta (`id = transactionId`, mesmo valor, pago na data;
  `investment`/aplicação ou resgate do mesmo ativo; `income` para proventos;
  `422 MOVEMENT_TRANSACTION_MISMATCH` caso contrário).
- `DELETE` de aporte/movimentação remove também o(s) lançamento(s) vinculado(s), na
  mesma transação (se ainda existirem — o usuário pode tê-los excluído antes).
- Os lançamentos passam pelas **mesmas validações** do lote (`applyBatch`), inclusive
  as de pagamento de fatura, e entram no histórico.
- Sem os campos novos, os endpoints se comportam como antes.

**Por que estender o `PUT` em vez de um endpoint novo** (ex.: `POST
/goals/{id}/contributions`): mantém o padrão "cria ou substitui" idempotente por id
gerado no cliente (ADR 0009), um só recurso por entidade e nenhuma rota nova a
proteger/documentar.

### 3. No frontend: preparar em vez de gravar

- Os casos de uso de metas e investimentos não chamam mais "grava a transferência /
  o lançamento e, se der erro, desfaz". As portas (`GoalTransferPort`,
  `InvestmentLedgerPort`) agora **validam e montam** os lançamentos sem gravar
  (`prepare` / `prepareRemoval`, implementados por `CreateTransferUseCase` e
  `InvestmentLedgerCommands`); o repositório da feature grava tudo de uma vez.
- `GoalRepository.saveContribution(contribution, transferLegs)` e
  `InvestmentRepository.saveMovement(movement, linked)`:
  - **API**: uma única requisição (o servidor garante o "tudo ou nada");
  - **demonstração**: um único `store.write` do Dexie (transação do IndexedDB).
- O histórico do cliente (modo demonstração) é registrado depois da gravação
  (`confirm`). No modo API o servidor grava o histórico na mesma transação.

### 4. Testes do modo API

- **Adaptadores REST** (`src/app/composition/api-repositories.test.ts`): todos os
  `Api*Repository` montados por `createDataLayer({ source: 'api' })` sobre um HTTP falso
  (`tests/helpers/fake-http-adapter.ts`) — formato das requisições, validação Zod das
  respostas, `404` → `null`, `422` com `code` e `errors[]`, `409` → erro de domínio,
  `401` → renovação ou sessão expirada, `429` com `Retry-After`, `5xx` sem detalhes
  internos e `501` dos indicadores como "indisponível".
- **E2E no modo API** (`playwright.api.config.ts`, `tests/e2e-api/`,
  `npm run test:e2e:api`): sobe a `fincore-api` com **PGlite em memória** (porta 8090,
  banco vazio a cada execução) e o build `--mode api` em `vite preview` (porta 4180,
  proxy `/api` → mesma origem). Cada teste cadastra o próprio usuário. Fluxos:
  cadastro/logout/login com cookie HttpOnly, despesa recorrente, transferência,
  cartão + compra parcelada + pagamento de fatura, orçamento, meta com transferência,
  investimento debitando conta, relatório + CSV, busca Ctrl+K e exportação JSON
  (conteúdo conferido). Desktop e celular.
- **Backend** (`fincore-api/tests/integrity.test.ts`): calendário de faturas e valor
  da posição (unitários) e as regras/endpoints acima contra HTTP + PGlite.

### 5. Correção encontrada pelos testes

`moneyField` (`src/lib/schemas/record-fields.ts`) passou a usar `abort: true` na
regex: com um valor inválido vindo da API, o Zod 4 ainda rodava os refinamentos do
objeto (`record.amount.isNegative()`) sobre a **string** e a falha virava `TypeError`
em vez de `DataIntegrityError`.

## Consequências

- Não existe mais a janela em que um aporte/movimentação ficava sem o lançamento (ou
  o contrário) por falha de rede entre duas requisições.
- As regras de fatura e de resgate vivem em dois lugares (cliente e servidor). Os
  portes citam a origem; ao mudar uma regra, mude as duas e os testes de ambos.
- O E2E do modo API exige `npm install` em `../fincore-api` e leva ~45 s; não substitui
  o E2E do build de demonstração (acessibilidade e CSP continuam lá).
- Pendentes: paginação/filtros no servidor, `Idempotency-Key`, provedor de e-mail,
  indicadores de mercado, agregações de relatórios e busca no servidor.
