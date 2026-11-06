import { useSyncExternalStore } from 'react';

import { resolveTheme, useThemeStore, type ResolvedTheme } from '@/stores/theme.store';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function subscribe(callback: () => void) {
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener('change', callback);
  return () => {
    media.removeEventListener('change', callback);
  };
}

function getSystemPrefersDark() {
  return window.matchMedia(DARK_QUERY).matches;
}

/** Tema efetivamente aplicado, considerando a preferência "sistema". */
export function useResolvedTheme(): ResolvedTheme {
  const preference = useThemeStore((state) => state.preference);
  const systemPrefersDark = useSyncExternalStore(subscribe, getSystemPrefersDark, () => true);
  return resolveTheme(preference, systemPrefersDark);
}
