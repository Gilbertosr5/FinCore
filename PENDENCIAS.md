# FinCore — Pendências acumuladas

> Lista única de tudo o que ainda falta, foi adiado ou aguarda decisão.
> Atualize ao fim de cada fase: marque o que foi resolvido (com a fase) e
> acrescente o que surgir. Requisitos detalhados das fases: [`docs/ROADMAP.md`](./docs/ROADMAP.md).
> Estado geral: [`PROJECT_STATUS.md`](./PROJECT_STATUS.md). Retomada: [`CONTINUAR.md`](./CONTINUAR.md).

_Última atualização: 12/11/2026 — após a Fase 9 (todas as fases do plano entregues)._

## 1. Fases restantes do roadmap

| Fase | Escopo                                                                                                                                                                                                 | Status       |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| 5    | Cartões (CRUD, compras avulsas/parceladas, faturas, pagamento de fatura, histórico, parcelas futuras) e orçamentos (CRUD mensal/anual, por categoria/geral, planejado × realizado, alertas, histórico) | ✅ concluída |
| 6    | Metas (CRUD, aportes/retiradas, concluir/cancelar, histórico) e planejamento (mensal/anual, projeções, simulações, cenários)                                                                           | ✅ concluída |
| 7    | Investimentos (cadastro de ativos e movimentações, custo médio, rentabilidade por tipo, proventos, preparação para cotações externas e CDI/IPCA/Selic/Ibovespa)                                        | ✅ concluída |
| 8    | Calendário financeiro e relatórios com exportação PDF/CSV                                                                                                                                              | ✅ concluída |
| 9    | Qualidade final: acessibilidade, performance, segurança, revisão de E2E e documentação                                                                                                                 | ✅ concluída |

## 2. Itens adiados das fases já entregues

### Funcionalidades

- [ ] **Notificações**: marcar como lida, preferências e push dependem do backend (a central já mostra os alertas do mês — Fase 5).
- [ ] **Calendário/relatórios**: lembretes por e-mail/push (backend); gráficos por categoria no PDF; agendamento/envio de relatórios; relatórios anuais com orçamentos anuais.
- [ ] **Relatórios no backend**: com volume real, mover agregações para o servidor mantendo a estrutura de tabela (contrato em `docs/api-contract.md`).
- [ ] **Busca global**: no modo API a busca lê todos os registros no cliente; com volume real, criar `GET /search?q=` no backend (mesmo formato de resultado).
- [ ] **Anexos em lançamentos** — dependem de armazenamento de arquivos no backend (prompt: "quando suportados").
- [ ] **Pagamentos de fatura** seguem somente leitura em Transações (são gerenciados em Cartões) — avaliar um atalho "abrir no cartão" a partir do lançamento.
- [ ] **Cartões**: estorno parcial de compra / crédito em fatura não são modelados (cancelar = estorno integral); antecipar parcelas de faturas futuras não é permitido.
- [ ] **Metas**: excluir a transferência de um aporte em Transações não apaga o aporte (a destinação continua); avaliar aviso/vínculo na tela de Transações.
- [ ] **Planejamento**: cenários personalizados e grandes compras simuladas não são salvos; projeção sem sazonalidade (ex.: 13º, IPVA), inflação, rendimento de contas ou data exata de pagamento das faturas; média de variáveis usa só 3 meses.
- [ ] **Simulador** não usa metas existentes como ponto de partida (preencher a partir de uma meta) — melhoria de UX.
- [ ] **Orçamentos**: histórico compara períodos passados com o limite **atual** (limite não é versionado por período); sem limites diferentes por mês específico.
- [ ] **Lançamentos de investimento** (`kind: investment` e proventos gerados pela carteira) seguem somente leitura em Transações — avaliar atalho "abrir no ativo".
- [ ] **Investimentos**: editar movimentação (hoje: excluir e registrar de novo); eventos corporativos (desdobramento, grupamento, bonificação); comparação da carteira com CDI/IPCA quando houver indicadores.
- [ ] **Configurações** ainda sem: moeda principal, formato de data, fuso horário do usuário, preferências de notificações, exclusão da conta, histórico de sessões (os três últimos dependem do backend). Importação do JSON exportado também não existe.
- [ ] **Perfil** é somente leitura (edição de nome/e-mail depende do backend).
- [ ] **Breadcrumbs** existem apenas no extrato da conta; generalizar quando houver mais rotas aninhadas.
- [ ] **Duplicar lançamento** abre o formulário preenchido (não cria cópia direta) — confirmar se esse comportamento atende.

### Técnicas

