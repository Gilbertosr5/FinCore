import { Decimal } from 'decimal.js';

import { Money } from '@/lib/money';

/**
 * Simulações de economia e aportes (ESTIMATIVAS): juros compostos mensais,
 * aportes no fim de cada mês, sem impostos nem inflação. Cálculo em decimal.
 */
export interface SavingsInput {
  initial: Money;
  monthly: Money;
  /** Rentabilidade mensal em % (ex.: 0,8). Zero = sem rendimento. */
  monthlyRatePercent: number;
  months: number;
}

export interface SavingsPoint {
  month: number;
  contributed: Money;
  balance: Money;
}

export interface SavingsResult {
  finalAmount: Money;
  totalContributed: Money;
  earnings: Money;
  timeline: SavingsPoint[];
}

export const MAX_SIMULATION_MONTHS = 600;

function assertInput(months: number, ratePercent: number): void {
  if (!Number.isInteger(months) || months < 1 || months > MAX_SIMULATION_MONTHS) {
    throw new RangeError(`O prazo deve estar entre 1 e ${MAX_SIMULATION_MONTHS} meses.`);
  }
  if (!Number.isFinite(ratePercent) || ratePercent < 0 || ratePercent > 20) {
    throw new RangeError('A rentabilidade mensal deve estar entre 0% e 20%.');
  }
}

/** Evolução mês a mês do saldo acumulado. */
export function simulateSavings(input: SavingsInput): SavingsResult {
  assertInput(input.months, input.monthlyRatePercent);
  const rate = new Decimal(input.monthlyRatePercent).div(100);
  let balance = input.initial.toDecimal();
  let contributed = input.initial.toDecimal();
  const monthly = input.monthly.toDecimal();
  const currency = input.initial.currency;
  const timeline: SavingsPoint[] = [];
  for (let month = 1; month <= input.months; month++) {
    balance = balance.times(rate.plus(1)).plus(monthly);
    contributed = contributed.plus(monthly);
    timeline.push({
      month,
      contributed: Money.of(contributed, currency),
      balance: Money.of(balance, currency),
    });
  }
  const finalAmount = Money.of(balance, currency);
  const totalContributed = Money.of(contributed, currency);
  return {
    finalAmount,
    totalContributed,
    earnings: finalAmount.subtract(totalContributed),
    timeline,
  };
}

/** Aporte mensal necessário para chegar ao objetivo no prazo (zero se o inicial já basta). */
export function requiredMonthlyContribution(input: {
  target: Money;
  initial: Money;
  monthlyRatePercent: number;
  months: number;
}): Money {
  assertInput(input.months, input.monthlyRatePercent);
  const currency = input.target.currency;
  const rate = new Decimal(input.monthlyRatePercent).div(100);
  const growth = rate.plus(1).pow(input.months);
  const missing = input.target.toDecimal().minus(input.initial.toDecimal().times(growth));
  if (missing.lte(0)) return Money.zero(currency);
  const payment = rate.isZero()
    ? missing.div(input.months)
    : missing.times(rate).div(growth.minus(1));
  // Arredonda para cima: o aporte sugerido nunca deixa a meta a centavos de distância.
  return Money.of(payment.toDecimalPlaces(2, Decimal.ROUND_UP), currency);
}

/** Meses até atingir o objetivo com o aporte informado (null se não atinge em 600 meses). */
export function monthsToReach(input: {
  target: Money;
  initial: Money;
  monthly: Money;
  monthlyRatePercent: number;
}): number | null {
  assertInput(1, input.monthlyRatePercent);
  const rate = new Decimal(input.monthlyRatePercent).div(100).plus(1);
  const target = input.target.toDecimal();
  let balance = input.initial.toDecimal();
  if (balance.gte(target)) return 0;
  for (let month = 1; month <= MAX_SIMULATION_MONTHS; month++) {
    balance = balance.times(rate).plus(input.monthly.toDecimal());
    if (balance.gte(target)) return month;
  }
  return null;
}
