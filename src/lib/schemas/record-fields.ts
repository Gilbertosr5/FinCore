import { z } from 'zod';

import { isIsoDate, isMonthKey } from '@/lib/dates';
import { Money } from '@/lib/money';

/**
 * Campos reutilizáveis para validar registros persistidos (IndexedDB) e DTOs
 * da API. O formato em JSON é o mesmo nos dois casos (ver docs/api-contract.md):
 * dinheiro como string decimal, datas como "YYYY-MM-DD", meses como "YYYY-MM".
 */

export const idField = z.union([z.string().min(1), z.number()]).transform(String);

/**
 * `abort: true`: com texto inválido o `transform` não roda e o campo continua
 * string — os refinamentos do objeto (ex.: `record.amount.isNegative()`) não
 * podem rodar sobre ele, senão a falha vira TypeError em vez de DataIntegrityError.
 */
export const moneyField = z
  .string()
  .regex(/^-?\d+(\.\d{1,2})?$/, { message: 'Valor monetário inválido', abort: true })
  .transform((value) => Money.of(value));

export const isoDateField = z.string().refine(isIsoDate, 'Data inválida');

export const monthKeyField = z.string().refine(isMonthKey, 'Mês inválido');

export const nullableString = z
  .string()
  .nullish()
  .transform((value) => value ?? null);
