import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { ROUTES } from '@/constants/routes';
import { sessionEvents } from '@/services/auth/session-events';

import type { User } from '../../domain/entities/user';
import { authQueryKeys } from '../hooks/use-auth';

/**
 * Reage à expiração de sessão detectada pela camada HTTP, levando o usuário à
 * tela de sessão expirada e preservando o destino para retornar após novo login.
 */
export function AuthSessionListener() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const locationRef = useRef(location);

  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  useEffect(
    () =>
      sessionEvents.subscribe(() => {
        const wasAuthenticated = Boolean(
          queryClient.getQueryData<User | null>(authQueryKeys.currentUser),
        );
        // 401 sem sessão ativa (ex.: visitante) não é "sessão expirada".
        if (!wasAuthenticated) return;
        // Vários 401 simultâneos geram vários eventos: navega uma única vez.
        if (locationRef.current.pathname === ROUTES.sessionExpired) return;
        void queryClient.cancelQueries();
        // A limpeza do cache acontece ao montar a tela de sessão expirada
        // (SessionExpiredPage). Limpar aqui faria a rota protegida, ainda
        // montada durante a transição, redirecionar ao login antes.
        void navigate(ROUTES.sessionExpired, {
          replace: true,
          state: { from: locationRef.current },
        });
      }),
    [queryClient, navigate],
  );

  return null;
}
