# ADR 0014 — Qualidade final: acessibilidade, performance, segurança e erros

- **Status:** Aceito
- **Data:** 12/11/2026

## Contexto

A Fase 9 revisa a aplicação inteira (todos os módulos entregues) quanto a
acessibilidade, performance, segurança, tratamento de erros e documentação, e
fecha pendências pequenas (busca global com entidades, exportação dos dados).

## Decisões

### Acessibilidade

1. **Auditoria automática no E2E** (`tests/e2e/accessibility.spec.ts`, axe-core 4.11,
   WCAG 2.1 A/AA): todas as rotas públicas e autenticadas, temas claro e escuro,
   desktop e celular. Zero violações é critério do portão de qualidade.
2. **Contraste dos tokens** (corrigido a partir da auditoria):
   - escuro: `--primary` violeta 300 (`#c4b5fd`) com texto escuro e `--destructive`
     vermelho 400 com texto escuro — o violeta 500 não atingia 4,5:1 nem como texto
     sobre o card nem como fundo de botão com texto branco;
   - claro: primária violeta 700, texto secundário slate 600, sucesso verde 800,
     atenção âmbar 800 e erro vermelho 700 (inclusive sobre os fundos translúcidos
     de badges).
3. **Tabelas roláveis**: quando rolam na horizontal, o contêiner vira
   `role="region"` nomeado e focável (WCAG 2.1.1). A regra
   `jsx-a11y/no-noninteractive-tabindex` foi **configurada** para aceitar `region`
   (opção documentada da regra), não desabilitada.

### Performance

4. O gerador do seed e o **Dexie** (IndexedDB) são carregados **sob demanda**:
   `createDemoDataStore` importa `demo-database.ts` na primeira operação e a
   composição importa o seed só ao criar/restaurar os dados. No modo API eles nunca
   são baixados. Chunk `App`: 339 kB → **231 kB** (66 kB gzip). jsPDF (Fase 8) já é
   sob demanda.

### Segurança

5. **Content Security Policy** no build de produção (`build/csp-plugin.ts`, meta
   tag): `default-src 'self'`; scripts só da origem + o script inline de tema por
   **hash SHA-256** (sem `'unsafe-inline'` para scripts); estilos com
   `'unsafe-inline'` (atributos `style` de gráficos/barras/Radix); `connect-src`
   inclui a origem de `VITE_API_BASE_URL` quando externa; `object-src 'none'`,
   `base-uri`/`form-action 'self'`, `worker-src 'none'`; `Referrer-Policy`
   `strict-origin-when-cross-origin`. Não é aplicada no servidor de
   desenvolvimento (HMR). Headers que só funcionam no servidor (frame-ancestors,
   HSTS…) estão em `docs/seguranca.md`. E2E verifica a CSP e a ausência de
   violações, inclusive ao exportar PDF.

### Tratamento de erros

6. `getErrorMessage` passa a orientar em erros de **armazenamento local**
   (cota esgotada, IndexedDB indisponível/navegação privada, banco bloqueado por
   outra aba, versão) e em **falha ao carregar módulos** (nova versão publicada ou
   conexão) — também na tela de erro de rota. Demais erros continuam genéricos
   (sem vazar detalhes técnicos).

### Pendências fechadas

7. **Busca global (Ctrl+K)** com entidades: contas, cartões, metas, ativos,
   orçamentos e os lançamentos mais recentes, sem acentos/maiúsculas, com espera de
   200 ms e descarte de respostas antigas. O componente (camada `components`)
   recebe a fonte por contexto (`CommandSearchSourceContext`); a feature `search`
   implementa a consulta.
8. **Exportação dos dados** (Configurações → Seus dados): JSON com todos os
   registros no formato dos DTOs da API (`format: fincore-export`, `version: 1`),
   gerado no navegador; não inclui senhas nem o histórico de alterações.

## Consequências

- Portão de qualidade passa a incluir acessibilidade (axe) e segurança (CSP) no E2E.
- O tema escuro ganhou botões primários claros com texto escuro — mudança visual
  intencional por contraste.
- Pendências que dependem do backend (exclusão de conta, histórico de sessões,
  notificações push, preferências persistidas) continuam abertas.
