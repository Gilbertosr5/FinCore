/**
 * Histórico de alterações importantes (auditoria funcional, não técnica).
 * Registra o que mudou, quando e um resumo legível — nunca dados sensíveis.
 */
export type AuditEntityType = 'transaction' | 'recurrence' | 'account' | 'category';

export type AuditAction =
  'created' | 'updated' | 'deleted' | 'cancelled' | 'paid' | 'unpaid' | 'archived' | 'restored';

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  created: 'Criado',
  updated: 'Alterado',
  deleted: 'Excluído',
  cancelled: 'Cancelado',
  paid: 'Liquidado',
  unpaid: 'Voltou a pendente',
  archived: 'Arquivado',
  restored: 'Restaurado',
};

export interface AuditEntry {
  id: string;
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  /** Instante ISO 8601 (com fuso). */
  at: string;
  summary: string;
}

/** Porta do histórico. Com a API, o backend registra o histórico por conta própria. */
export interface AuditLogRepository {
  findByEntity(entityType: AuditEntityType, entityId: string): Promise<AuditEntry[]>;
  append(entries: AuditEntry[]): Promise<void>;
}
