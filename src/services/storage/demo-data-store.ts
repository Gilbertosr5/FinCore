import type { DemoDataStore, DemoDataStoreOptions } from './demo-data-contracts';

export * from './demo-data-contracts';

/**
 * Cria o armazenamento de demonstração. O Dexie (IndexedDB) e a implementação
 * ficam em `demo-database.ts`, carregados SOB DEMANDA na primeira operação:
 * no modo API (backend real) eles nunca são baixados.
 */
export function createDemoDataStore(options: DemoDataStoreOptions): DemoDataStore {
  let store: Promise<DemoDataStore> | null = null;
  const open = () =>
    (store ??= import('./demo-database').then((module) => module.openDemoDataStore(options)));
  return {
    readAll: async (table) => (await open()).readAll(table),
    get: async (table, id) => (await open()).get(table, id),
    write: async (batch) => {
      await (await open()).write(batch);
    },
    reset: async () => (await open()).reset(),
    getInfo: async () => (await open()).getInfo(),
    close: () => {
      void store?.then((opened) => {
        opened.close();
      });
    },
  };
}
