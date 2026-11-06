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

/** Módulos ainda não entregues: exibem placeholder com a fase prevista. */
const pendingModuleRoutes: RouteObject[] = NAVIGATION_ITEMS.filter(
  (item) => item.path !== ROUTES.settings,
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
              ...pendingModuleRoutes,
              { path: ROUTES.settings, lazy: loadSettingsPage },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