- [ ] **Bundle inicial**: `App` 231 kB (66 kB gzip) + `index` ~255 kB (81 kB gzip, React/Router/Query/Radix). Próximo ganho seria dividir o `index` (vendor) — baixo retorno hoje.
- [ ] **`npm audit`**: vulnerabilidades moderadas apenas em dependências de desenvolvimento (minimatch via plugins de ESLint); produção 0 — reavaliar a cada atualização.
- [ ] **Headers de segurança no servidor** (frame-ancestors, HSTS, nosniff, Permissions-Policy, cache do `index.html`): definir no deploy conforme [`docs/seguranca.md`](./docs/seguranca.md). A CSP do build é por `<meta>`.
- [ ] **CSP `style-src 'unsafe-inline'`**: necessário pelos atributos `style` (gráficos, barras, Radix); remover exigiria nonces no servidor.
- [ ] **Auditoria a11y** é automática (axe) — falta uma rodada manual com leitor de tela (NVDA/VoiceOver).
- [ ] **Tema escuro**: botões primários passaram a violeta claro com texto escuro (contraste AA) — confirmar se agrada visualmente.
- [ ] **Atualizar para TypeScript 7 e ESLint 10** quando `typescript-eslint`, `eslint-plugin-react` e `eslint-plugin-jsx-a11y` suportarem (ADR 0002).
- [ ] **Investimentos — metodologia**: retorno simples sobre o aplicado (sem TWR/MWR), sem apuração de IR sobre ganho de capital nem come-cotas (ADR 0012).
- [ ] **Seed de demonstração** é relativo à data de geração: recorrências avançam sozinhas, mas gastos variáveis param — usuário precisa usar Configurações → Restaurar dados. Avaliar geração incremental.
- [ ] **Teste E2E de Ctrl+K** é ignorado no celular por desenho (atalho de teclado).
- [ ] **Alterar dias de fechamento/vencimento** recalcula todas as faturas, inclusive as passadas (faturas são derivadas) — avaliar guardar o calendário histórico se o usuário mudar o vencimento com frequência.
- [ ] **Rotas REST** `/credit-cards/{id}` e `/credit-cards/purchases/{id}` compartilham prefixo: o backend deve impedir um cartão com id `purchases` (ids são UUID).

### ▶ Próxima etapa — Integração com o backend (Node.js + TypeScript + PostgreSQL — `../fincore-api`, criado em 11/11/2026)

Detalhes, como rodar e pendências próprias: [`../fincore-api/README.md`](../fincore-api/README.md).

- [x] Contratos de [`docs/api-contract.md`](./docs/api-contract.md) e [`docs/auth-contract.md`](./docs/auth-contract.md) implementados (Fastify + Drizzle; 38 testes de integração).
- [x] Sessão por cookie HttpOnly/SameSite(/Secure), refresh com rotação, CSRF (`XSRF-TOKEN`), rate limiting (`429` + `Retry-After`).
- [x] `POST /transactions/batch` atômico; ids do cliente aceitos (inclui `${recorrência}_${data}`); histórico na mesma transação (`GET /audit-log`).
- [x] Endpoints das Fases 5–7 com as regras de limite disponível, datas, orçamento ativo único, saldo de metas, venda acima da carteira, avaliação única por data.
- [x] **Frontend ligado à API** (11/11/2026): `npm run dev:api` (porta 5180, `.env.api`) + proxy `/api` do Vite → `fincore-api` em `:8080` (mesma origem para cookies e `X-XSRF-TOKEN`). Verificado manualmente no navegador: cadastro, login/logout, sessão após recarregar, contas, despesa recorrente, marcar como pago, cartão, compra parcelada, pagamento de fatura, orçamento, meta + aporte, ativo + compra debitando conta, relatórios.
- [ ] Testes E2E automatizados no modo API (hoje o Playwright usa só o build de demonstração) e aporte com transferência (meta com conta) ainda não exercitados contra o servidor.
- [ ] Backend ainda não valida: valor máximo/fatura futura no pagamento de fatura; resgate acima do valor da posição.
- [ ] Paginação e filtros no servidor; `Idempotency-Key`; provedor de e-mail; `GET /market/indicators` (hoje `501`) e cotações (`market_quote`).
- [ ] Endpoints atômicos: aporte + transferência e movimentação + lançamento (hoje o cliente compensa).

## 3. Decisões tomadas sem confirmação do usuário (revisar se necessário)

