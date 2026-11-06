import { z } from 'zod';

import { idField, isoDateField, moneyField } from '@/lib/schemas/record-fields';

import type { CardPurchase, CreditCard } from '../domain/entities/credit-card';

const dayField = z.number().int().min(1).max(31);

export const creditCardRecordSchema = z
  .object({
    id: idField,
    name: z.string().min(1),
    institution: z.string(),
    brand: z.enum(['visa', 'mastercard', 'elo', 'amex', 'hipercard', 'other']),
    limit: moneyField,
    closingDay: dayField,
    dueDay: dayField,
    paymentAccountId: idField,
    status: z.enum(['active', 'blocked', 'cancelled']),
  })
  .transform((record): CreditCard => record);

export const cardPurchaseRecordSchema = z
  .object({
    id: idField,
    cardId: idField,
    description: z.string().min(1),
    categoryId: idField.nullish().transform((value) => value ?? null),
    totalAmount: moneyField,
    purchaseDate: isoDateField,
    installmentCount: z.number().int().min(1).max(48),
    status: z.enum(['active', 'cancelled']),
  })
  .refine((record) => record.totalAmount.isPositive(), 'O valor da compra deve ser positivo.')
  .transform((record): CardPurchase => record);

export function creditCardToRecord(card: CreditCard) {
  return { ...card, limit: card.limit.toString() };
}

export function cardPurchaseToRecord(purchase: CardPurchase) {
  return { ...purchase, totalAmount: purchase.totalAmount.toString() };
}
