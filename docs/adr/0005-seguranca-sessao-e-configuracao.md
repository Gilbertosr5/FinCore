# ADR 0005 — Sessão, armazenamento no navegador e configuração

- **Status:** Aceito
- **Data:** 05/11/2026

## Decisão

### Sessão

- Em produção, a sessão é responsabilidade do backend, via **cookie HttpOnly,
  Secure, SameSite**. O frontend nunca lê, grava ou armazena tokens.
- O cliente HTTP usa `withCredentials: true` e é compatível com a proteção CSRF
  padrão do Spring Security (cookie `XSRF-TOKEN` → header `X-XSRF-TOKEN`).
- Respostas `401` disparam o callback `onUnauthorized` do cliente HTTP, onde a
  camada de autenticação (Fase 2) trata sessão expirada/refresh.

### Armazenamento no navegador

- `localStorage`: **apenas** preferências de interface não sensíveis (tema,
  sidebar recolhida). Chaves centralizadas em `src/constants/storage-keys.ts`.
- IndexedDB: dados **de demonstração** (Fases 3/4), identificados como tal.
- Nunca: senhas, tokens, dados bancários sensíveis.

### Configuração

- Variáveis `VITE_*` são validadas com Zod na inicialização
  (`src/app/config/env.schema.ts`). Configuração inválida exibe uma tela de erro
  de inicialização (falha rápida), sem tela em branco.
- **O adaptador de autenticação de desenvolvimento é bloqueado em builds de
  produção**, exceto com `VITE_DEMO_MODE=true` explícito. Quando a aplicação usa
  dados ou autenticação de demonstração, o cabeçalho exibe o selo
  "Modo demonstração" permanentemente.
- Variáveis `VITE_*` vão para o bundle público: nunca conter segredos.
