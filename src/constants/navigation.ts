import {
  ArrowLeftRight,
  CalendarDays,
  ChartPie,
  CreditCard,
  FileChartColumn,
  Goal,
  Landmark,
  LayoutDashboard,
  type LucideIcon,
  Settings,
  TrendingUp,
  WalletCards,
} from 'lucide-react';

import { ROUTES, type AppRoutePath } from './routes';

export interface NavigationItem {
  id: string;
  label: string;
  path: AppRoutePath;
  icon: LucideIcon;
  description: string;
  /** Fase do roadmap em que o módulo é entregue (ver PROJECT_STATUS.md). */
  deliveryPhase: number;
}

export const NAVIGATION_ITEMS: readonly NavigationItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    path: ROUTES.dashboard,
    icon: LayoutDashboard,
    description: 'Visão consolidada da sua situação financeira.',
    deliveryPhase: 3,
  },
  {
    id: 'transactions',
    label: 'Transações',
    path: ROUTES.transactions,
    icon: ArrowLeftRight,
    description: 'Receitas, despesas, transferências, recorrências e parcelamentos.',
    deliveryPhase: 4,
  },
  {
    id: 'accounts',
    label: 'Contas',
    path: ROUTES.accounts,
    icon: Landmark,
    description: 'Contas bancárias, saldos e extratos.',
    deliveryPhase: 4,
  },
  {
    id: 'credit-cards',
    label: 'Cartões',
    path: ROUTES.creditCards,
    icon: CreditCard,
    description: 'Cartões de crédito, faturas, limites e parcelas.',
    deliveryPhase: 5,
  },
  {
    id: 'budgets',
    label: 'Orçamentos',
    path: ROUTES.budgets,
    icon: WalletCards,
    description: 'Limites de gastos por categoria e período.',
    deliveryPhase: 5,
  },
  {
    id: 'goals',
    label: 'Metas',
    path: ROUTES.goals,
    icon: Goal,
    description: 'Objetivos financeiros, aportes e progresso.',
    deliveryPhase: 6,
  },
  {
    id: 'investments',
    label: 'Investimentos',
    path: ROUTES.investments,
    icon: TrendingUp,
    description: 'Carteira, proventos, rentabilidade e distribuição.',
    deliveryPhase: 7,
  },
  {
    id: 'planning',
    label: 'Planejamento',
    path: ROUTES.planning,
    icon: ChartPie,
    description: 'Projeções, simulações e cenários futuros.',
    deliveryPhase: 6,
  },
  {
    id: 'calendar',
    label: 'Calendário',
    path: ROUTES.calendar,
    icon: CalendarDays,
    description: 'Compromissos financeiros ao longo do tempo.',
    deliveryPhase: 8,
  },
  {
    id: 'reports',
    label: 'Relatórios',
    path: ROUTES.reports,
    icon: FileChartColumn,
    description: 'Análises, indicadores e exportações em PDF e CSV.',
    deliveryPhase: 8,
  },
  {
    id: 'settings',
    label: 'Configurações',
    path: ROUTES.settings,
    icon: Settings,
    description: 'Perfil, preferências e segurança.',
    deliveryPhase: 2,
  },
];
