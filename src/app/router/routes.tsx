import { Navigate, type RouteObject } from 'react-router';

import { AppLayout } from '@/app/layout/AppLayout';
import { FullPageLoader } from '@/components/feedback/FullPageLoader';
import { ModulePlaceholder } from '@/components/feedback/ModulePlaceholder';
import { NotFoundPage } from '@/components/feedback/NotFoundPage';
import { RouteErrorBoundary } from '@/components/feedback/RouteErrorBoundary';
import { NAVIGATION_ITEMS } from '@/constants/navigation';
import { ROUTES } from '@/constants/routes';
import { AuthLayout } from '@/features/auth';

import { GuestRoute } from './GuestRoute';
import { ProtectedRoute } from './ProtectedRoute';
import { RootRoute } from './RootRoute';

/*
 * Páginas são carregadas sob demanda (code splitting por rota). Por isso são
 * importadas diretamente do módulo da página, e não do index da feature.
 */
const authPages = {
  login: () =>
    import('@/features/auth/presentation/pages/LoginPage').then((m) => ({
      Component: m.LoginPage,
    })),
  register: () =>
    import('@/features/auth/presentation/pages/RegisterPage').then((m) => ({
      Component: m.RegisterPage,
    })),
  forgotPassword: () =>
    import('@/features/auth/presentation/pages/ForgotPasswordPage').then((m) => ({
      Component: m.ForgotPasswordPage,
    })),
  resetPassword: () =>
    import('@/features/auth/presentation/pages/ResetPasswordPage').then((m) => ({
      Component: m.ResetPasswordPage,
    })),
  sessionExpired: () =>
    import('@/features/auth/presentation/pages/SessionExpiredPage').then((m) => ({
      Component: m.SessionExpiredPage,
    })),
  unauthorized: () =>
    import('@/features/auth/presentation/pages/UnauthorizedPage').then((m) => ({
      Component: m.UnauthorizedPage,
    })),
};

const loadSettingsPage = () =>
  import('@/features/settings/presentation/pages/SettingsPage').then((m) => ({
    Component: m.SettingsPage,
  }));

const loadDashboardPage = () =>
  import('@/features/dashboard/presentation/pages/DashboardPage').then((m) => ({
    Component: m.DashboardPage,
  }));

const loadTransactionsPage = () =>
  import('@/features/transactions/presentation/pages/TransactionsPage').then((m) => ({
    Component: m.TransactionsPage,
  }));

const loadAccountsPage = () =>
  import('@/features/accounts/presentation/pages/AccountsPage').then((m) => ({
    Component: m.AccountsPage,
  }));

const loadAccountStatementPage = () =>
  import('@/features/accounts/presentation/pages/AccountStatementPage').then((m) => ({
    Component: m.AccountStatementPage,
  }));

const loadCreditCardsPage = () =>
  import('@/features/credit-cards/presentation/pages/CreditCardsPage').then((m) => ({
    Component: m.CreditCardsPage,
  }));

const loadCreditCardDetailsPage = () =>
  import('@/features/credit-cards/presentation/pages/CreditCardDetailsPage').then((m) => ({
    Component: m.CreditCardDetailsPage,
  }));

const loadBudgetsPage = () =>
  import('@/features/budgets/presentation/pages/BudgetsPage').then((m) => ({
    Component: m.BudgetsPage,
  }));

const loadGoalsPage = () =>
  import('@/features/goals/presentation/pages/GoalsPage').then((m) => ({
    Component: m.GoalsPage,
  }));

const loadGoalDetailsPage = () =>
  import('@/features/goals/presentation/pages/GoalDetailsPage').then((m) => ({
    Component: m.GoalDetailsPage,
  }));

const loadPlanningPage = () =>
  import('@/features/planning/presentation/pages/PlanningPage').then((m) => ({
    Component: m.PlanningPage,
  }));

const loadInvestmentsPage = () =>
  import('@/features/investments/presentation/pages/InvestmentsPage').then((m) => ({
    Component: m.InvestmentsPage,
  }));

const loadAssetDetailsPage = () =>
  import('@/features/investments/presentation/pages/AssetDetailsPage').then((m) => ({
    Component: m.AssetDetailsPage,
  }));

const loadCalendarPage = () =>
  import('@/features/calendar/presentation/pages/CalendarPage').then((m) => ({
    Component: m.CalendarPage,
  }));

const loadReportsPage = () =>
  import('@/features/reports/presentation/pages/ReportsPage').then((m) => ({
    Component: m.ReportsPage,
  }));

/** Módulos já entregues (rota real); os demais exibem placeholder com a fase prevista. */
const deliveredModuleRoutes: RouteObject[] = [
  { path: ROUTES.dashboard, lazy: loadDashboardPage },
  { path: ROUTES.transactions, lazy: loadTransactionsPage },
  { path: ROUTES.accounts, lazy: loadAccountsPage },
  { path: `${ROUTES.accounts}/:accountId`, lazy: loadAccountStatementPage },
  { path: ROUTES.creditCards, lazy: loadCreditCardsPage },
  { path: `${ROUTES.creditCards}/:cardId`, lazy: loadCreditCardDetailsPage },
  { path: ROUTES.budgets, lazy: loadBudgetsPage },
  { path: ROUTES.goals, lazy: loadGoalsPage },
  { path: `${ROUTES.goals}/:goalId`, lazy: loadGoalDetailsPage },
  { path: ROUTES.planning, lazy: loadPlanningPage },
  { path: ROUTES.investments, lazy: loadInvestmentsPage },
  { path: `${ROUTES.investments}/:assetId`, lazy: loadAssetDetailsPage },
  { path: ROUTES.calendar, lazy: loadCalendarPage },
  { path: ROUTES.reports, lazy: loadReportsPage },
  { path: ROUTES.settings, lazy: loadSettingsPage },
];

const deliveredPaths = new Set(deliveredModuleRoutes.map((route) => route.path));

const pendingModuleRoutes: RouteObject[] = NAVIGATION_ITEMS.filter(
  (item) => !deliveredPaths.has(item.path),
).map((item) => ({ path: item.path, element: <ModulePlaceholder module={item} /> }));

export const appRoutes: RouteObject[] = [
  {
    path: ROUTES.root,
    element: <RootRoute />,
    errorElement: <RouteErrorBoundary />,
    hydrateFallbackElement: <FullPageLoader />,
    children: [
      // Somente visitantes
      {
        element: <GuestRoute />,
        children: [
          {
            element: <AuthLayout />,
            children: [
              { path: ROUTES.login, lazy: authPages.login },
              { path: ROUTES.register, lazy: authPages.register },
              { path: ROUTES.forgotPassword, lazy: authPages.forgotPassword },
            ],
          },
        ],
      },
      // Públicas (independem de sessão)
      {
        element: <AuthLayout />,
        children: [
          { path: ROUTES.resetPassword, lazy: authPages.resetPassword },
          { path: ROUTES.sessionExpired, lazy: authPages.sessionExpired },
          { path: ROUTES.unauthorized, lazy: authPages.unauthorized },
        ],
      },
      // Privadas
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { index: true, element: <Navigate to={ROUTES.dashboard} replace /> },
              ...deliveredModuleRoutes,
              ...pendingModuleRoutes,
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
