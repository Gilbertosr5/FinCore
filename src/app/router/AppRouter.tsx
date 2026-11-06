import { createBrowserRouter, RouterProvider } from 'react-router';

import { appRoutes } from './routes';

const router = createBrowserRouter(appRoutes);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
