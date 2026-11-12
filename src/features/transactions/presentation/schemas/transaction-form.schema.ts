import { z } from 'zod';

import { asIsoDate, isIsoDate, type IsoDate } from '@/lib/dates';
import { parseMoneyInput } from '@/lib/money';

import type { EntryInput, Repetition } from '../../application/entry-commands';
import type { TransferInput } from '../../application/transfer-commands';
import type { RecurrenceFrequency } from '../../domain/entities/recurrence';
import type { Transaction } from '../../domain/entities/transaction';
import {
  DESCRIPTION_MAX_LENGTH,
  MAX_INSTALLMENTS,
  NOTES_MAX_LENGTH,
} from '../../domain/rules/transaction-rules';

/**
 * Schemas dos formulários. Valores de tela são strings; a conversão para
 * `Money` usa `parseMoneyInput` (formato brasileiro, sem ponto flutuante).
 * As regras de negócio definitivas são revalidadas nos casos de uso.
 */

const amountField = z
  .string()
  .trim()
  .min(1, 'Informe o valor.')
  .refine(
    (value) => parseMoneyInput(value)?.isPositive() === true,
    'Informe um valor maior que zero.',
  );

// Valida sem estreitar o tipo (o formulário trabalha com strings; a conversão é explícita).
const dateField = (message: string) =>
  z.string().refine((value): boolean => isIsoDate(value), message);

const FREQUENCIES = [
  'daily',
  'weekly',
  'biweekly',
  'monthly',
  'bimonthly',
  'quarterly',
  'semiannual',
  'yearly',
] as const satisfies readonly RecurrenceFrequency[];

export const entryFormSchema = z
  .object({
    kind: z.enum(['income', 'expense']),
    description: z
      .string()
      .trim()
      .min(1, 'Informe a descrição.')
      .max(DESCRIPTION_MAX_LENGTH, `Use no máximo ${DESCRIPTION_MAX_LENGTH} caracteres.`),
    amount: amountField,
    accountId: z.string().min(1, 'Escolha a conta.'),
    categoryId: z.string().min(1, 'Escolha a categoria.'),
    competenceDate: dateField('Informe a data.'),
    dueDate: z
      .string()
      .refine((value): boolean => value === '' || isIsoDate(value), 'Data inválida.'),
    settled: z.boolean(),
    paidDate: z.string(),
    tags: z.string().max(200),
    notes: z.string().max(NOTES_MAX_LENGTH, `Use no máximo ${NOTES_MAX_LENGTH} caracteres.`),
    repetition: z.enum(['none', 'installments', 'recurring']),
    installmentCount: z.string(),
    frequency: z.enum(FREQUENCIES),
    endDate: z.string(),
  })
  .superRefine((values, ctx) => {
    if (values.settled && !isIsoDate(values.paidDate)) {
      ctx.addIssue({ code: 'custom', path: ['paidDate'], message: 'Informe a data do pagamento.' });
    }
    if (values.repetition === 'installments') {
      const count = Number(values.installmentCount);
      if (!Number.isInteger(count) || count < 2 || count > MAX_INSTALLMENTS) {
        ctx.addIssue({
          code: 'custom',
          path: ['installmentCount'],
          message: `Entre 2 e ${MAX_INSTALLMENTS} parcelas.`,
        });
      }
    }
    if (values.repetition === 'recurring' && values.endDate !== '') {
      if (!isIsoDate(values.endDate)) {
        ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'Data inválida.' });
      } else if (values.endDate < values.competenceDate) {
        ctx.addIssue({
          code: 'custom',
          path: ['endDate'],
          message: 'Deve ser igual ou posterior à data inicial.',
        });
      }
    }
  });

export type EntryFormValues = z.infer<typeof entryFormSchema>;

export function emptyEntryValues(
  kind: 'income' | 'expense',
  today: IsoDate,
  accountId = '',
): EntryFormValues {
  return {
    kind,
    description: '',
    amount: '',
    accountId,
    categoryId: '',
    competenceDate: today,
    dueDate: '',
    settled: false,
    paidDate: today,
    tags: '',
    notes: '',
    repetition: 'none',
    installmentCount: '2',
    frequency: 'monthly',
    endDate: '',
  };
}

/** Valores do formulário a partir de um lançamento (edição ou duplicação). */
export function entryValuesFrom(
  transaction: Transaction,
  today: IsoDate,
  mode: 'edit' | 'duplicate',
): EntryFormValues {
  const kind = transaction.kind === 'income' ? 'income' : 'expense';
  const duplicating = mode === 'duplicate';
  return {
    ...emptyEntryValues(kind, today, transaction.accountId),
    description: transaction.description,
    amount: transaction.amount.toString().replace('.', ','),
    categoryId: transaction.categoryId ?? '',
    competenceDate: duplicating ? today : transaction.competenceDate,
    dueDate:
      duplicating || transaction.dueDate === transaction.competenceDate
        ? ''
        : (transaction.dueDate ?? ''),
    settled: !duplicating && transaction.status === 'paid',
    paidDate: !duplicating && transaction.paidDate ? transaction.paidDate : today,
    tags: transaction.tags.join(', '),
    notes: transaction.notes ?? '',
  };
}

export function toEntryInput(values: EntryFormValues): EntryInput {
  const amount = parseMoneyInput(values.amount);
  if (!amount) throw new Error('Valor inválido após validação.');
  return {
    kind: values.kind,
    description: values.description,
    amount,
    accountId: values.accountId,
    categoryId: values.categoryId,
    competenceDate: asIsoDate(values.competenceDate),
    dueDate: isIsoDate(values.dueDate) ? values.dueDate : null,
    paidDate: values.settled && isIsoDate(values.paidDate) ? values.paidDate : null,
    tags: values.tags.split(','),
    notes: values.notes,
  };
}

export function toRepetition(values: EntryFormValues): Repetition {
  switch (values.repetition) {
    case 'none':
      return { type: 'none' };
    case 'installments':
      return { type: 'installments', count: Number(values.installmentCount) };
    case 'recurring':
      return {
        type: 'recurring',
        frequency: values.frequency,
        endDate: isIsoDate(values.endDate) ? values.endDate : null,
      };
  }
}

export const transferFormSchema = z
  .object({
    fromAccountId: z.string().min(1, 'Escolha a conta de origem.'),
    toAccountId: z.string().min(1, 'Escolha a conta de destino.'),
    amount: amountField,
    date: dateField('Informe a data.'),
    description: z.string().max(DESCRIPTION_MAX_LENGTH),
    notes: z.string().max(NOTES_MAX_LENGTH),
  })
  .refine((values) => values.fromAccountId !== values.toAccountId, {
    path: ['toAccountId'],
    message: 'A conta de destino deve ser diferente da origem.',
  });

export type TransferFormValues = z.infer<typeof transferFormSchema>;

export function toTransferInput(values: TransferFormValues): TransferInput {
  const amount = parseMoneyInput(values.amount);
  if (!amount) throw new Error('Valor inválido após validação.');
  return {
    fromAccountId: values.fromAccountId,
    toAccountId: values.toAccountId,
    amount,
    date: asIsoDate(values.date),
    description: values.description,
    notes: values.notes,
  };
}
