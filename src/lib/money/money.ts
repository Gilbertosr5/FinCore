import { Decimal } from 'decimal.js';

/**
 * Value object monetário do FinCore.
 *
 * Regras (ver docs/adr/0003-precisao-monetaria.md):
 * - Nunca usa aritmética de ponto flutuante do JavaScript.
 * - Todo valor é mantido em escala fixa de 2 casas decimais (centavos).
 * - Arredondamento padrão: HALF_EVEN ("arredondamento bancário", alinhado à
 *   ABNT NBR 5891 e ao RoundingMode.HALF_EVEN do Java/BigDecimal).
 * - Imutável: toda operação retorna uma nova instância.
 * - Serialização para API: string decimal com ponto ("1234.56"), evitando perda
 *   de precisão em JSON numérico.
 */

/** Moedas suportadas (ISO 4217). BRL é a moeda principal; as demais preparam a preferência de moeda. */
export type CurrencyCode = 'BRL' | 'USD' | 'EUR';

export const DEFAULT_CURRENCY: CurrencyCode = 'BRL';
export const MONEY_SCALE = 2;
export const MONEY_ROUNDING = Decimal.ROUND_HALF_EVEN;

/** Construtor Decimal isolado: não altera a configuração global do decimal.js. */
const MoneyDecimal = Decimal.clone({ precision: 40, rounding: MONEY_ROUNDING });

export type MoneyInput = string | number | Decimal;

export class CurrencyMismatchError extends Error {
  constructor(a: CurrencyCode, b: CurrencyCode) {
    super(`Operação entre moedas diferentes não é permitida (${a} x ${b}).`);
    this.name = 'CurrencyMismatchError';
  }
}

export class InvalidMoneyError extends Error {
  constructor(value: unknown) {
    super(`Valor monetário inválido: ${String(value)}`);
    this.name = 'InvalidMoneyError';
  }
}

export class Money {
  private readonly amount: Decimal;
  readonly currency: CurrencyCode;

  private constructor(amount: Decimal, currency: CurrencyCode) {
    this.amount = amount.toDecimalPlaces(MONEY_SCALE, MONEY_ROUNDING);
    this.currency = currency;
  }

