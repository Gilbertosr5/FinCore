import { createContext, useContext } from 'react';

import type { AuditLogRepository } from '../../domain/audit-entry';

export interface HistoryServices {
  repository: AuditLogRepository;
}

export const HistoryServicesContext = createContext<HistoryServices | null>(null);

export function useHistoryServices(): HistoryServices {
  const services = useContext(HistoryServicesContext);
  if (!services) throw new Error('useHistoryServices deve ser usado dentro de <DataProvider>.');
  return services;
}
