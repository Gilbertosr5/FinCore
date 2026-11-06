/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_NAME?: string;
  readonly VITE_DATA_SOURCE?: 'mock' | 'api';
  readonly VITE_AUTH_ADAPTER?: 'dev' | 'rest';
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_TIMEOUT_MS?: string;
  readonly VITE_DEFAULT_TIMEZONE?: string;
  readonly VITE_DEMO_MODE?: 'true' | 'false';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
