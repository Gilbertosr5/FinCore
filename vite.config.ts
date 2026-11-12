import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
});
