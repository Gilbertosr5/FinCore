import type { IsoDate } from '@/lib/dates';
import { Money } from '@/lib/money';

import type {
  Asset,
  AssetClass,
  AssetValuation,
  InvestmentMovement,
  ValuationSource,
} from '../entities/investment';

/**
 * Cálculos de carteira — versão inicial (detalhes e limitações em docs/adr/0007).
 *
 * - Valor aplicado líquido = aportes + compras + taxas − vendas − resgates.
 *   É um fluxo de capital, não custo médio contábil (custo médio entra na Fase 7).
 * - Valor atual = avaliação mais recente até a data. Sem avaliação, usa-se o
 *   valor aplicado, sinalizado como origem "cost" (não é rentabilidade real).
 * - Proventos = dividendos + juros + rendimentos − impostos sobre eles.
 */

const INFLOW_TYPES = new Set(['contribution', 'buy', 'fee']);
const OUTFLOW_TYPES = new Set(['sell', 'redemption']);
const INCOME_TYPES = new Set(['dividend', 'interest', 'income']);

export interface Position {
  asset: Asset;
  netInvested: Money;
  currentValue: Money;
  valueSource: ValuationSource | 'cost';
  valuationDate: IsoDate | null;
  incomeReceived: Money;
}

export function computePosition(
  asset: Asset,
  movements: readonly InvestmentMovement[],
  valuations: readonly AssetValuation[],
  asOf: IsoDate,
): Position {
  const own = movements.filter((item) => item.assetId === asset.id && item.date <= asOf);
  const zero = Money.zero();

  let netInvested = zero;
  let incomeReceived = zero;
  for (const movement of own) {
    if (INFLOW_TYPES.has(movement.type)) netInvested = netInvested.add(movement.amount);
    else if (OUTFLOW_TYPES.has(movement.type)) netInvested = netInvested.subtract(movement.amount);
    else if (INCOME_TYPES.has(movement.type)) incomeReceived = incomeReceived.add(movement.amount);
    else incomeReceived = incomeReceived.subtract(movement.amount); // tax
  }

  const latest = valuations
    .filter((item) => item.assetId === asset.id && item.date <= asOf)
    .reduce<AssetValuation | null>(
      (best, item) => (best === null || item.date > best.date ? item : best),
      null,
    );

  const hasPosition = own.length > 0;
  return {
    asset,
    netInvested: netInvested.max(zero),
    currentValue: latest ? latest.value : hasPosition ? netInvested.max(zero) : zero,
    valueSource: latest ? latest.source : 'cost',
    valuationDate: latest?.date ?? null,
    incomeReceived,
  };
}

export interface PortfolioSummary {
  positions: Position[];
  netInvested: Money;
  currentValue: Money;
  /** Resultado = valor atual − aplicado líquido (não inclui proventos já recebidos). */
  result: Money;
  /** Percentual do resultado sobre o aplicado; null se nada aplicado. */
  resultPercent: number | null;
  incomeReceived: Money;
  byClass: { assetClass: AssetClass; value: Money }[];
  /** Há posições sem avaliação ou com valor estimado. */
  hasEstimatedValues: boolean;
}

export function computePortfolio(
  assets: readonly Asset[],
  movements: readonly InvestmentMovement[],
  valuations: readonly AssetValuation[],
  asOf: IsoDate,
): PortfolioSummary {
  const positions = assets
    .map((asset) => computePosition(asset, movements, valuations, asOf))
    .filter((position) => !position.currentValue.isZero() || !position.netInvested.isZero());

  const netInvested = Money.sum(positions.map((item) => item.netInvested));
  const currentValue = Money.sum(positions.map((item) => item.currentValue));
  const result = currentValue.subtract(netInvested);
  const percent = result.percentageOf(netInvested);

  const classTotals = new Map<AssetClass, Money>();
  for (const position of positions) {
    const key = position.asset.assetClass;
    classTotals.set(key, (classTotals.get(key) ?? Money.zero()).add(position.currentValue));
  }

  return {
    positions,
    netInvested,
    currentValue,
    result,
    resultPercent: percent === null ? null : percent.toNumber(),
    incomeReceived: Money.sum(positions.map((item) => item.incomeReceived)),
    byClass: [...classTotals.entries()]
      .map(([assetClass, value]) => ({ assetClass, value }))
      .sort((a, b) => b.value.compare(a.value)),
    hasEstimatedValues: positions.some(
      (item) => item.valueSource === 'cost' || item.valueSource === 'estimate',
    ),
  };
}