- **Quinzenal = a cada 15 dias** (alternativas: 14 dias ou duas vezes por mês).
- **Login de demonstração** liberado em build de produção somente com `VITE_DEMO_MODE=true`.
- **Despesas por competência** no dashboard incluem lançamentos pendentes do período.
- **Parcela de cartão** conta na competência "data da compra + i meses".
- **Paleta dos gráficos** trocada por uma validada para daltonismo (ADR 0007).
- **Tipo de movimentação `investment`** criado para aplicações/resgates (evita dupla contagem no patrimônio).
- **Fase 5 — cartões:** compra acima do limite disponível é **recusada**; data da compra não pode ser futura; até **48 parcelas** no cartão (em conta são 120); cancelar compra = estorno integral; cartão cancelado sai dos totais de limite, mas suas faturas continuam pagáveis; excluir cartão só sem compras/pagamentos.
- **Fase 5 — faturas:** pagamento **parcial** e **antecipado** (fatura aberta) permitidos; não é possível pagar fatura futura nem valor acima do saldo em aberto; estorno cancela o pagamento.
- **Fase 5 — orçamentos:** um único orçamento **ativo** por categoria (ou geral) e período; "limites personalizados" = limite e limiar de alerta próprios de cada orçamento; consumo inclui despesas **pendentes** (mesmo critério do dashboard); histórico usa o limite atual.
- **Fase 8 — calendário/relatórios:** semana de domingo a sábado; realizados ocultos por padrão; comprometimento da renda = despesas fixas ÷ receitas; com conta filtrada, parcelas de cartão ficam de fora e transferências contam no fluxo de caixa; patrimônio e orçamentos ignoram o filtro de conta; compromissos futuros = próximos 12 meses; CSV com `;`, vírgula decimal e BOM; PDF com jsPDF (versões fixadas).
- **Fase 7 — investimentos:** ações, FIIs, ETFs e cripto exigem quantidade (compra/venda); demais classes usam aporte/resgate; taxas somam ao custo; impostos reduzem proventos; taxas/impostos não movimentam conta; resgate limitado ao valor da posição; uma avaliação por data; valor atual = última avaliação + aplicações posteriores pelo custo; retorno total = não realizado + realizado + proventos sobre o total aplicado.
- **Fase 6 — metas:** aporte pode registrar (opcionalmente) a transferência para a conta da meta; concluir é permitido sem atingir o valor; excluir só sem aportes; ritmo = média dos últimos 6 meses.
- **Fase 6 — planejamento:** nada é gravado; cenários otimista (+5% receitas, −10% variáveis) e conservador (−10% receitas, +10% variáveis); ajustes de despesa só sobre a parte estimada; ponto de partida = contas − faturas já devidas; estimativa de variáveis = média dos últimos 3 meses completos; simulador com aportes no fim do mês, sem impostos/inflação.
- **Fase 9 — qualidade:** tokens de cor ajustados para contraste AA (primária clara no tema escuro); CSP por meta tag só no build; busca global com até 6 lançamentos mais recentes e espera de 200 ms; exportação em JSON no formato dos DTOs da API, sem o histórico de alterações (ADR 0014).
- **Fase 5 — notificações:** a central mostra os alertas do **mês atual** do dashboard; o contador considera só alertas críticos e de atenção.

## 4. Resolvidas (histórico)

- Fase 1: fonte Inter não carregada → passou a usar fontes do sistema (Fase 2).
- Fase 3: alerta de orçamento disparava em 79,998% (arredondamento) → comparação exata.
- Fase 3: `DatabaseClosedError` no StrictMode → banco não é mais fechado em desmontagem.
- Fase 4: rótulos de selects não associados aos campos; seed com gastos variáveis futuros; "Novembro De 2026".
- Fase 9: contraste insuficiente em vários tokens (axe, dois temas); tabelas roláveis sem acesso por teclado; bundle inicial de 339 kB → 231 kB; sem CSP; mensagens genéricas em falhas do IndexedDB/carregamento de módulos; busca global só de módulos; exportação dos dados.
- Fase 8: calendário financeiro, 11 relatórios, exportação CSV/PDF e escolha da biblioteca de PDF; caracteres invisíveis gravados no código.
- Fase 7: carteira gravável com custo médio, movimentações com conta e avaliações; valor atual ignorava aplicações posteriores à última avaliação.
- Fase 6: metas graváveis, aportes/retiradas, planejamento e simulações; chunk inicial de 675 kB causado por reexport do `TrendChart`.
- Fase 5: central de notificações alimentada pelos alertas; cadastro de compras e pagamentos de fatura; fatura aberta marcada no mês errado quando o mês corrente não tinha compras; fatura fechada sem valor aparecia como "fechada".
