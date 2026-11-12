# FinCore — Roadmap das próximas fases (4 a 9)

> Extraído do "prompt mestre" original do projeto para não depender do histórico
> da conversa. Contém tudo o que falta implementar, as regras de execução e os
> critérios de conclusão. O que já foi entregue está em
> [`PROJECT_STATUS.md`](../PROJECT_STATUS.md); decisões em [`docs/adr/`](./adr/).
>
> **Para retomar:** leia este arquivo + `PROJECT_STATUS.md` e peça
> "Iniciar a próxima fase pendente". Ao fim de cada fase: `npm run check`, `npm run build`,
> `npm run test:e2e`, verificação no navegador e atualização do `PROJECT_STATUS.md`.

## Estado atual (11/11/2026 — após a Fase 8)

| Fase | Descrição               | Status     |
| ---- | ----------------------- | ---------- |
| 1    | Fundação arquitetural   | ✅         |
| 2    | Autenticação e layout   | ✅         |
| 3    | Dashboard               | ✅         |
| 4    | Gestão financeira       | ✅         |
| 5    | Cartões e orçamentos    | ✅         |
| 6    | Metas e planejamento    | ✅         |
| 7    | Investimentos           | ✅         |
| 8    | Calendário e relatórios | ✅         |
| 9    | Finalização e qualidade | ⏳ próxima |

Já existem (e devem ser reutilizados, não reescritos): domínio e regras de
contabilização de contas, transações, cartões/faturas, orçamentos, metas e
investimentos (ADR 0007); repositórios `Demo*` (IndexedDB) e `Api*` (REST) por
feature (ADR 0008) — com **escrita** já implementada para lançamentos, recorrências,
contas e categorias (Fase 4, ADR 0009) e cartões, compras, pagamentos de fatura e
orçamentos (Fase 5, ADR 0010), metas e aportes (Fase 6, ADR 0011), investimentos com custo médio (Fase 7, ADR 0012); planejamento e projeções (feature `planning`); histórico de alterações (feature `history`); seed de
demonstração; `Money`, `IsoDate`, `MonthKey`; componentes de UI (select, checkbox,
tabela, diálogos de confirmação, paginação, campo monetário), gráficos e formulários.

---

## FASE 4 — Gestão financeira

**Implementar:** receitas, despesas, categorias, contas, transferências,
recorrências, parcelamentos, histórico.
**Critério de conclusão:** operações financeiras funcionais e com testes de regras de negócio.

### Receitas e despesas (módulo central)

Categorias de receita: salário, freelances, rendimentos, bonificações, comissões,
receitas extras, receitas recorrentes, categorias personalizadas.
Categorias de despesa: moradia, alimentação, transporte, saúde, educação, lazer,
assinaturas, compras, impostos, gastos personalizados.

Dados de cada lançamento: descrição, valor, tipo, categoria, conta de origem,
data de competência, data de vencimento, data de pagamento/recebimento, status,
recorrência, tags, observações, anexos (quando suportados).

Funcionalidades: criar, editar, excluir, duplicar; filtrar por período, categoria
e conta; pesquisar por descrição; ordenar por data e valor; marcar como pago;
marcar como recebido; cancelar lançamento; lançamentos recorrentes; despesas
parceladas; consultar histórico.

**Transferências:** geram movimentação de saída e de entrada relacionadas; nunca
contam como receita/despesa no resultado consolidado; evitar contabilização duplicada.

**Recorrências:** diária, semanal, quinzenal, mensal, bimestral, trimestral,
semestral, anual. Data inicial, data final opcional e configuração de repetição.
Evitar duplicação de ocorrências.

### Contas bancárias

Tipos: conta corrente, poupança, dinheiro em espécie, carteira digital, conta de
investimentos, outras personalizadas.
Funcionalidades: criar, editar, arquivar, consultar saldo, consultar extrato,
registrar saldo inicial, transferir valores, consultar movimentações, identificar
contas com saldo negativo. Cada conta mantém seu histórico; saldo = saldo inicial +
movimentações válidas, sem duplicidade.

### Notas técnicas para a Fase 4

- Adicionar escrita aos contratos de repositório (create/update/delete, além de
  `findAll`/`findById` com filtros), nas duas implementações (Demo e Api) e
  documentar os endpoints em `docs/api-contract.md` (sugestão: header
  `Idempotency-Key` em criações).
- Casos de uso para cada operação importante (validação antes de persistir).
- Após mutações, invalidar no TanStack Query as listas e o dashboard
  (`dashboardQueryKeys.all`). Mutações nunca têm retry automático.
- Formulários com React Hook Form + Zod; confirmação em ações destrutivas
  (componente de diálogo de confirmação); tabelas responsivas com paginação.
- Manter histórico de alterações importantes.

---

## FASE 5 — Cartões e orçamentos

> ✅ **Concluída em 11/11/2026** — ver [`PROJECT_STATUS.md`](../PROJECT_STATUS.md) e
> [ADR 0010](./adr/0010-cartoes-orcamentos-e-notificacoes.md).

