import { Money } from './money';
import { formatMoney, parseMoneyInput } from './money-format';

/** O Intl usa espaço não separável entre o símbolo e o número. */
const nbsp = (text: string) => text.replace(/ /g, '\u00A0');

describe('formatMoney', () => {
  it('formata no padrão R$ 1.234,56', () => {
    expect(formatMoney(Money.of('1234.56'))).toBe(nbsp('R$ 1.234,56'));
  });

  it('formata milhões e centavos zerados', () => {
    expect(formatMoney(Money.of('1000000'))).toBe(nbsp('R$ 1.000.000,00'));
  });

  it('formata negativos', () => {
    expect(formatMoney(Money.of('-50.5'))).toBe(nbsp('-R$ 50,50'));
  });

  it('exibe sinal positivo quando solicitado', () => {
    expect(formatMoney(Money.of('10'), { signDisplay: 'always' })).toBe(nbsp('+R$ 10,00'));
  });

  it('não perde precisão em valores grandes', () => {
    expect(formatMoney(Money.of('90071992547409.93'))).toBe(nbsp('R$ 90.071.992.547.409,93'));
  });
});

describe('parseMoneyInput', () => {
  it.each([
    ['1.234,56', '1234.56'],
    ['1234,56', '1234.56'],
    ['R$ 1.234,56', '1234.56'],
    ['0,5', '0.50'],
    ['-50', '-50.00'],
    ['1234.56', '1234.56'],
    ['1.234', '1234.00'],
    ['1.234.567,89', '1234567.89'],
  ])('converte "%s" para %s', (input, expected) => {
    expect(parseMoneyInput(input)?.toString()).toBe(expected);
  });

  it.each(['', 'abc', '1,234,56', '12,345', '1.23.4', '10,'])('rejeita "%s"', (input) => {
    expect(parseMoneyInput(input)).toBeNull();
  });
});
