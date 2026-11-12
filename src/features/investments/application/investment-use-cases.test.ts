import { countsAsExpense, countsAsIncome } from '@/features/transactions';
import { asIsoDate } from '@/lib/dates';
import { Money } from '@/lib/money';

import type { MovementInput } from './investment-use-cases';
import { createInMemoryInvestments } from '../../../../tests/helpers/in-memory-investments';

/* Hoje = 10/03/2026; corrente R$ 1.000, poupança R$ 0, "old" arquivada. */

const brl = (value: string) => Money.of(value);
const d = asIsoDate;

const buy = (overrides: Partial<MovementInput> = {}): MovementInput => ({
  assetId: 'itsa',
  type: 'buy',
  date: d('2026-03-02'),
  amount: brl('100'),
  quantity: '10',
  accountId: null,
  categoryId: null,
  ...overrides,
});

describe('cadastro de ativos', () => {
  it('cria ativo normalizando o código e impede código duplicado', async () => {
    const env = createInMemoryInvestments({ assets: [] });
    const asset = await env.investments.createAsset.execute({
      name: '  Petrobras  PN ',
      ticker: ' petr4 ',
      assetClass: 'stocks',
      institution: 'Corretora',
      notes: '',
    });
    expect(asset).toMatchObject({ name: 'Petrobras PN', ticker: 'PETR4', notes: null });
    await expect(
      env.investments.createAsset.execute({
        name: 'Outro',
        ticker: 'PETR4',
        assetClass: 'stocks',
        institution: '',
        notes: null,
      }),
    ).rejects.toMatchObject({ code: 'duplicate_ticker' });
    await expect(
      env.investments.createAsset.execute({
        name: 'X',
        ticker: null,
        assetClass: 'cdb',
        institution: '',
        notes: null,
      }),
    ).rejects.toMatchObject({ code: 'invalid_name' });
    expect(env.state.auditLog.at(-1)?.entityType).toBe('asset');
  });

  it('só exclui ativos sem movimentações (avaliações saem junto)', async () => {
    const env = createInMemoryInvestments();
    await env.investments.recordMovement.execute(buy());
    await expect(env.investments.deleteAsset.execute('itsa')).rejects.toMatchObject({
      code: 'asset_in_use',
    });
    await env.investments.recordValuation.execute({
      assetId: 'cdb',
      date: d('2026-03-01'),
      value: brl('10'),
      source: 'manual',
    });
    await env.investments.deleteAsset.execute('cdb');
    expect(env.store.assets.has('cdb')).toBe(false);
    expect(env.store.valuations.size).toBe(0);
  });

  it('não muda a classe se as movimentações ficarem incompatíveis', async () => {
    const env = createInMemoryInvestments();
    await env.investments.recordMovement.execute(buy());
    await expect(
      env.investments.updateAsset.execute('itsa', {
        name: 'Itaúsa',
        ticker: 'ITSA4',
        assetClass: 'cdb',
        institution: '',
        notes: null,
      }),
    ).rejects.toMatchObject({ code: 'invalid_type' });
  });
});

