import { DomainError } from '@/lib/errors/domain-error';
import { Money } from '@/lib/money';

/** Limites de validação compartilhados pelos casos de uso e pelos formulários. */
export const CARD_NAME_MAX_LENGTH = 60;
export const CARD_INSTITUTION_MAX_LENGTH = 60;
/** Mesmo limite do schema de registros (`cardPurchaseRecordSchema`). */
export const MAX_CARD_INSTALLMENTS = 48;
export const MAX_CARD_LIMIT = Money.of('9999999.99');

export type CreditCardErrorCode =
  | 'not_found'
  | 'invalid_name'
  | 'invalid_limit'
  | 'invalid_day'
  | 'account_not_found'
  | 'account_archived'
  | 'card_inactive'
  | 'card_in_use'
  | 'purchase_not_found'
  | 'purchase_cancelled'
  | 'purchase_in_future'
  | 'purchase_card_change'
  | 'invalid_installments'
  | 'category_not_found'
  | 'category_mismatch'
  | 'limit_exceeded'
  | 'invoice_not_payable'
  | 'payment_exceeds_outstanding'
  | 'paid_in_future'
  | 'payment_not_found';

export class CreditCardError extends DomainError<CreditCardErrorCode> {
  constructor(code: CreditCardErrorCode, message: string) {
    super(code, message);
    this.name = 'CreditCardError';
  }
}

export function assertValidDay(day: number, label: string): void {
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    throw new CreditCardError('invalid_day', `O dia de ${label} deve estar entre 1 e 31.`);
  }
}

export function assertValidLimit(limit: Money): void {
  if (!limit.isPositive()) {
    throw new CreditCardError('invalid_limit', 'O limite deve ser maior que zero.');
  }
  if (limit.greaterThan(MAX_CARD_LIMIT)) {
    throw new CreditCardError('invalid_limit', 'O limite excede o máximo permitido.');
  }
}

export function assertValidInstallments(count: number): void {
  if (!Number.isInteger(count) || count < 1 || count > MAX_CARD_INSTALLMENTS) {
    throw new CreditCardError(
      'invalid_installments',
      `O número de parcelas deve estar entre 1 e ${MAX_CARD_INSTALLMENTS}.`,
    );
  }
}
