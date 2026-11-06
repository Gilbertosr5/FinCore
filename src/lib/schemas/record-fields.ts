import { z } from 'zod';

import { isIsoDate, isMonthKey } from '@/lib/dates';
import { Money } from '@/lib/money';

/**
 * Campos reutilizáveis para validar registros persistidos (IndexedDB) e DTOs
 * da API. O formato em JSON é o mesmo nos dois casos (ver docs/api-contract.md):
 * dinheiro como string decimal, datas como "YYYY-MM-DD", meses como "YYYY-MM".
 */

export const idField = z.union([z.string().min(1), z.number()]).transform(String);

export const moneyField = z
  .string()
  .regex(/^-?\d+(\.\d{1,2})?$/, 'Valor monetário inválido')
  .transform((value) => Money.of(value));

export const isoDateField = z.string().refine(isIsoDate, 'Data inválida');

export const monthKeyField = z.string().refine(isMonthKey, 'Mês inválido');

export const nullableString = z
  .string()
  .nullish()
  .transform((value) => value ?? null);
