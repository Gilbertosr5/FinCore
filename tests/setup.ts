import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

type MediaQueryListStub = Pick<
  MediaQueryList,
  'matches' | 'media' | 'onchange' | 'addEventListener' | 'removeEventListener' | 'dispatchEvent'
>;

// jsdom não implementa matchMedia; padrão: sistema em modo escuro.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string): MediaQueryListStub => ({
    matches: query.includes('dark'),
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

// Necessário para componentes Radix (tooltips, popovers) em jsdom.
if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {
      /* noop */
    }
    unobserve() {
      /* noop */
    }
    disconnect() {
      /* noop */
    }
  };
}

// Rotas carregadas sob demanda (lazy) podem levar mais de 1s sob carga da suíte completa.
configure({ asyncUtilTimeout: 4000 });

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
});