  static of(value: MoneyInput, currency: CurrencyCode = DEFAULT_CURRENCY): Money {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new InvalidMoneyError(value);
    }
    let decimal: Decimal;
    try {
      decimal = new MoneyDecimal(value);
    } catch {
      throw new InvalidMoneyError(value);
    }
    if (!decimal.isFinite()) throw new InvalidMoneyError(value);
    return new Money(decimal, currency);
  }

  /** Cria a partir de unidades mínimas inteiras (centavos). */
  static fromCents(cents: number, currency: CurrencyCode = DEFAULT_CURRENCY): Money {
    if (!Number.isSafeInteger(cents)) throw new InvalidMoneyError(cents);
    return new Money(new MoneyDecimal(cents).dividedBy(100), currency);
  }

  static zero(currency: CurrencyCode = DEFAULT_CURRENCY): Money {
    return new Money(new MoneyDecimal(0), currency);
  }

  /** Soma uma lista de valores. Lista vazia resulta em zero. */
  static sum(values: readonly Money[], currency: CurrencyCode = DEFAULT_CURRENCY): Money {
    return values.reduce((acc, value) => acc.add(value), Money.zero(currency));
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount.plus(other.amount), this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount.minus(other.amount), this.currency);
  }

  /** Multiplica por um fator (ex.: quantidade, taxa). Resultado arredondado a centavos. */
  multiply(factor: MoneyInput): Money {
    return new Money(this.amount.times(new MoneyDecimal(factor)), this.currency);
  }

  /**
   * Divide por um número (ex.: aporte mensal = restante / meses). Resultado
   * arredondado a centavos (HALF_EVEN). Para repartir um total sem perder
   * centavos, use `allocate`.
   */
  divide(divisor: MoneyInput): Money {
    const value = new MoneyDecimal(divisor);
    if (value.isZero()) throw new RangeError('Divisão por zero.');
    return new Money(this.amount.dividedBy(value), this.currency);
  }

  /** Maior entre este valor e `other`. */
  max(other: Money): Money {
    return this.compare(other) >= 0 ? this : other;
  }

  /** Menor entre este valor e `other`. */
  min(other: Money): Money {
    return this.compare(other) <= 0 ? this : other;
  }

  negate(): Money {
    return new Money(this.amount.negated(), this.currency);
  }

  abs(): Money {
    return new Money(this.amount.abs(), this.currency);
  }

  isZero(): boolean {
    return this.amount.isZero();
  }

  isNegative(): boolean {
    return this.amount.isNegative() && !this.amount.isZero();
  }

  isPositive(): boolean {
    return this.amount.isPositive() && !this.amount.isZero();
  }

  compare(other: Money): -1 | 0 | 1 {
    this.assertSameCurrency(other);
    const result = this.amount.comparedTo(other.amount);
    return result < 0 ? -1 : result > 0 ? 1 : 0;
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.amount.equals(other.amount);
  }

  greaterThan(other: Money): boolean {
    return this.compare(other) === 1;
  }

  greaterThanOrEqual(other: Money): boolean {
    return this.compare(other) >= 0;
  }

  lessThan(other: Money): boolean {
    return this.compare(other) === -1;
  }

  /**
   * Percentual que este valor representa de `total` (ex.: 640 de 800 = 80).
   * Retorna `null` quando o total é zero (percentual indefinido).
   */
  percentageOf(total: Money, decimalPlaces = 2): Decimal | null {
    this.assertSameCurrency(total);
    if (total.isZero()) return null;
    return this.amount
      .dividedBy(total.amount)
      .times(100)
      .toDecimalPlaces(decimalPlaces, MONEY_ROUNDING);
  }

  /**
   * Divide o valor em `parts` parcelas sem perder centavos.
   * O resto é distribuído, um centavo por vez, a partir da primeira parcela.
   * Ex.: R$ 100,00 em 3 => [33,34; 33,33; 33,33].
   */
  allocate(parts: number): Money[] {
    if (!Number.isSafeInteger(parts) || parts < 1) {
      throw new RangeError('O número de parcelas deve ser um inteiro maior ou igual a 1.');
    }
    return this.allocateByRatios(Array.from({ length: parts }, () => 1));
  }

  /**
   * Divide proporcionalmente aos pesos informados, garantindo que a soma das
   * partes seja exatamente igual ao valor original.
   */
  allocateByRatios(ratios: readonly number[]): Money[] {
    if (ratios.length === 0 || ratios.some((ratio) => !Number.isFinite(ratio) || ratio < 0)) {
      throw new RangeError('As proporções devem ser números finitos e não negativos.');
    }
    const totalRatio = ratios.reduce((acc, ratio) => acc.plus(ratio), new MoneyDecimal(0));
    if (totalRatio.isZero()) throw new RangeError('A soma das proporções deve ser maior que zero.');

    const totalCents = this.amount.times(100);
    const sign = totalCents.isNegative() ? -1 : 1;
    const absCents = totalCents.abs();

    const shares = ratios.map((ratio) =>
      absCents.times(ratio).dividedBy(totalRatio).toDecimalPlaces(0, Decimal.ROUND_DOWN),
    );
    let remainder = absCents.minus(
      shares.reduce((acc, share) => acc.plus(share), new MoneyDecimal(0)),
    );

    const result = shares.map((share) => {
      if (remainder.greaterThan(0)) {
        remainder = remainder.minus(1);
        return share.plus(1);
      }
      return share;
    });

    return result.map((cents) => new Money(cents.times(sign).dividedBy(100), this.currency));
  }

  /** Centavos como inteiro. Seguro para valores até Number.MAX_SAFE_INTEGER centavos. */
  toCents(): number {
    const cents = this.amount.times(100);
    const asNumber = cents.toNumber();
    if (!Number.isSafeInteger(asNumber)) {
      throw new RangeError('Valor excede a faixa segura para representação em centavos.');
    }
    return asNumber;
  }

  /** Representação decimal canônica para API e persistência: "1234.56". */
  toString(): string {
    return this.amount.toFixed(MONEY_SCALE);
  }

  toJSON(): string {
    return this.toString();
  }

  /**
   * Conversão para `number` — USO EXCLUSIVO em apresentação (ex.: eixos de gráficos).
   * Nunca use o resultado em cálculos.
   */
  toNumberForDisplay(): number {
    return this.amount.toNumber();
  }

  toDecimal(): Decimal {
    return new MoneyDecimal(this.amount);
  }

  private assertSameCurrency(other: Money): void {
    if (other.currency !== this.currency) {
      throw new CurrencyMismatchError(this.currency, other.currency);
    }
  }
}
