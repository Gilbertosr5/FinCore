# FinCore — Pendências acumuladas

> Lista única de tudo o que ainda falta, foi adiado ou aguarda decisão.
> Atualize ao fim de cada fase: marque o que foi resolvido (com a fase) e
> acrescente o que surgir. Requisitos detalhados das fases: [`docs/ROADMAP.md`](./docs/ROADMAP.md).
> Estado geral: [`PROJECT_STATUS.md`](./PROJECT_STATUS.md). Retomada: [`CONTINUAR.md`](./CONTINUAR.md).

_Última atualização: 11/11/2026 — após a Fase 4._

## 1. Fases restantes do roadmap

| Fase | Escopo                                                                                                                                                                                                 | Status     |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| 5    | Cartões (CRUD, compras avulsas/parceladas, faturas, pagamento de fatura, histórico, parcelas futuras) e orçamentos (CRUD mensal/anual, por categoria/geral, planejado × realizado, alertas, histórico) | ⏳ próxima |
| 6    | Metas (CRUD, aportes/retiradas, concluir/cancelar, histórico) e planejamento (mensal/anual, projeções, simulações, cenários)                                                                           | —          |
| 7    | Investimentos (cadastro de ativos e movimentações, custo médio, rentabilidade por tipo, proventos, preparação para cotações externas e CDI/IPCA/Selic/Ibovespa)                                        | —          |
| 8    | Calendário financeiro e relatórios com exportação PDF/CSV                                                                                                                                              | —          |
| 9    | Qualidade final: acessibilidade, performance, segurança, revisão de E2E e documentação                                                                                                                 | —          |

## 2. Itens adiados das fases já entregues

### Funcionalidades

- [ ] **Central de notificações** do cabeçalho mostra só estado vazio — alimentar com os alertas do dashboard (Fase 5). Notificações push dependem do backend.
- [ ] **Busca global (Ctrl+K)** pesquisa apenas módulos — incluir lançamentos, contas e demais entidades.
- [ ] **Anexos em lançamentos** — dependem de armazenamento de arquivos no backend (prompt: "quando suportados").
- [ ] **Compras no cartão e pagamentos de fatura** aparecem como somente leitura em Transações (cadastro na Fase 5).
- [ ] **Aplicações/resgates de investimento** (`kind: investment`) não são editáveis em Transações (Fase 7).
- [ ] **Configurações** ainda sem: moeda principal, formato de data, fuso horário do usuário, preferências de notificações, exportação dos dados, exclusão da conta, histórico de sessões (os três últimos dependem do backend).
- [ ] **Perfil** é somente leitura (edição de nome/e-mail depende do backend).
- [ ] **Breadcrumbs** existem apenas no extrato da conta; generalizar quando houver mais rotas aninhadas.
- [ ] **Duplicar lançamento** abre o formulário preenchido (não cria cópia direta) — confirmar se esse comportamento atende.

### Técnicas

- [ ] **Bundle inicial ~150 kB gzip** (inclui Dexie, Zod e gerador de seed) — carregar o seed sob demanda e revisar divisão de código (Fase 9).
- [ ] **`npm audit`**: vulnerabilidades moderadas apenas em dependências de desenvolvimento (minimatch via plugins de ESLint); produção 0 — reavaliar a cada atualização.
- [ ] **Atualizar para TypeScript 7 e ESLint 10** quando `typescript-eslint`, `eslint-plugin-react` e `eslint-plugin-jsx-a11y` suportarem (ADR 0002).
- [ ] **Investimentos — cálculo simplificado**: sem custo médio contábil, TWR/MWR, IR, inflação ou come-cotas (ADR 0007) — Fase 7.
- [ ] **Seed de demonstração** é relativo à data de geração: recorrências avançam sozinhas, mas gastos variáveis param — usuário precisa usar Configurações → Restaurar dados. Avaliar geração incremental.
- [ ] **Biblioteca de PDF** ainda não escolhida (Fase 8).
- [ ] **Teste E2E de Ctrl+K** é ignorado no celular por desenho (atalho de teclado).

### Integração com o backend (Java + Spring Boot + PostgreSQL — ainda não existe)

- [ ] Implementar os contratos em [`docs/api-contract.md`](./docs/api-contract.md) e [`docs/auth-contract.md`](./docs/auth-contract.md) — os adaptadores REST do frontend existem, mas **nunca foram testados contra um servidor real**.
- [ ] Sessão por cookie HttpOnly/Secure/SameSite, refresh (`POST /auth/refresh`), CSRF (`XSRF-TOKEN`).
- [ ] `POST /transactions/batch` atômico; ids gerados no cliente (UUID) aceitos; materialização de recorrências compatível com o id `${recorrência}_${data}` (ADR 0009).
- [ ] Histórico de alterações registrado pelo backend na mesma transação (`GET /audit-log`).
- [ ] Paginação e filtros no servidor (hoje as listas leem tudo e filtram no cliente).
- [ ] Header `Idempotency-Key` (recomendado) e rate limiting (`429` + `Retry-After`).
- [ ] Mesmas regras de negócio no servidor (ADR 0007 e 0009): o cliente não é barreira de segurança.

## 3. Decisões tomadas sem confirmação do usuário (revisar se necessário)

- **Quinzenal = a cada 15 dias** (alternativas: 14 dias ou duas vezes por mês).
- **Login de demonstração** liberado em build de produção somente com `VITE_DEMO_MODE=true`.
- **Despesas por competência** no dashboard incluem lançamentos pendentes do período.
- **Parcela de cartão** conta na competência "data da compra + i meses".
- **Paleta dos gráficos** trocada por uma validada para daltonismo (ADR 0007).
- **Tipo de movimentação `investment`** criado para aplicações/resgates (evita dupla contagem no patrimônio).

## 4. Resolvidas (histórico)

- Fase 1: fonte Inter não carregada → passou a usar fontes do sistema (Fase 2).
- Fase 3: alerta de orçamento disparava em 79,998% (arredondamento) → comparação exata.
- Fase 3: `DatabaseClosedError` no StrictMode → banco não é mais fechado em desmontagem.
- Fase 4: rótulos de selects não associados aos campos; seed com gastos variáveis futuros; "Novembro De 2026".
