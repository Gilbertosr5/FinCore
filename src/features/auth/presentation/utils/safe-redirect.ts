import { AUTH_ROUTE_PATHS, ROUTES } from '@/constants/routes';

interface LocationLike {
  pathname: string;
  search?: string;
  hash?: string;
}

function isLocationLike(value: unknown): value is LocationLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    'pathname' in value &&
    typeof value.pathname === 'string'
  );
}

/**
 * Destino seguro após autenticação. Aceita apenas caminhos internos, impedindo
 * "open redirect" (ex.: //site-malicioso.com, https://..., /\\site) e evitando
 * voltar para as próprias telas de autenticação.
 */
export function getSafeRedirectPath(from: unknown, fallback: string = ROUTES.dashboard): string {
  let path: string;
  if (typeof from === 'string') {
    path = from;
  } else if (isLocationLike(from)) {
    path = `${from.pathname}${from.search ?? ''}${from.hash ?? ''}`;
  } else {
    return fallback;
  }

  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return fallback;
  if (/\p{Cc}/u.test(path)) return fallback; // caracteres de controle (ex.: \t, \n)

  const pathname = path.split(/[?#]/)[0] ?? '';
  if (pathname === ROUTES.root || AUTH_ROUTE_PATHS.includes(pathname)) return fallback;

  return path;
}

/** Lê `state.from` de um location do React Router com segurança de tipos. */
export function getFromState(state: unknown): unknown {
  return typeof state === 'object' && state !== null && 'from' in state ? state.from : undefined;
}
