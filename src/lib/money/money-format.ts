import { Money, type CurrencyCode, DEFAULT_CURRENCY } from './money';

const LOCALE = 'pt-BR';

const formatterCache = new Map<string, Intl.NumberFormat>();

function getFormatter(currency: CurrencyCode, signDisplay: 'auto' | 'always' | 'exceptZero') {
  const key = `${currency}:${signDisplay}`;
  let formatter = formatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(LOCALE, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      signDisplay,
    });
    formatterCache.set(key, formatter);
  }
  return formatter;
}

export interface FormatMoneyOptions {
  /** 'always' exibe "+" em valores positivos (útil para movimentações). */
  signDisplay?: 'auto' | 'always' | 'exceptZero';
}

/**
 * Formata no padrão brasileiro: "R$ 1.234,56".
 * O valor é passado ao Intl como string decimal, sem conversão para float.
 * Observação: o Intl usa espaço não separável (U+00A0) entre "R$" e o número.
 */
export function formatMoney(money: Money, options: FormatMoneyOptions = {}): string {
  return getFormatter(money.currency, options.signDisplay ?? 'auto').format(
    money.toString() as Intl.StringNumericLiteral,
  );
}

const compactFormatter = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: DEFAULT_CURRENCY,
  notation: 'compact',
  maximumFractionDigits: 1,
});

/**
 * Formato compacto para eixos de gráfico: 12345 → "R$ 12,3 mil".
 * Recebe `number` porque eixos já operam em escala de exibição; nunca use em
 * valores que serão somados ou comparados.
 */
export function formatCompactCurrency(value: number): string {
  return compactFormatter.format(value);
}

const percentFormatter = new Intl.NumberFormat(LOCALE, {
  style: 'percent',
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

/** 80 → "80%"; 12.5 → "12,5%" (recebe pontos percentuais). */
export function formatPercent(percentPoints: number): string {
  return percentFormatter.format(percentPoints / 100);
}

/**
 * Converte texto digitado pelo usuário em Money.
 * Aceita: "1.234,56", "1234,56", "R$ 1.234,56", "-50", "0,5", "1234.56" (ponto decimal
 * apenas quando não há vírgula e há no máximo 2 casas após o ponto).
 * Retorna `null` se o texto não representar um valor válido.
 */
export function parseMoneyInput(
  input: string,
  currency: CurrencyCode = DEFAULT_CURRENCY,
): Money | null {
  // \s inclui o espaço não separável (U+00A0) usado pelo Intl em "R$ 1.234,56".
  const cleaned = input.replace(/R\$/gi, '').replace(/\s/g, '');
  if (cleaned === '') return null;

  let normalized: string;
  if (cleaned.includes(',')) {
    // Formato brasileiro: ponto = milhar, vírgula = decimal.
    if (!/^-?\d{1,3}(\.\d{3})*(,\d{1,2})?$|^-?\d+(,\d{1,2})?$/.test(cleaned)) return null;
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (/^-?\d+(\.\d{1,2})?$/.test(cleaned)) {
    normalized = cleaned;
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    // "1.234" sem vírgula: interpretado como separador de milhar.
    normalized = cleaned.replace(/\./g, '');
  } else {
    return null;
  }

  return Money.of(normalized, currency);
}
