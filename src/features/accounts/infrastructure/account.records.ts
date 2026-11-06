import { z } from 'zod';

import { idField, isoDateField, moneyField, nullableString } from '@/lib/schemas/record-fields';

import type { Account } from '../domain/entities/account';

/** Formato JSON de uma conta (IndexedDB de demonstração e DTO da API). */
export const accountRecordSchema = z
  .object({
    id: idField,
    name: z.string().min(1),
    type: z.enum(['checking', 'savings', 'cash', 'digital_wallet', 'investment', 'other']),
    institution: nullableString,
    initialBalance: moneyField,
    initialBalanceDate: isoDateField,
    archived: z.boolean().default(false),
  })
  .transform((record): Account => record);

export function accountToRecord(account: Account) {
  return {
    ...account,
    initialBalance: account.initialBalance.toString(),
  };
}
