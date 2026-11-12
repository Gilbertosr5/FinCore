import { z } from 'zod';

import { isIsoDate } from '@/lib/dates';
import { parseMoneyInput, type Money } from '@/lib/money';

/**
 * Campos compartilhados pelos formulários de cartões. Valores de tela são
 * strings; a conversão para `Money` usa `parseMoneyInput` (sem ponto flutuante).
 * As regras definitivas são revalidadas nos casos de uso.
 */
export const positiveMoneyField = z
  .string()
  .trim()
  .min(1, 'Informe o valor.')
  .refine(
    (value) => parseMoneyInput(value)?.isPositive() === true,
    'Informe um valor maior que zero.',
  );

export const dateField = (message: string) =>
  z.string().refine((value): boolean => isIsoDate(value), message);

export const integerField = (min: number, max: number, message: string) =>
  z.string().refine((value) => {
    const number = Number(value);
    return Number.isInteger(number) && number >= min && number <= max;
  }, message);

/** "1234.5" → "1234,50" para preencher campos monetários. */
export function moneyToInput(value: Money): string {
  return value.toDecimal().toFixed(2).replace('.', ',');
}

export function requireMoney(value: string): Money {
  const money = parseMoneyInput(value);
  if (!money) throw new Error('Valor inválido após validação.');
  return money;
}