describe('movimentações', () => {
  it('compra com conta gera aplicação (kind investment): saldo cai, sem despesa', async () => {
    const env = createInMemoryInvestments();
    const { movement } = await env.investments.recordMovement.execute(
      buy({ accountId: 'checking', amount: brl('250'), quantity: '25' }),
    );
    expect(movement.transactionId).not.toBeNull();
    expect((await env.balanceOf('checking')).toString()).toBe('750.00');
    const [tx] = [...env.state.transactions.values()];
    expect(tx).toMatchObject({
      kind: 'investment',
      investment: { assetId: 'itsa', direction: 'application' },
      description: 'Aplicação — ITSA4',
    });
    expect(tx && (countsAsIncome(tx) || countsAsExpense(tx))).toBe(false);
  });

  it('venda com conta credita o valor (resgate) e calcula o realizado', async () => {
    const env = createInMemoryInvestments();
    await env.investments.recordMovement.execute(buy({ amount: brl('100'), quantity: '10' }));
    await env.investments.recordMovement.execute(
      buy({
        type: 'sell',
        amount: brl('80'),
        quantity: '5',
        date: d('2026-03-05'),
        accountId: 'checking',
      }),
    );
    expect((await env.balanceOf('checking')).toString()).toBe('1080.00');
    const { position } = await env.investments.details.execute('itsa');
    expect(position.quantity).toBe('5');
    expect(position.costBasis.toString()).toBe('50.00');
    expect(position.realizedResult.toString()).toBe('30.00');
  });

  it('proventos com conta viram receita na categoria escolhida', async () => {
    const env = createInMemoryInvestments();
    await env.investments.recordMovement.execute(buy());
    await env.investments.recordMovement.execute({
      ...buy(),
      type: 'dividend',
      amount: brl('12.50'),
      quantity: null,
      accountId: 'checking',
      categoryId: 'yields',
    });
    const income = [...env.state.transactions.values()].find((tx) => tx.kind === 'income');
    expect(income).toMatchObject({ categoryId: 'yields', description: 'Dividendos — ITSA4' });
    expect(income && countsAsIncome(income)).toBe(true);
    await expect(
      env.investments.recordMovement.execute({
        ...buy(),
        type: 'dividend',
        quantity: null,
        accountId: 'checking',
        categoryId: 'food',
      }),
    ).rejects.toMatchObject({ code: 'category_mismatch' });
  });

  it.each([
    [{ type: 'contribution' as const }, 'invalid_type'],
    [{ quantity: null }, 'invalid_quantity'],
    [{ quantity: '0' }, 'invalid_quantity'],
    [{ quantity: '1.123456789' }, 'invalid_quantity'],
    [{ amount: brl('0') }, 'invalid_amount'],
    [{ date: d('2026-03-11') }, 'in_future'],
  ])('rejeita compra %o', async (override, code) => {
    const env = createInMemoryInvestments();
    await expect(env.investments.recordMovement.execute(buy(override))).rejects.toMatchObject({
      code,
    });
  });

  it('não vende mais do que há em carteira, nem retroativamente', async () => {
    const env = createInMemoryInvestments();
    await env.investments.recordMovement.execute(buy({ quantity: '10' }));
    await expect(
      env.investments.recordMovement.execute(
        buy({ type: 'sell', quantity: '10.5', date: d('2026-03-05') }),
      ),
    ).rejects.toMatchObject({ code: 'insufficient_quantity' });
    await expect(
      env.investments.recordMovement.execute(
        buy({ type: 'sell', quantity: '1', date: d('2026-03-01') }),
      ),
    ).rejects.toMatchObject({ code: 'insufficient_quantity' });
  });

  it('excluir compra que sustenta uma venda posterior é recusado', async () => {
    const env = createInMemoryInvestments();
    const { movement } = await env.investments.recordMovement.execute(buy({ quantity: '10' }));
    await env.investments.recordMovement.execute(
      buy({ type: 'sell', quantity: '4', date: d('2026-03-05') }),
    );
    await expect(env.investments.removeMovement.execute(movement.id)).rejects.toMatchObject({
      code: 'insufficient_quantity',
    });
  });

  it('renda fixa: aporte/resgate sem quantidade; resgate limitado ao valor da posição', async () => {
    const env = createInMemoryInvestments();
    const base = {
      assetId: 'cdb',
      date: d('2026-03-01'),
      quantity: null,
      accountId: null,
      categoryId: null,
    };
    await expect(
      env.investments.recordMovement.execute({ ...base, type: 'buy', amount: brl('100') }),
    ).rejects.toMatchObject({ code: 'invalid_type' });
    await env.investments.recordMovement.execute({
      ...base,
      type: 'contribution',
      amount: brl('1000'),
    });
    await expect(
      env.investments.recordMovement.execute({
        ...base,
        type: 'redemption',
        amount: brl('1000.01'),
        date: d('2026-03-05'),
      }),
    ).rejects.toMatchObject({ code: 'insufficient_value' });
    await env.investments.recordValuation.execute({
      assetId: 'cdb',
      date: d('2026-03-04'),
      value: brl('1020'),
      source: 'manual',
    });
    await env.investments.recordMovement.execute({
      ...base,
      type: 'redemption',
      amount: brl('1020'),
      date: d('2026-03-05'),
    });
    const { position } = await env.investments.details.execute('cdb');
    expect(position.costBasis.isZero()).toBe(true);
    expect(position.realizedResult.toString()).toBe('20.00');
  });

  it('taxas e impostos não podem movimentar conta', async () => {
    const env = createInMemoryInvestments();
    await expect(
      env.investments.recordMovement.execute({
        ...buy(),
        type: 'fee',
        quantity: null,
        accountId: 'checking',
      }),
    ).rejects.toMatchObject({ code: 'account_not_supported' });
  });

  it('movimentação e lançamento são gravados juntos: se a gravação falhar, nenhum dos dois fica', async () => {
    const env = createInMemoryInvestments();
    env.failures.saveMovement = true;
    await expect(
      env.investments.recordMovement.execute(buy({ accountId: 'checking' })),
    ).rejects.toThrow('falha simulada');
    expect(env.state.transactions.size).toBe(0);
    expect((await env.balanceOf('checking')).toString()).toBe('1000.00');
  });

  it('excluir a movimentação remove o lançamento vinculado', async () => {
    const env = createInMemoryInvestments();
    const { movement } = await env.investments.recordMovement.execute(
      buy({ accountId: 'checking' }),
    );
    await env.investments.removeMovement.execute(movement.id);
    expect(env.state.transactions.size).toBe(0);
    expect((await env.balanceOf('checking')).toString()).toBe('1000.00');
  });

  it('o lançamento gerado é gerenciado: Transações não consegue editá-lo', async () => {
    const env = createInMemoryInvestments();
    const { movement } = await env.investments.recordMovement.execute(
      buy({ accountId: 'checking' }),
    );
    await expect(env.ledger.cancel.execute(movement.transactionId ?? '')).rejects.toMatchObject({
      code: 'not_editable',
    });
  });
});

