import type { Transaction } from '@/features/transactions';
import { asIsoDate, asMonthKey } from '@/lib/dates';
import { Money } from '@/lib/money';
import { DataIntegrityError } from '@/lib/schemas/parse-records';
import { ApiError } from '@/services/api/api-error';
import { createHttpClient } from '@/services/api/http-client';

import { createDataLayer } from './create-data-layer';
import {
  fakeHttpAdapter,
  type FakeAdapter,
  type FakeHandler,
} from '../../../tests/helpers/fake-http-adapter';

/**
 * Adaptadores REST (`Api*Repository`) contra um HTTP falso: formato das
 * requisições (contrato em docs/api-contract.md), validação Zod das respostas e
 * tratamento de erros 4xx/5xx — sem servidor (ADR 0015).
 */

function setup(handler: FakeHandler, options: { refreshOk?: boolean } = {}) {
  const adapter: FakeAdapter = fakeHttpAdapter(handler);
  const onUnauthorized = vi.fn();
  const http = createHttpClient({
    baseUrl: 'http://api.test/api/v1',
    timeoutMs: 5000,
    adapter,
    refreshSession: () => Promise.resolve(options.refreshOk ?? false),
    onUnauthorized,
  });
  const { repositories } = createDataLayer({
    source: 'api',
    today: () => asIsoDate('2026-11-06'),
    getHttpClient: () => http,
  });
  return { repositories, adapter, onUnauthorized };
}

const accountDto = {
  id: 'acc-1',
  name: 'Conta corrente',
  type: 'checking',
  institution: 'Banco',
  initialBalance: '1000.00',
  initialBalanceDate: '2026-01-01',
  archived: false,
};

const transactionDto = {
  id: 'tx-1',
  kind: 'expense',
  description: 'Mercado',
  amount: '150.25',
  accountId: 'acc-1',
  categoryId: null,
  competenceDate: '2026-11-05',
  dueDate: null,
  paidDate: null,
  status: 'pending',
  transfer: null,
  cardPayment: null,
  investment: null,
  recurrenceId: null,
  installment: null,
  tags: [],
  notes: null,
};

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    kind: 'expense',
    description: 'Mercado',
    amount: Money.of('150.25'),
    accountId: 'acc-1',
    categoryId: null,
    competenceDate: asIsoDate('2026-11-05'),
    dueDate: null,
    paidDate: null,
    status: 'pending',
    transfer: null,
    cardPayment: null,
    investment: null,
    recurrenceId: null,
    installment: null,
    tags: [],
    notes: null,
    ...overrides,
  };
}

const problem = (status: number, body: Record<string, unknown>, headers = {}) => ({
  status,
  data: { type: 'https://fincore.app/problems/x', title: 'Erro', status, ...body },
  headers: { 'content-type': 'application/problem+json', ...headers },
});

describe('Api*Repository — leitura e validação das respostas', () => {
  it('converte os DTOs em entidades (dinheiro como Money)', async () => {
    const { repositories, adapter } = setup((config) =>
      config.url === '/accounts'
        ? { status: 200, data: [accountDto] }
        : { status: 200, data: [transactionDto] },
    );
    const [account] = await repositories.accounts.findAll();
    expect(account?.initialBalance.toString()).toBe('1000.00');
    const [tx] = await repositories.transactions.findAll();
    expect(tx?.amount.toString()).toBe('150.25');
    expect(adapter.calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      'GET /accounts',
      'GET /transactions',
    ]);
  });

  it('recusa resposta fora do contrato (DataIntegrityError), sem dados parciais', async () => {
    const { repositories } = setup(() => ({
      status: 200,
      data: [transactionDto, { ...transactionDto, id: 'tx-2', amount: 'cento e dez' }],
    }));
    await expect(repositories.transactions.findAll()).rejects.toBeInstanceOf(DataIntegrityError);
  });

  it('findById devolve null em 404 e propaga outros erros', async () => {
    const { repositories } = setup((config) =>
      config.url === '/transactions/inexistente'
        ? problem(404, { detail: 'Lançamento não encontrado.' })
        : problem(500, { detail: 'stack trace interno' }),
    );
    await expect(repositories.transactions.findById('inexistente')).resolves.toBeNull();
    const failure = repositories.goals.findById('qualquer');
    await expect(failure).rejects.toBeInstanceOf(ApiError);
    await expect(failure).rejects.toMatchObject({
      kind: 'server',
      message: 'Ocorreu um erro no servidor. Tente novamente em instantes.',
    });
  });
});

