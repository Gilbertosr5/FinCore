import {
  NotificationsButton,
  type NotificationItem,
} from '@/components/layout/NotificationsButton';
import { creditCardPath, ROUTES, accountStatementPath } from '@/constants/routes';

import type { DashboardAlert } from '../../domain/overview-types';
import { useDashboardOverview } from '../hooks/use-dashboard-overview';

const CURRENT_MONTH = { preset: 'current_month' } as const;

function alertHref(alert: DashboardAlert): string {
  switch (alert.module) {
    case 'accounts':
      return alert.entityId ? accountStatementPath(alert.entityId) : ROUTES.accounts;
    case 'transactions':
      return `${ROUTES.transactions}?situacao=pending`;
    case 'credit-cards':
      return alert.entityId ? creditCardPath(alert.entityId) : ROUTES.creditCards;
    case 'budgets':
      return ROUTES.budgets;
    case 'dashboard':
      return ROUTES.dashboard;
  }
}

/**
 * Central de notificações alimentada pelos alertas do dashboard (mês atual).
 * Compartilha o cache da consulta do dashboard: não há leitura duplicada.
 */
export function FinancialNotifications() {
  const overview = useDashboardOverview(CURRENT_MONTH);
  const items: NotificationItem[] = (overview.data?.alerts ?? []).map((alert) => ({
    id: alert.id,
    severity: alert.severity,
    title: alert.title,
    description: alert.description,
    href: alertHref(alert),
  }));
  const status = overview.isError ? 'error' : overview.isPending ? 'loading' : 'ready';
  return <NotificationsButton items={items} status={status} />;
}