describe('avaliações e sugestão de reavaliação', () => {
  it('sugere o valor ajustado quando a operação é anterior à última avaliação', async () => {
    const env = createInMemoryInvestments();
    await env.investments.recordMovement.execute(buy({ date: d('2026-03-01') }));
    await env.investments.recordValuation.execute({
      assetId: 'itsa',
      date: d('2026-03-08'),
      value: brl('130'),
      source: 'manual',
    });
    const { revaluation } = await env.investments.recordMovement.execute(
      buy({ date: d('2026-03-05'), amount: brl('50'), quantity: '5' }),
    );
    expect(revaluation).toMatchObject({ assetId: 'itsa', date: '2026-03-08' });
    expect(revaluation?.suggestedValue.toString()).toBe('180.00');

    // Operação posterior à avaliação: entra no valor atual sozinha (sem sugestão).
    const later = await env.investments.recordMovement.execute(
      buy({ date: d('2026-03-09'), amount: brl('20'), quantity: '2' }),
    );
    expect(later.revaluation).toBeNull();
    const { position } = await env.investments.details.execute('itsa');
    expect(position.currentValue.toString()).toBe('150.00');
    expect(position.adjustedSinceValuation).toBe(true);
  });

  it('uma avaliação por data: registrar de novo substitui', async () => {
    const env = createInMemoryInvestments();
    const input = { assetId: 'cdb', date: d('2026-03-01'), source: 'manual' as const };
    const first = await env.investments.recordValuation.execute({ ...input, value: brl('10') });
    const second = await env.investments.recordValuation.execute({
      ...input,
      value: brl('12'),
      source: 'estimate',
    });
    expect(second.id).toBe(first.id);
    expect(env.store.valuations.size).toBe(1);
    await expect(
      env.investments.recordValuation.execute({ ...input, date: d('2026-04-01'), value: brl('1') }),
    ).rejects.toMatchObject({ code: 'in_future' });
  });
});

describe('visão da carteira', () => {
  it('resume posições, participação, ativos sem posição e proventos', async () => {
    const env = createInMemoryInvestments();
    await env.investments.recordMovement.execute(buy({ amount: brl('300'), quantity: '30' }));
    await env.investments.recordMovement.execute({
      ...buy(),
      type: 'dividend',
      amount: brl('9'),
      quantity: null,
    });
    await env.investments.recordValuation.execute({
      assetId: 'itsa',
      date: d('2026-03-09'),
      value: brl('330'),
      source: 'manual',
    });
    const overview = await env.investments.portfolio.execute();
    expect(overview.summary.currentValue.toString()).toBe('330.00');
    expect(overview.summary.totalReturn.toString()).toBe('39.00');
    expect(overview.positions[0]?.share).toBe(100);
    expect(overview.inactiveAssets.map((asset) => asset.id)).toEqual(['cdb']);
    expect(overview.incomeByMonth.at(-1)?.amount.toString()).toBe('9.00');
    expect(overview.evolution).toHaveLength(12);
    expect((await env.investments.market.execute()).available).toBe(false);
  });
});
