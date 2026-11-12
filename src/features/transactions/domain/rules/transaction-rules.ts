import type { Account } from '@/features/accounts/domain/entities/account';
import type { IsoDate } from '@/lib/dates';
import { Money } from '@/lib/money';

import type { Category } from '../entities/category';
import { TransactionError } from '../errors/transaction-error';

/** Limites de validação compartilhados pelos casos de uso e pelos formulários. */
export const DESCRIPTION_MAX_LENGTH = 120;
export const NOTES_MAX_LENGTH = 500;
export const MAX_AMOUNT = Money.of('999999999.99');
export const MAX_INSTALLMENTS = 120;
export const MAX_TAGS = 10;

export function assertValidAmount(amount: Money): void {
  if (!amount.isPositive()) {
    throw new TransactionError('invalid_amount', 'O valor deve ser maior que zero.');
  }
  if (amount.greaterThan(MAX_AMOUNT)) {
    throw new TransactionError('invalid_amount', 'O valor excede o máximo permitido.');
  }
}

export function normalizeDescription(description: string): string {
  const normalized = description.trim().replace(/\s+/g, ' ');
  if (normalized.length === 0 || normalized.length > DESCRIPTION_MAX_LENGTH) {
    throw new TransactionError(
      'invalid_description',
      `Informe uma descrição com até ${DESCRIPTION_MAX_LENGTH} caracteres.`,
    );
  }
  return normalized;
}

export function normalizeTags(tags: readonly string[]): string[] {
  const unique = [...new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
  return unique.slice(0, MAX_TAGS);
}

export function normalizeNotes(notes: string | null | undefined): string | null {
  const trimmed = notes?.trim() ?? '';
  if (trimmed.length > NOTES_MAX_LENGTH) {
    throw new TransactionError(
      'invalid_description',
      `As observações podem ter até ${NOTES_MAX_LENGTH} caracteres.`,
    );
  }
  return trimmed === '' ? null : trimmed;
}

/** Um lançamento liquidado não pode ter data de pagamento no futuro. */
export function assertPaidDate(paidDate: IsoDate, today: IsoDate): void {
  if (paidDate > today) {
    throw new TransactionError(
      'paid_in_future',
      'A data de pagamento/recebimento não pode ser futura.',
    );
  }
}

export function assertUsableAccount(account: Account | undefined, allowArchived = false): Account {
  if (!account) throw new TransactionError('account_not_found', 'Conta não encontrada.');
  if (account.archived && !allowArchived) {
    throw new TransactionError(
      'account_archived',
      `A conta "${account.name}" está arquivada. Restaure-a para registrar lançamentos.`,
    );
  }
  return account;
}

export function assertCategoryMatches(
  category: Category | undefined,
  kind: 'income' | 'expense',
): void {
  if (!category) throw new TransactionError('category_not_found', 'Categoria não encontrada.');
  if (category.kind !== kind) {
    throw new TransactionError(
      'category_mismatch',
      kind === 'income' ? 'Escolha uma categoria de receita.' : 'Escolha uma categoria de despesa.',
    );
  }
}
