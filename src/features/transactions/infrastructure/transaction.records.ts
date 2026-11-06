import { z } from 'zod';

import {
  idField,
  isoDateField,
  moneyField,
  monthKeyField,
  nullableString,
} from '@/lib/schemas/record-fields';

import type { Category } from '../domain/entities/category';
import type { Transaction } from '../domain/entities/transaction';

export const categoryRecordSchema = z
  .object({
    id: idField,
    name: z.string().min(1),
    kind: z.enum(['income', 'expense']),
    nature: z.enum(['fixed', 'variable']).default('variable'),
  })
  .transform((record): Category => record);

export const transactionRecordSchema = z
  .object({
    id: idField,
    kind: z.enum(['income', 'expense', 'transfer', 'card_payment', 'investment']),
    description: z.string().min(1),
    amount: moneyField,
    accountId: idField,
    categoryId: idField.nullish().transform((value) => value ?? null),
    competenceDate: isoDateField,
    dueDate: isoDateField.nullish().transform((value) => value ?? null),
    paidDate: isoDateField.nullish().transform((value) => value ?? null),
    status: z.enum(['pending', 'paid', 'cancelled']),
    transfer: z
      .object({
        id: idField,
        direction: z.enum(['in', 'out']),
        counterpartAccountId: idField,
      })
      .nullish()
      .transform((value) => value ?? null),
    cardPayment: z
      .object({ cardId: idField, invoiceMonth: monthKeyField })
      .nullish()
      .transform((value) => value ?? null),
    investment: z
      .object({ assetId: idField, direction: z.enum(['application', 'redemption']) })
      .nullish()
      .transform((value) => value ?? null),
    recurrenceId: nullableString,
    installment: z
      .object({
        groupId: idField,
        number: z.number().int().positive(),
        total: z.number().int().positive(),
      })
      .nullish()
      .transform((value) => value ?? null),
    tags: z.array(z.string()).default([]),
    notes: nullableString,
  })
  .refine((record) => !record.amount.isNegative(), 'O valor deve ser positivo.')
  .refine(
    (record) => (record.kind === 'transfer') === (record.transfer !== null),
    'Transferências exigem o vínculo com a conta de contrapartida.',
  )
  .refine(
    (record) => (record.kind === 'card_payment') === (record.cardPayment !== null),
    'Pagamentos de fatura exigem o cartão e o mês da fatura.',
  )
  .refine(
    (record) => (record.kind === 'investment') === (record.investment !== null),
    'Movimentações de investimento exigem o ativo e o sentido.',
  )
  .transform((record): Transaction => record);

export function transactionToRecord(transaction: Transaction) {
  return { ...transaction, amount: transaction.amount.toString() };
}
