import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

import { contentSecurityPolicy } from './build/csp-plugin.ts';

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    // CSP só no build de produção (ADR 0014); inclui a origem da API se for externa.
    contentSecurityPolicy({
      apiBaseUrl: loadEnv(mode, process.cwd(), 'VITE_').VITE_API_BASE_URL,
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    // Encaminha /api ao backend (fincore-api) — mesma origem para cookies e CSRF.
    // Usado com `npm run dev:api` (.env.api). Destino: FINCORE_API_URL ou :8080.
    proxy: {
      '/api': process.env.FINCORE_API_URL ?? 'http://localhost:8080',
    },
  },
  build: {
    sourcemap: true,
    target: 'es2022',
  },
}));
