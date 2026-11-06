import { CurrencyMismatchError, InvalidMoneyError, Money } from './money';

const brl = (value: string) => Money.of(value);

describe('Money', () => {
  describe('precisão', () => {
    it('evita o erro clássico de ponto flutuante (0.1 + 0.2)', () => {
      expect(Money.of(0.1).add(Money.of(0.2)).toString()).toBe('0.30');
    });

    it('mantém exatidão em somas longas de centavos', () => {
      const values = Array.from({ length: 1000 }, () => brl('0.01'));
      expect(Money.sum(values).toString()).toBe('10.00');
    });

    it('arredonda para 2 casas usando HALF_EVEN (arredondamento bancário)', () => {
      expect(brl('2.345').toString()).toBe('2.34');
      expect(brl('2.355').toString()).toBe('2.36');
      expect(brl('-2.345').toString()).toBe('-2.34');
    });

    it('arredonda o resultado de multiplicações a centavos', () => {
      expect(brl('10.00').multiply('0.333').toString()).toBe('3.33');
      expect(brl('19.99').multiply(3).toString()).toBe('59.97');
    });
  });

  describe('criação e validação', () => {
    it('cria a partir de centavos e converte de volta', () => {
      const money = Money.fromCents(123456);
      expect(money.toString()).toBe('1234.56');
      expect(money.toCents()).toBe(123456);
    });

    it.each([Number.NaN, Number.POSITIVE_INFINITY, 'abc', ''])(
      'rejeita valor inválido %s',
      (value) => {
        expect(() => Money.of(value)).toThrow(InvalidMoneyError);
      },
    );

    it('rejeita centavos não inteiros', () => {
      expect(() => Money.fromCents(10.5)).toThrow(InvalidMoneyError);
    });

    it('serializa para JSON como string decimal', () => {
      expect(JSON.stringify({ amount: brl('1500') })).toBe('{"amount":"1500.00"}');
    });
  });

  describe('operações', () => {
    it('subtrai, nega e calcula valor absoluto', () => {
      const result = brl('100').subtract(brl('150.50'));
      expect(result.toString()).toBe('-50.50');
      expect(result.isNegative()).toBe(true);
      expect(result.abs().toString()).toBe('50.50');
      expect(result.negate().toString()).toBe('50.50');
    });

    it('trata zero negativo como zero', () => {
      const zero = brl('-0');
      expect(zero.isZero()).toBe(true);
      expect(zero.isNegative()).toBe(false);
      expect(zero.isPositive()).toBe(false);
    });

    it('compara valores', () => {
      expect(brl('10').greaterThan(brl('9.99'))).toBe(true);
      expect(brl('10').lessThan(brl('10.01'))).toBe(true);
      expect(brl('10').equals(brl('10.00'))).toBe(true);
      expect(brl('10').compare(brl('10'))).toBe(0);
    });

    it('soma lista vazia como zero', () => {
      expect(Money.sum([]).isZero()).toBe(true);
    });
  });

  describe('percentageOf', () => {
    it('calcula percentual consumido de um orçamento', () => {
      expect(brl('640').percentageOf(brl('800'))?.toString()).toBe('80');
      expect(brl('1000').percentageOf(brl('800'))?.toString()).toBe('125');
    });

    it('retorna null quando o total é zero', () => {
      expect(brl('10').percentageOf(Money.zero())).toBeNull();
    });
  });

  describe('allocate (parcelamento)', () => {
    it('distribui o resto de centavos a partir da primeira parcela', () => {
      expect(brl('100').allocate(3).map(String)).toEqual(['33.34', '33.33', '33.33']);
    });

    it('a soma das parcelas é sempre igual ao total', () => {
      const total = brl('1234.57');
      for (let parts = 1; parts <= 24; parts++) {
        const installments = total.allocate(parts);
        expect(installments).toHaveLength(parts);
        expect(Money.sum(installments).equals(total)).toBe(true);
      }
    });

    it('funciona com valores negativos (estornos)', () => {
      const parts = brl('-100').allocate(3);
      expect(parts.map(String)).toEqual(['-33.34', '-33.33', '-33.33']);
      expect(Money.sum(parts).toString()).toBe('-100.00');
    });

    it('aloca por proporções sem perder centavos', () => {
      const parts = brl('100').allocateByRatios([50, 30, 20]);
      expect(parts.map(String)).toEqual(['50.00', '30.00', '20.00']);
      const uneven = brl('0.05').allocateByRatios([1, 1]);
      expect(uneven.map(String)).toEqual(['0.03', '0.02']);
    });

    it.each([0, -1, 1.5])('rejeita número de parcelas inválido: %s', (parts) => {
      expect(() => brl('100').allocate(parts)).toThrow(RangeError);
    });
  });

  it('impede operações entre moedas diferentes', () => {
    const fakeUsd = Money.of('1', 'USD');
    expect(() => brl('1').add(fakeUsd)).toThrow(CurrencyMismatchError);
  });
});