**Implementar:** cartões, faturas, compras, parcelamentos, pagamentos,
orçamentos, limites, alertas.
**Critério de conclusão:** consistência entre compras, faturas, contas e indicadores.

### Cartões de crédito

Cadastro: nome, instituição, bandeira, limite total, dia de fechamento, dia de
vencimento, conta de pagamento, status.
Funcionalidades: limite disponível e utilizado; registrar compras e compras
parceladas; consultar faturas e próximas faturas; compras por cartão; registrar
pagamento de fatura; histórico de pagamentos; identificar parcelas futuras.
Status de fatura: aberta, fechada, parcialmente paga, paga, vencida.

Regras (já implementadas no domínio — ADR 0007): compra não reduz saldo da conta,
compromete limite e gera obrigação; pagamento reduz saldo da conta de pagamento e
liquida a obrigação; compra e pagamento nunca contam como duas despesas de
consumo; parcelas distribuídas corretamente nas faturas futuras; tratar compras
próximas ao fechamento.

### Orçamentos

Funcionalidades: orçamento mensal e anual; limites por categoria; limites
personalizados; valor utilizado e disponível; percentual consumido; planejado ×
realizado; alertas ao atingir limites; histórico de orçamentos.
Exemplo: Alimentação R$ 800,00 → alerta aos 80%; acima de 100% indicar o
excedente. Valores atualizados conforme lançamentos válidos.

Também: alimentar a central de notificações do cabeçalho com os alertas.

---

## FASE 6 — Metas e planejamento

> ✅ **Concluída em 11/11/2026** — ver [`PROJECT_STATUS.md`](../PROJECT_STATUS.md) e
> [ADR 0011](./adr/0011-metas-e-planejamento.md).

**Implementar:** metas, aportes, planejamento mensal, planejamento anual,
simulações, projeções.
**Critério de conclusão:** metas e projeções atualizadas corretamente.

### Metas financeiras

Exemplos: reserva de emergência, veículo, viagem, imóvel, equipamentos,
independência financeira, personalizadas.
Dados: nome, descrição, valor desejado, valor acumulado, data inicial, data final,
prioridade, categoria, conta/origem dos aportes, status.
Funcionalidades: criar, editar, registrar aportes e retiradas, acompanhar
progresso, valor restante, aporte mensal necessário, histórico, concluir ou
cancelar. Progresso calculado dinamicamente. Aportes que são apenas
transferências entre contas não contam como receita.

### Planejamento financeiro

Planejamento mensal e anual; previsão de receitas e despesas; projeção de saldo;
planejamento de grandes compras; simulação de economia e de aportes; cenários
otimista, conservador e personalizado. Permitir alterar valores e prazos e ver o
impacto. **Projeções sempre identificadas como estimativas.**

---

## FASE 7 — Investimentos

> ✅ **Concluída em 11/11/2026** — ver [`PROJECT_STATUS.md`](../PROJECT_STATUS.md) e
> [ADR 0012](./adr/0012-investimentos-custo-medio-e-indicadores.md).

**Implementar:** ativos, classes, aportes, resgates, proventos, rentabilidade,
distribuição patrimonial, preparação para integrações externas.
**Critério de conclusão:** carteira funcional com dados manuais e cálculos documentados.

Classes: renda fixa, Tesouro Direto, CDB, LCI, LCA, ações, FIIs, ETFs, fundos,
criptomoedas, outros.
Cadastro de ativo: nome, código/ticker, tipo, instituição/corretora, quantidade,
preço médio, valor investido, valor atual, data de aquisição, observações.
Movimentações: aportes, compras, vendas, resgates, dividendos, juros,
rendimentos, taxas, impostos.
Indicadores: patrimônio investido, valor atual, rentabilidade acumulada e
percentual, distribuição por classe e por ativo, evolução patrimonial, proventos,
histórico de aportes.
Indicadores de mercado (preparar integração futura): CDI, IPCA, Selic, Ibovespa, outros.

Regras: diferenciar valor manual, cotação externa e estimativa; não apresentar
rentabilidade estimada como real; considerar taxas, impostos, custos e eventos
corporativos; documentar limitações e usar metodologia adequada a cada tipo de
ativo (custo médio, TWR/MWR etc. — hoje é versão simplificada, ver ADR 0007);
**não** dar recomendações de compra/venda. Aplicações/resgates a partir de conta
usam o tipo de movimentação `investment` (já existe).

---

## FASE 8 — Calendário e relatórios

> ✅ **Concluída em 11/11/2026** — ver [`PROJECT_STATUS.md`](../PROJECT_STATUS.md) e
> [ADR 0013](./adr/0013-calendario-relatorios-e-exportacao.md).

**Implementar:** calendário financeiro, relatórios, filtros, exportações PDF e
CSV, indicadores históricos.
**Critério de conclusão:** relatórios coerentes com os dados dos demais módulos.

