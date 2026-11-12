import { Decimal } from 'decimal.js';

import type { IsoDate } from '@/lib/dates';
import { Money } from '@/lib/money';

import type {
  Asset,
  AssetClass,
  AssetValuation,
  InvestmentMovement,
  InvestmentMovementType,
  ValuationSource,
} from '../entities/investment';

/**
 * Cálculos de carteira (metodologia em docs/adr/0007 e 0012).
 *
 * - Valor aplicado líquido = aportes + compras + taxas − vendas − resgates
 *   (fluxo de capital; usado no patrimônio do dashboard).
 * - Custo da posição (custo médio):
 *   · ativos com quantidade (ações, FIIs, ETFs, cripto…): compras e taxas somam
 *     ao custo; a venda baixa o custo proporcional à quantidade vendida
 *     (custo × qtd vendida ÷ qtd em carteira) e gera resultado realizado;
 *   · ativos sem quantidade (renda fixa, fundos sem cotas): aportes e taxas somam;
 *     resgates abatem primeiro o principal — o que exceder é resultado realizado.
 * - Valor atual = avaliação mais recente até a data + aplicações − retiradas
 *   POSTERIORES a ela (ajustadas pelo custo e sinalizadas). Sem avaliação, usa o
 *   custo da posição (origem "cost" — não é rentabilidade real).
 * - Proventos líquidos = dividendos + juros + rendimentos − impostos.
 * - Retorno total = (valor atual − custo) + realizado + proventos; percentual
 *   simples sobre o total aplicado (não é TWR/MWR).
 */

export const CAPITAL_IN_TYPES: ReadonlySet<InvestmentMovementType> = new Set([
  'contribution',
  'buy',
]);
export const CAPITAL_OUT_TYPES: ReadonlySet<InvestmentMovementType> = new Set([
  'sell',
  'redemption',
]);
export const INCOME_TYPES: ReadonlySet<InvestmentMovementType> = new Set([
  'dividend',
  'interest',
  'income',
]);

/** Ordem dentro do mesmo dia: entradas antes das saídas. */
const TYPE_ORDER: Record<InvestmentMovementType, number> = {
  contribution: 0,
  buy: 0,
  fee: 1,
  dividend: 2,
  interest: 2,
  income: 2,
  tax: 3,
  sell: 4,
  redemption: 4,
};

export function sortMovements(movements: readonly InvestmentMovement[]): InvestmentMovement[] {
  return [...movements].sort((a, b) =>
    a.date === b.date ? TYPE_ORDER[a.type] - TYPE_ORDER[b.type] : a.date < b.date ? -1 : 1,
  );
}

export interface Position {
  asset: Asset;
  /** Fluxo de capital: aportes + compras + taxas − vendas − resgates (≥ 0). */
  netInvested: Money;
  /** Total aplicado (aportes + compras + taxas), base do percentual de retorno. */
  totalInvested: Money;
  /** Quantidade em carteira (decimal em string); null para ativos sem quantidade. */
  quantity: string | null;
  /** Custo da posição atual pelo custo médio. */
  costBasis: Money;
  /** Preço médio por unidade (null sem quantidade). */
  averagePrice: Money | null;
  currentValue: Money;
  valueSource: ValuationSource | 'cost';
  valuationDate: IsoDate | null;
  /** Houve aplicações/retiradas depois da última avaliação (valor ajustado pelo custo). */
  adjustedSinceValuation: boolean;
  /** Resultado de vendas/resgates acima do custo. */
  realizedResult: Money;
  /** Valor atual − custo da posição. */
  unrealizedResult: Money;
  incomeReceived: Money;
  totalReturn: Money;
  totalReturnPercent: number | null;
}

interface Ledger {
  quantity: Decimal | null;
  cost: Money;
  realized: Money;
  income: Money;
  totalIn: Money;
  netInvested: Money;
}

/** Percorre as movimentações em ordem e calcula quantidade, custo e realizados. */
export function replayMovements(movements: readonly InvestmentMovement[]): Ledger {
  const zero = Money.zero();
  const usesQuantity = movements.some(
    (item) =>
      item.quantity !== null &&
      (CAPITAL_IN_TYPES.has(item.type) || CAPITAL_OUT_TYPES.has(item.type)),
  );
  const state: Ledger = {
    quantity: usesQuantity ? new Decimal(0) : null,
    cost: zero,
    realized: zero,
    income: zero,
    totalIn: zero,
    netInvested: zero,
  };
  for (const item of sortMovements(movements)) {
    if (CAPITAL_IN_TYPES.has(item.type) || item.type === 'fee') {
      state.cost = state.cost.add(item.amount);
      state.totalIn = state.totalIn.add(item.amount);
      state.netInvested = state.netInvested.add(item.amount);
      if (state.quantity && item.quantity !== null && item.type !== 'fee') {
        state.quantity = state.quantity.plus(item.quantity);
      }
    } else if (CAPITAL_OUT_TYPES.has(item.type)) {
      state.netInvested = state.netInvested.subtract(item.amount);
      let removed: Money;
      if (state.quantity && item.quantity !== null && state.quantity.gt(0)) {
        const sold = Decimal.min(new Decimal(item.quantity), state.quantity);
        removed = sold.eq(state.quantity)
          ? state.cost
          : state.cost.multiply(sold.div(state.quantity));
        state.quantity = state.quantity.minus(sold);
      } else {
        removed = state.cost.min(item.amount);
      }
      state.realized = state.realized.add(item.amount.subtract(removed));
      state.cost = state.cost.subtract(removed);
    } else if (INCOME_TYPES.has(item.type)) {
      state.income = state.income.add(item.amount);
    } else {
      state.income = state.income.subtract(item.amount); // tax
    }
  }
  return state;
}

