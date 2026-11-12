import type { AccountRepository } from '@/features/accounts/domain/repositories/account.repository';
import type {
  AuditAction,
  AuditEntityType,
  AuditEntry,
  AuditLogRepository,
} from '@/features/history/domain/audit-entry';
import type { IsoDate } from '@/lib/dates';

import type {
  CategoryRepository,
  TransactionRepository,
} from '../domain/repositories/transaction.repository';

/** Dependências dos casos de uso de lançamentos (injetadas na composição). */
export interface LedgerContext {
  transactions: TransactionRepository;
  accounts: AccountRepository;
  categories: CategoryRepository;
  audit: AuditLogRepository;
  /** Gera identificadores únicos (UUID v4 no navegador). */
  newId: () => string;
  /** Data atual no fuso do usuário. */
  today: () => IsoDate;
  /** Instante atual em ISO 8601 (para o histórico). */
  now: () => string;
}

export function auditEntry(
  context: LedgerContext,
  entityType: AuditEntityType,
  entityId: string,
  action: AuditAction,
  summary: string,
): AuditEntry {
  return { id: context.newId(), entityType, entityId, action, at: context.now(), summary };
}
