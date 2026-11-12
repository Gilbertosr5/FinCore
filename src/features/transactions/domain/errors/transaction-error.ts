import { DomainError } from '@/lib/errors/domain-error';

export type TransactionErrorCode =
  | 'invalid_amount'
  | 'invalid_description'
  | 'invalid_dates'
  | 'paid_in_future'
  | 'account_not_found'
  | 'account_archived'
  | 'category_mismatch'
  | 'category_not_found'
  | 'same_account_transfer'
  | 'invalid_installments'
  | 'invalid_recurrence'
  | 'not_found'
  | 'not_editable'
  | 'invalid_status_change'
  | 'category_in_use'
  | 'duplicate_category';

export class TransactionError extends DomainError<TransactionErrorCode> {
  constructor(code: TransactionErrorCode, message: string) {
    super(code, message);
    this.name = 'TransactionError';
  }
}
