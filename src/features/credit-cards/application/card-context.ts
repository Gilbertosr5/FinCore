import type { AccountRepository } from '@/features/accounts/domain/repositories/account.repository';
import type {
  AuditAction,
  AuditEntityType,
  AuditEntry,
  AuditLogRepository,
} from '@/features/history/domain/audit-entry';
import type {
  CategoryRepository,
  TransactionRepository,
} from '@/features/transactions/domain/repositories/transaction.repository';
import type { IsoDate } from '@/lib/dates';

import type { CreditCardRepository } from '../domain/repositories/credit-card.repository';

/** Dependências dos casos de uso de cartões (injetadas na composição). */
export interface CreditCardContext {
  cards: CreditCardRepository;
  /** Pagamentos de fatura são transações `card_payment` no livro de lançamentos. */
  transactions: TransactionRepository;
  accounts: AccountRepository;
  categories: CategoryRepository;
  audit: AuditLogRepository;
  newId: () => string;
  today: () => IsoDate;
  now: () => string;
  /** Garante as ocorrências de recorrências antes de ler os lançamentos. */
  prepare?: () => Promise<unknown>;
}

export function cardAudit(
  context: CreditCardContext,
  entityType: AuditEntityType,
  entityId: string,
  action: AuditAction,
  summary: string,
): AuditEntry {
  return { id: context.newId(), entityType, entityId, action, at: context.now(), summary };
}
