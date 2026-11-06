# ADR 0008 — Camada de dados: repositórios, IndexedDB de demonstração e seed

- **Status:** Aceito
- **Data:** 06/11/2026

## Decisões

1. **Repositórios por feature, com contrato no domínio.** Cada feature define
   sua interface (`AccountRepository`, `TransactionRepository`,
   `CreditCardRepository`, `BudgetRepository`, `GoalRepository`,
   `InvestmentRepository`) e oferece duas implementações:
   `Demo*Repository` (IndexedDB) e `Api*Repository` (REST). Nesta fase os
   contratos são **somente leitura**; escrita entra com as telas de cada módulo.
2. **Composição única** em `src/app/composition/create-data-layer.ts`, escolhida
   por `VITE_DATA_SOURCE`. `DataProvider` expõe os casos de uso por contexto.
3. **IndexedDB via Dexie** (`src/services/storage/demo-data-store.ts`):
   armazenamento genérico (não conhece entidades), um _object store_ por tabela.
   localStorage nunca é usado como banco.
4. **Mesmo formato JSON** para registros locais e DTOs da API (dinheiro como
   string decimal, datas `YYYY-MM-DD`, meses `YYYY-MM`). Os mesmos schemas Zod
   validam as duas origens: dados inválidos geram `DataIntegrityError` explícito.
5. **Seed determinístico** (`src/app/demo-data/demo-seed.ts`):
   - gerador pseudoaleatório com semente = mês de referência → mesmos dados
     para a mesma data; todos os sorteios ocorrem antes de filtros por data;
   - 12 meses de histórico + contas fixas do mês seguinte (pendentes);
   - coerência garantida pelo próprio domínio (pares de transferência, faturas
     pagas pelo total calculado, aplicações saindo da conta da corretora);
   - aplicado na primeira leitura; `SEED_VERSION` diferente recria os dados;
   - **Configurações → Restaurar dados** recria tudo com a data de hoje.
6. Somente dados **fictícios** ficam no navegador e a interface informa
   "Dados de demonstração, armazenados apenas neste navegador".

## Consequências

- Trocar para a API exige apenas `VITE_DATA_SOURCE=api` e os endpoints do
  contrato; telas e casos de uso não mudam.
- Como o seed é relativo à data de geração, em um novo mês os dados param de
  cobrir o "mês atual" até serem restaurados. Não há regeneração automática
  para não apagar dados que o usuário venha a cadastrar nas próximas fases.
- Os testes usam `fake-indexeddb` e um banco isolado por teste.