export function computePosition(
  asset: Asset,
  movements: readonly InvestmentMovement[],
  valuations: readonly AssetValuation[],
  asOf: IsoDate,
): Position {
  const zero = Money.zero();
  const own = movements.filter((item) => item.assetId === asset.id && item.date <= asOf);
  const ledger = replayMovements(own);

  const latest = valuations
    .filter((item) => item.assetId === asset.id && item.date <= asOf)
    .reduce<AssetValuation | null>(
      (best, item) => (best === null || item.date > best.date ? item : best),
      null,
    );

  let currentValue: Money;
  let adjustedSinceValuation = false;
  if (latest) {
    const after = own.filter((item) => item.date > latest.date);
    const flowIn = Money.sum(
      after.filter((item) => CAPITAL_IN_TYPES.has(item.type)).map((item) => item.amount),
    );
    const flowOut = Money.sum(
      after.filter((item) => CAPITAL_OUT_TYPES.has(item.type)).map((item) => item.amount),
    );
    adjustedSinceValuation = !flowIn.isZero() || !flowOut.isZero();
    currentValue = latest.value.add(flowIn).subtract(flowOut).max(zero);
  } else {
    currentValue = ledger.cost.max(zero);
  }

  const quantityEmpty = ledger.quantity?.isZero() === true;
  if (quantityEmpty) currentValue = zero;
  const costBasis = ledger.cost.max(zero);
  const unrealizedResult = currentValue.subtract(costBasis);
  const totalReturn = unrealizedResult.add(ledger.realized).add(ledger.income);
  const percent = totalReturn.percentageOf(ledger.totalIn);

  return {
    asset,
    netInvested: ledger.netInvested.max(zero),
    totalInvested: ledger.totalIn,
    quantity: ledger.quantity === null ? null : ledger.quantity.toString(),
    costBasis,
    averagePrice: ledger.quantity?.gt(0)
      ? Money.of(costBasis.toDecimal().div(ledger.quantity))
      : null,
    currentValue,
    valueSource: latest ? latest.source : 'cost',
    valuationDate: latest?.date ?? null,
    adjustedSinceValuation,
    realizedResult: ledger.realized,
    unrealizedResult,
    incomeReceived: ledger.income,
    totalReturn,
    totalReturnPercent: percent === null ? null : percent.toNumber(),
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
  costBasis: Money;
  unrealizedResult: Money;
  realizedResult: Money;
  totalInvested: Money;
  totalReturn: Money;
  totalReturnPercent: number | null;
  byClass: { assetClass: AssetClass; value: Money }[];
  /** Há posições sem avaliação, com valor estimado ou ajustado pelo custo. */
  hasEstimatedValues: boolean;
}

export function computePortfolio(
  assets: readonly Asset[],
  movements: readonly InvestmentMovement[],
  valuations: readonly AssetValuation[],
  asOf: IsoDate,
): PortfolioSummary {
  const all = assets.map((asset) => computePosition(asset, movements, valuations, asOf));
  // Posições encerradas saem da carteira, mas seus resultados e proventos contam.
  const positions = all.filter(
    (position) => !position.currentValue.isZero() || !position.costBasis.isZero(),
  );
  const sum = (pick: (position: Position) => Money, list = all) => Money.sum(list.map(pick));

  const netInvested = sum((item) => item.netInvested, positions);
  const currentValue = sum((item) => item.currentValue, positions);
  const result = currentValue.subtract(netInvested);
  const percent = result.percentageOf(netInvested);
  const totalInvested = sum((item) => item.totalInvested);
  const totalReturn = sum((item) => item.totalReturn);
  const totalPercent = totalReturn.percentageOf(totalInvested);

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
    incomeReceived: sum((item) => item.incomeReceived),
    costBasis: sum((item) => item.costBasis, positions),
    unrealizedResult: sum((item) => item.unrealizedResult, positions),
    realizedResult: sum((item) => item.realizedResult),
    totalInvested,
    totalReturn,
    totalReturnPercent: totalPercent === null ? null : totalPercent.toNumber(),
    byClass: [...classTotals.entries()]
      .map(([assetClass, value]) => ({ assetClass, value }))
      .sort((a, b) => b.value.compare(a.value)),
    hasEstimatedValues: positions.some(
      (item) =>
        item.valueSource === 'cost' ||
        item.valueSource === 'estimate' ||
        item.adjustedSinceValuation,
    ),
  };
}

/**
 * Primeira venda que excede a quantidade em carteira (em ordem cronológica,
 * compras antes de vendas no mesmo dia); null se a sequência é válida.
 */
export function findOversell(movements: readonly InvestmentMovement[]): InvestmentMovement | null {
  let held = new Decimal(0);
  for (const item of sortMovements(movements)) {
    if (item.quantity === null) continue;
    if (CAPITAL_IN_TYPES.has(item.type)) held = held.plus(item.quantity);
    else if (CAPITAL_OUT_TYPES.has(item.type)) {
      held = held.minus(item.quantity);
      if (held.isNegative()) return item;
    }
  }
  return null;
}
