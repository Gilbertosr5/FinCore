import { Outlet } from 'react-router';

import { AuthSessionListener } from '@/features/auth';

/** Rota raiz: serviços que dependem do roteador e valem para todas as telas. */
export function RootRoute() {
  return (
    <>
      <AuthSessionListener />
      <Outlet />
    </>
  );
}