describe('Api*Repository — formato das gravações', () => {
  it('lote de lançamentos vai em uma única requisição', async () => {
    const { repositories, adapter } = setup(() => ({ status: 204 }));
    await repositories.transactions.commit({ upsert: [transaction()], remove: ['tx-0'] });
    expect(adapter.calls).toEqual([
      {
        method: 'POST',
        url: '/transactions/batch',
        body: {
          upsert: [transactionDto],
          remove: ['tx-0'],
          upsertRecurrences: [],
          removeRecurrences: [],
        },
      },
    ]);
  });

  it('aporte de meta leva as pernas da transferência no mesmo PUT', async () => {
    const { repositories, adapter } = setup(() => ({ status: 200 }));
    const legs = (['out', 'in'] as const).map((direction) =>
      transaction({
        id: `tr_${direction}`,
        kind: 'transfer',
        accountId: direction === 'out' ? 'acc-1' : 'acc-2',
        transfer: {
          id: 'tr',
          direction,
          counterpartAccountId: direction === 'out' ? 'acc-2' : 'acc-1',
        },
      }),
    );
    await repositories.goals.saveContribution(
      {
        id: 'c-1',
        goalId: 'g-1',
        date: asIsoDate('2026-11-05'),
        amount: Money.of('150.25'),
        type: 'deposit',
        transferId: 'tr',
      },
      legs,
    );
    await repositories.goals.removeContribution('c-1', ['tr_out', 'tr_in']);
    const [put, del] = adapter.calls;
    expect(put).toMatchObject({ method: 'PUT', url: '/goals/contributions/c-1' });
    expect(put?.body).toMatchObject({
      id: 'c-1',
      amount: '150.25',
      transferId: 'tr',
      transactions: [
        { id: 'tr_out', kind: 'transfer', amount: '150.25' },
        { id: 'tr_in', kind: 'transfer' },
      ],
    });
    // O servidor remove as pernas na mesma transação: só um DELETE.
    expect(del).toMatchObject({ method: 'DELETE', url: '/goals/contributions/c-1' });
    expect(adapter.calls).toHaveLength(2);
  });

  it('movimentação de investimento leva o lançamento no mesmo PUT', async () => {
    const { repositories, adapter } = setup(() => ({ status: 200 }));
    const movement = {
      id: 'm-1',
      assetId: 'cdb',
      type: 'contribution' as const,
      date: asIsoDate('2026-11-05'),
      quantity: null,
      amount: Money.of('500'),
      transactionId: 'tx-9',
    };
    await repositories.investments.saveMovement(
      movement,
      transaction({
        id: 'tx-9',
        kind: 'investment',
        amount: Money.of('500'),
        investment: { assetId: 'cdb', direction: 'application' },
      }),
    );
    await repositories.investments.saveMovement({ ...movement, id: 'm-2', transactionId: null });
    expect(adapter.calls[0]?.body).toMatchObject({
      id: 'm-1',
      amount: '500.00',
      transactionId: 'tx-9',
      transaction: { id: 'tx-9', kind: 'investment', investment: { direction: 'application' } },
    });
    expect(adapter.calls[1]?.body).toMatchObject({ id: 'm-2', transaction: null });
  });

  it('pagamento de fatura usa o mês da fatura no formato YYYY-MM', async () => {
    const { repositories, adapter } = setup(() => ({ status: 204 }));
    await repositories.transactions.commit({
      upsert: [
        transaction({
          kind: 'card_payment',
          status: 'paid',
          paidDate: asIsoDate('2026-11-05'),
          cardPayment: { cardId: 'card-1', invoiceMonth: asMonthKey('2026-11') },
        }),
      ],
    });
    expect(adapter.calls[0]?.body).toMatchObject({
      upsert: [{ cardPayment: { cardId: 'card-1', invoiceMonth: '2026-11' } }],
    });
  });
});

describe('Api*Repository — erros', () => {
  it('422 preserva código e erros por campo do Problem Details', async () => {
    const { repositories } = setup(() =>
      problem(422, {
        detail: 'O valor excede o saldo em aberto da fatura (R$ 50,00).',
        code: 'CARD_PAYMENT_EXCEEDS_OUTSTANDING',
        errors: [{ field: 'upsert[0].amount', message: 'O valor excede o saldo em aberto.' }],
      }),
    );
    await expect(
      repositories.transactions.commit({ upsert: [transaction()] }),
    ).rejects.toMatchObject({
      kind: 'validation',
      code: 'CARD_PAYMENT_EXCEEDS_OUTSTANDING',
      message: 'O valor excede o saldo em aberto da fatura (R$ 50,00).',
      fieldErrors: [{ field: 'upsert[0].amount', message: 'O valor excede o saldo em aberto.' }],
    });
  });

  it('409 na exclusão de categoria vira erro de domínio (categoria em uso)', async () => {
    const { repositories } = setup(() =>
      problem(409, { detail: 'Categoria em uso.', code: 'CATEGORY_IN_USE' }),
    );
    await expect(repositories.categories.remove('food')).rejects.toMatchObject({
      code: 'category_in_use',
    });
  });

  it('401 sem renovação possível notifica sessão expirada', async () => {
    const { repositories, onUnauthorized, adapter } = setup(() => problem(401, {}));
    await expect(repositories.budgets.findAll()).rejects.toMatchObject({ kind: 'unauthorized' });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(adapter.calls.map((call) => call.url)).toEqual(['/budgets']);
  });

  it('401 com sessão renovada repete a requisição e não expira a sessão', async () => {
    let first = true;
    const { repositories, onUnauthorized } = setup(
      () => {
        if (first) {
          first = false;
          return problem(401, {});
        }
        return { status: 200, data: [] };
      },
      { refreshOk: true },
    );
    await expect(repositories.creditCards.findAll()).resolves.toEqual([]);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('429 informa quando tentar de novo (Retry-After)', async () => {
    const { repositories } = setup(() => problem(429, {}, { 'retry-after': '30' }));
    await expect(repositories.investments.findAssets()).rejects.toMatchObject({
      kind: 'rate_limited',
      retryAfterSeconds: 30,
    });
  });

  it('indicadores de mercado: 501 vira "indisponível", não erro', async () => {
    const { repositories } = setup(() =>
      problem(501, { code: 'MARKET_DATA_UNAVAILABLE', detail: 'Sem provedor.' }),
    );
    await expect(repositories.market.findLatest()).resolves.toMatchObject({ available: false });
  });
});
