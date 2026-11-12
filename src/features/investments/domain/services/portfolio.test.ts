import { asIsoDate } from '@/lib/dates';
import { Money } from '@/lib/money';

import { computePortfolio, computePosition } from './portfolio';
import type { Asset, AssetValuation, InvestmentMovement } from '../entities/investment';

const d = asIsoDate;
const cdb: Asset = {
  id: 'cdb',
  name: 'CDB',
  ticker: null,
  assetClass: 'cdb',
  institution: 'X',
  notes: null,
};
const stock: Asset = {
  id: 'itsa',
  name: 'Itaúsa',
  ticker: 'ITSA4',
  assetClass: 'stocks',
  institution: 'X',
  notes: null,
};

const movement = (
  assetId: string,
  type: InvestmentMovement['type'],
  amount: string,
  date: string,
): InvestmentMovement => ({
  id: `${assetId}-${type}-${date}`,
  assetId,
  type,
  date: d(date),
  quantity: null,
  amount: Money.of(amount),
  transactionId: null,
});

const valuation = (
  assetId: string,
  value: string,
  date: string,
  source: AssetValuation['source'] = 'manual',
): AssetValuation => ({
  id: `${assetId}-${date}`,
  assetId,
  date: d(date),
  value: Money.of(value),
  source,
});

describe('carteira de investimentos', () => {
  const movements = [
    movement('cdb', 'contribution', '1000', '2026-01-05'),
    movement('cdb', 'contribution', '500', '2026-02-05'),
    movement('cdb', 'redemption', '200', '2026-03-05'),
    movement('itsa', 'buy', '300', '2026-01-10'),
    movement('itsa', 'dividend', '12.40', '2026-02-15'),
    movement('itsa', 'tax', '1.20', '2026-02-15'),
  ];
  const valuations = [
    valuation('cdb', '1010', '2026-01-31'),
    valuation('cdb', '1340', '2026-03-31', 'estimate'),
    valuation('itsa', '330', '2026-03-31'),
  ];

  it('valor aplicado líquido = aportes + compras − resgates', () => {
    const position = computePosition(cdb, movements, valuations, d('2026-03-31'));
    expect(position.netInvested.toString()).toBe('1300.00');
    expect(position.currentValue.toString()).toBe('1340.00');
    expect(position.valueSource).toBe('estimate');
  });

  it('usa a avaliação mais recente e soma as aplicações posteriores a ela (sinalizado)', () => {
    const position = computePosition(cdb, movements, valuations, d('2026-02-28'));
    // 1.010 avaliados em 31/01 + aporte de 500 em 05/02 (pelo custo).
    expect(position.currentValue.toString()).toBe('1510.00');
    expect(position.valuationDate).toBe('2026-01-31');
    expect(position.adjustedSinceValuation).toBe(true);
  });

  it('sem avaliação usa o valor aplicado e sinaliza a origem', () => {
    const position = computePosition(stock, movements, valuations, d('2026-02-28'));
    expect(position.currentValue.toString()).toBe('300.00');
    expect(position.valueSource).toBe('cost');
  });

  it('proventos líquidos de impostos', () => {
    expect(
      computePosition(stock, movements, valuations, d('2026-03-31')).incomeReceived.toString(),
    ).toBe('11.20');
  });

  it('resume a carteira e agrupa por classe', () => {
    const summary = computePortfolio([cdb, stock], movements, valuations, d('2026-03-31'));
    expect(summary.netInvested.toString()).toBe('1600.00');
    expect(summary.currentValue.toString()).toBe('1670.00');
    expect(summary.result.toString()).toBe('70.00');
    expect(summary.resultPercent).toBeCloseTo(4.38, 2);
    expect(summary.byClass.map((item) => [item.assetClass, item.value.toString()])).toEqual([
      ['cdb', '1340.00'],
      ['stocks', '330.00'],
    ]);
    expect(summary.hasEstimatedValues).toBe(true);
  });
});

describe('custo médio e resultados (Fase 7)', () => {
  const quantityMovement = (
    type: InvestmentMovement['type'],
    amount: string,
    date: string,
    quantity: string | null,
  ): InvestmentMovement => ({
    id: `${type}-${date}-${amount}`,
    assetId: 'itsa',
    type,
    date: d(date),
    quantity,
    amount: Money.of(amount),
    transactionId: null,
  });

  it('venda baixa o custo médio proporcional e gera resultado realizado', () => {
    const movements = [
      quantityMovement('buy', '1000', '2026-01-10', '100'), // R$ 10,00
      quantityMovement('buy', '1200', '2026-02-10', '100'), // R$ 12,00 → médio 11,00
      quantityMovement('fee', '10', '2026-02-10', null), // custo 2.210 → médio 11,05
      quantityMovement('sell', '1300', '2026-03-10', '100'),
      quantityMovement('dividend', '50', '2026-03-15', null),
      quantityMovement('tax', '5', '2026-03-15', null),
    ];
    const valuations = [valuation('itsa', '1400', '2026-03-31')];
    const position = computePosition(stock, movements, valuations, d('2026-03-31'));
    expect(position.quantity).toBe('100');
    expect(position.costBasis.toString()).toBe('1105.00');
    expect(position.averagePrice?.toString()).toBe('11.05');
    // 1.300 − 1.105 de custo baixado.
    expect(position.realizedResult.toString()).toBe('195.00');
    expect(position.unrealizedResult.toString()).toBe('295.00');
    expect(position.incomeReceived.toString()).toBe('45.00');
    // 295 + 195 + 45 = 535 sobre 2.210 aplicados.
    expect(position.totalReturn.toString()).toBe('535.00');
    expect(position.totalReturnPercent).toBeCloseTo(24.21, 2);
  });

  it('venda total zera a posição, mas mantém resultado e proventos', () => {
    const movements = [
      quantityMovement('buy', '900', '2026-01-10', '3'),
      quantityMovement('sell', '1000', '2026-02-10', '3'),
    ];
    const summary = computePortfolio([stock], movements, [], d('2026-03-31'));
    expect(summary.positions).toHaveLength(0);
    expect(summary.realizedResult.toString()).toBe('100.00');
    expect(summary.totalReturn.toString()).toBe('100.00');
  });

  it('renda fixa sem quantidade: resgate abate o principal primeiro', () => {
    const movements = [
      movement('cdb', 'contribution', '1000', '2026-01-05'),
      movement('cdb', 'redemption', '400', '2026-02-05'),
      movement('cdb', 'redemption', '700', '2026-03-05'),
    ];
    const position = computePosition(cdb, movements, [], d('2026-03-31'));
    expect(position.quantity).toBeNull();
    expect(position.costBasis.isZero()).toBe(true);
    expect(position.realizedResult.toString()).toBe('100.00');
  });

  it('venda no mesmo dia da compra processa a compra primeiro', () => {
    const movements = [
      quantityMovement('sell', '60', '2026-01-10', '1'),
      quantityMovement('buy', '100', '2026-01-10', '2'),
    ];
    const position = computePosition(stock, movements, [], d('2026-01-31'));
    expect(position.quantity).toBe('1');
    expect(position.costBasis.toString()).toBe('50.00');
    expect(position.realizedResult.toString()).toBe('10.00');
  });
});
