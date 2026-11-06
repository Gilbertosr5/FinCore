# ADR 0001 — Arquitetura Feature-Based com Clean Architecture pragmática

- **Status:** Aceito
- **Data:** 05/11/2026

## Contexto

O FinCore terá muitos módulos (transações, contas, cartões, orçamentos, metas,
investimentos, planejamento, calendário, relatórios) e precisa evoluir para um
backend REST (Java + Spring Boot) sem reescrita do frontend. Regras financeiras
são críticas e precisam ser testáveis isoladamente.

## Decisão

1. **Organização por feature** (`src/features/<feature>`), cada uma com limites
   claros e um `index.ts` como API pública.
2. Dentro de cada feature, **quatro camadas**, criadas somente quando há conteúdo real:
   - `domain/` — entidades, tipos, regras puras e **contratos** de repositório.
     Não depende de React, Axios, stores ou infraestrutura.
   - `application/` — casos de uso que orquestram o domínio e os repositórios.
   - `infrastructure/` — implementações `Mock*Repository` (IndexedDB) e
     `Api*Repository` (REST), além de mappers DTO ⇄ domínio.
   - `presentation/` — páginas, componentes, hooks (TanStack Query) e schemas Zod.
3. **Código compartilhado** fora das features:
   - `src/lib` — utilitários puros e transversais (`money`, `dates`, `query-client`).
   - `src/components` — design system (`ui`), layout, feedback e exibição de dados.
   - `src/services` — infraestrutura transversal (cliente HTTP, autenticação, storage).
   - `src/stores` — estado **de interface** (Zustand). Dados de negócio ficam no TanStack Query.
   - `src/constants` — rotas, navegação, chaves de armazenamento.
4. **Regras verificadas automaticamente pelo ESLint** (`eslint.config.js`):
   - domínio e `lib/money`/`lib/dates` não importam React, Axios, stores, services ou componentes;
   - componentes e `presentation/` não importam Axios nem `@/services/api/*`;
   - `import-x/no-cycle` impede dependências circulares.
5. A seleção `Mock` × `Api` é feita por configuração (`VITE_DATA_SOURCE`), em um
   único ponto de composição por feature.

## Consequências

- Regras de negócio testáveis sem DOM nem rede.
- Trocar a fonte de dados não afeta páginas nem casos de uso.
- Mais arquivos por feature; mitigado criando camadas apenas quando necessárias
  (nada de pastas ou interfaces vazias "para preencher estrutura").
- Imports entre features devem passar pelo `index.ts` da feature.
