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

  it('usa a avaliação mais recente até a data', () => {
    const position = computePosition(cdb, movements, valuations, d('2026-02-28'));
    expect(position.currentValue.toString()).toBe('1010.00');
    expect(position.valuationDate).toBe('2026-01-31');
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
