import type { AxiosInstance } from 'axios';
import { z } from 'zod';

import { parseRecords } from '@/lib/schemas/parse-records';
import { idField } from '@/lib/schemas/record-fields';
import { fetchList } from '@/services/api/list-resource';
import type { DemoDataStore } from '@/services/storage/demo-data-store';

import type { AuditEntityType, AuditEntry, AuditLogRepository } from '../domain/audit-entry';

export const AUDIT_ENDPOINTS = { list: '/audit-log' } as const;

export const auditEntryRecordSchema = z
  .object({
    id: idField,
    entityType: z.enum([
      'transaction',
      'recurrence',
      'account',
      'category',
      'credit_card',
      'card_purchase',
      'budget',
      'goal',
      'asset',
    ]),
    entityId: idField,
    action: z.enum([
      'created',
      'updated',
      'deleted',
      'cancelled',
      'paid',
      'unpaid',
      'archived',
      'restored',
    ]),
    at: z.string().min(1),
    summary: z.string(),
  })
  .transform((record): AuditEntry => record);

const byNewest = (a: AuditEntry, b: AuditEntry) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0);

export class DemoAuditLogRepository implements AuditLogRepository {
  constructor(private readonly store: DemoDataStore) {}

  async findByEntity(entityType: AuditEntityType, entityId: string): Promise<AuditEntry[]> {
    const entries = parseRecords(
      auditEntryRecordSchema,
      await this.store.readAll('auditLog'),
      'auditLog',
    );
    return entries
      .filter((entry) => entry.entityType === entityType && entry.entityId === entityId)
      .sort(byNewest);
  }

  async append(entries: AuditEntry[]): Promise<void> {
    if (entries.length === 0) return;
    await this.store.write({ put: { auditLog: entries.map((entry) => ({ ...entry })) } });
  }
}

/**
 * Com a API, o histórico é responsabilidade do backend (registrado na mesma
 * transação da alteração). O cliente apenas consulta.
 */
export class ApiAuditLogRepository implements AuditLogRepository {
  constructor(private readonly http: AxiosInstance) {}

  async findByEntity(entityType: AuditEntityType, entityId: string): Promise<AuditEntry[]> {
    const query = new URLSearchParams({ entityType, entityId }).toString();
    return (
      await fetchList(this.http, `${AUDIT_ENDPOINTS.list}?${query}`, auditEntryRecordSchema)
    ).sort(byNewest);
  }

  append(): Promise<void> {
    return Promise.resolve();
  }
}