### Calendário financeiro

Eventos: contas a pagar e a receber, vencimentos de cartões, parcelas, receitas
previstas, aportes programados, datas de metas.
Funcionalidades: visão mensal e semanal, navegação entre meses, detalhes, filtros
por tipo, identificação de vencimentos, lembretes. Não criar notificações que
dependam de infraestrutura inexistente — preparar contratos para o backend.

### Relatórios e análises

Relatórios: receitas por período, despesas por período, por categoria, por conta,
evolução patrimonial, evolução dos investimentos, orçamento × realizado,
histórico de economia, fluxo de caixa, compromissos futuros.
Indicadores: taxa de poupança, comprometimento da renda, média de gastos mensais,
evolução de receitas e despesas, patrimônio líquido, patrimônio investido,
despesas fixas × variáveis (a categoria já tem `nature`).
Exportações: PDF e CSV. Relatórios respeitam os filtros; dados exportados
correspondem exatamente ao período e filtros da interface.

---

## FASE 9 — Finalização e qualidade

**Implementar e revisar:** testes unitários, de integração e E2E; responsividade;
acessibilidade; performance; segurança; tratamento de erros; documentação; build
de produção.
**Critério de conclusão:** aplicação compilando, testes aprovados e
funcionalidades documentadas.

Pendências já anotadas: reduzir o bundle inicial (carregar o seed sob demanda);
revisar vulnerabilidades de dependências de desenvolvimento; completar
Configurações (abaixo).

---

## Configurações e preferências (completar ao longo das fases)

Perfil: nome, e-mail, dados pessoais não sensíveis, preferências de exibição.
Preferências: tema (feito), moeda principal, formato de data, fuso horário,
notificações, categorias personalizadas.
Segurança: alterar senha (feito), encerrar sessão (feito), histórico de sessões
(quando suportado), exportação dos dados, exclusão da conta (via backend).

## Requisitos transversais (valem para todas as fases)

- **Integridade financeira:** nunca float em cálculos (usar `Money`); datas de
  calendário com `IsoDate`; considerar competência, vencimento, pagamento,
  recebimento, fuso, virada de mês, anos bissextos, parcelamentos e recorrências.
  Não duplicar movimentações; transferências e pagamento de fatura nunca como
  receita/despesa; não gerar parcelas duplicadas; operações canceladas não afetam
  indicadores; validar antes de atualizar; manter histórico de alterações
  importantes. **Testes específicos para essas regras.**
- **Estados de interface:** loading, skeleton, vazio, erro, sucesso, validação,
  diálogos de confirmação. Nunca tela vazia no carregamento; nunca dados
  desatualizados como confirmados; invalidação correta do cache após operações.
- **Design system:** tema escuro principal + claro; cores só por tokens; layout
  responsivo de verdade (tabelas, gráficos, formulários e navegação adaptados ao
  celular); componentes reutilizáveis (cards, gráficos, tabelas, filtros, campos,
  modais, drawers, dropdowns, tooltips, badges, alertas, skeletons, empty states,
  paginação, botões).
- **Acessibilidade:** teclado, contraste, labels, foco visível, semântica, ARIA,
  feedback acessível. Gráficos com legenda, resumo e visão em tabela.
- **Dados de demonstração:** realistas, coerentes, determinísticos, restauráveis
  e identificados como demonstração; nunca valores aleatórios a cada renderização.
- **Backend futuro** (Java + Spring Boot + PostgreSQL): contratos de repositório
  independentes, implementações Demo e Api selecionadas por ambiente, erros HTTP
  padronizados; não inventar endpoints como se existissem — documentar o contrato.

## Regras de execução (do prompt original)

1. Analisar o estado do projeto antes de mudar; não sobrescrever sem entender.
2. Não instalar bibliotecas sem necessidade; não usar libs redundantes.
3. Não gerar arquivos gigantes nem concentrar a aplicação em `App.tsx`.
4. Não usar dados mock dentro de componentes.
5. Não deixar botões sem função nem formulários decorativos.
6. Não simular operações financeiras sem atualizar os dados correspondentes.
7. Não usar `any`, não ignorar erros de compilação, não desabilitar regras do
   ESLint para esconder problemas, não usar `@ts-ignore` sem justificativa.
8. Não inventar integrações externas; não expor informações sensíveis.
9. Funcionalidade não está pronta só porque a tela existe.
10. Não remover testes para o build passar; não avançar com erros críticos de fases anteriores.
11. Decisões técnicas comuns: decidir, documentar (ADR) e seguir sem pedir confirmação.
12. Ao fim de cada fase: typecheck, lint, testes, build; corrigir problemas;
    atualizar `PROJECT_STATUS.md` (fases, funcionalidades, pendências, testes,
    problemas conhecidos, decisões, próximas etapas).
13. Prioridade: qualidade, consistência, manutenibilidade e integridade
    financeira — sem sacrificar arquitetura, experiência do usuário ou precisão.
