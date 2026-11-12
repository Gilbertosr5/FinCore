import type { AccountRepository } from '@/features/accounts/domain/repositories/account.repository';
import type {
  AuditAction,
  AuditEntityType,
  AuditEntry,
  AuditLogRepository,
} from '@/features/history/domain/audit-entry';
import type { IsoDate } from '@/lib/dates';

import type { Transaction } from '../domain/entities/transaction';
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

/**
 * Lançamentos validados e montados, mas ainda NÃO gravados: quem os pede (metas,
 * investimentos) grava junto com o próprio registro, de forma atômica (ADR 0015),
 * e chama `confirm` depois para registrar o histórico.
 */
export interface PreparedLedgerWrite {
  transactions: Transaction[];
  confirm: () => Promise<void>;
}

/** Lançamentos vinculados a remover junto com o registro de origem (lista vazia = já excluídos). */
export interface PreparedLedgerRemoval {
  transactionIds: string[];
  confirm: () => Promise<void>;
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
