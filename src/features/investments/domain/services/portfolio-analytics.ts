import { addMonthsToKey, monthEnd, toMonthKey, type IsoDate, type MonthKey } from '@/lib/dates';
import { Money } from '@/lib/money';

import { computePortfolio, INCOME_TYPES } from './portfolio';
import type { Asset, AssetValuation, InvestmentMovement } from '../entities/investment';

export interface EvolutionPoint {
  month: MonthKey;
  /** Valor atual da carteira no fim do mês (ou hoje, no mês corrente). */
  value: Money;
  /** Valor aplicado líquido na mesma data. */
  invested: Money;
}

/** Evolução patrimonial da carteira (ou de um ativo) nos últimos N meses. */
export function buildEvolution(
  assets: readonly Asset[],
  movements: readonly InvestmentMovement[],
  valuations: readonly AssetValuation[],
  today: IsoDate,
  months = 12,
): EvolutionPoint[] {
  const current = toMonthKey(today);
  return Array.from({ length: months }, (_, index) => {
    const month = addMonthsToKey(current, index - months + 1);
    const end = monthEnd(month);
    const summary = computePortfolio(assets, movements, valuations, end < today ? end : today);
    return { month, value: summary.currentValue, invested: summary.netInvested };
  });
}

export interface IncomePoint {
  month: MonthKey;
  /** Proventos líquidos de impostos no mês. */
  amount: Money;
}

/** Proventos (dividendos, juros, rendimentos − impostos) mês a mês. */
export function buildIncomeByMonth(
  movements: readonly InvestmentMovement[],
  today: IsoDate,
  months = 12,
): IncomePoint[] {
  const current = toMonthKey(today);
  return Array.from({ length: months }, (_, index) => {
    const month = addMonthsToKey(current, index - months + 1);
    const amount = movements
      .filter((item) => toMonthKey(item.date) === month && item.date <= today)
      .reduce((total, item) => {
        if (INCOME_TYPES.has(item.type)) return total.add(item.amount);
        if (item.type === 'tax') return total.subtract(item.amount);
        return total;
      }, Money.zero());
    return { month, amount };
  });
}
