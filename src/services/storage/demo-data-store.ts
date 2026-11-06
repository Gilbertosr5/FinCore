import Dexie, { type Table } from 'dexie';

/**
 * Persistência local de DEMONSTRAÇÃO (IndexedDB via Dexie).
 *
 * - Usada somente com VITE_DATA_SOURCE=mock. Em produção os dados vêm da API.
 * - Guarda apenas dados fictícios de demonstração: nenhuma credencial ou dado
 *   bancário real. Os registros têm o mesmo formato JSON dos DTOs da API.
 * - É genérica: não conhece as entidades. Cada repositório valida os registros
 *   que lê (Zod), protegendo a aplicação contra dados antigos ou corrompidos.
 * - O seed é aplicado na primeira leitura e pode ser restaurado a qualquer
 *   momento (`reset`). Mudanças de SEED_VERSION recriam os dados.
 */

export const DEMO_TABLES = [
  'accounts',
  'categories',
  'transactions',
  'creditCards',
  'cardPurchases',
  'budgets',
  'goals',
  'goalContributions',
  'assets',
  'investmentMovements',
  'assetValuations',
] as const;

export type DemoTableName = (typeof DEMO_TABLES)[number];

export type DemoRecord = { id: string } & Record<string, unknown>;

export type DemoSeedData = Record<DemoTableName, DemoRecord[]>;

export interface DemoSeedInfo {
  version: number;
  /** Data de referência ("hoje") usada para gerar os dados. */
  referenceDate: string;
  createdAt: string;
}

interface MetaRecord {
  key: string;
  value: DemoSeedInfo;
}

class DemoDatabase extends Dexie {
  meta!: Table<MetaRecord, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      meta: 'key',
      ...Object.fromEntries(DEMO_TABLES.map((table) => [table, 'id'])),
    });
  }

  records(table: DemoTableName): Table<DemoRecord, string> {
    return this.table(table);
  }
}

export interface DemoSeedFactory {
  version: number;
  /** Gera os dados a partir de uma data de referência — deve ser determinístico. */
  create(referenceDate: string): DemoSeedData;
}

export interface DemoDataStoreOptions {
  databaseName: string;
  seed: DemoSeedFactory;
  /** Data de referência para (re)gerar o seed. */
  getReferenceDate: () => string;
}

export interface DemoDataStore {
  readAll(table: DemoTableName): Promise<DemoRecord[]>;
  /** Apaga tudo e recria o ambiente de demonstração com a data de referência atual. */
  reset(): Promise<DemoSeedInfo>;
  getInfo(): Promise<DemoSeedInfo | null>;
  close(): void;
}

const SEED_META_KEY = 'seed';

export function createDemoDataStore(options: DemoDataStoreOptions): DemoDataStore {
  const db = new DemoDatabase(options.databaseName);
  let ready: Promise<void> | null = null;

  const writeSeed = async (): Promise<DemoSeedInfo> => {
    const referenceDate = options.getReferenceDate();
    const data = options.seed.create(referenceDate);
    const info: DemoSeedInfo = {
      version: options.seed.version,
      referenceDate,
      createdAt: new Date().toISOString(),
    };
    const tables = [db.meta, ...DEMO_TABLES.map((table) => db.records(table))];
    await db.transaction('rw', tables, async () => {
      for (const table of DEMO_TABLES) {
        await db.records(table).clear();
        await db.records(table).bulkAdd(data[table]);
      }
      await db.meta.put({ key: SEED_META_KEY, value: info });
    });
    return info;
  };

  const ensureSeeded = (): Promise<void> => {
    ready ??= (async () => {
      const meta = await db.meta.get(SEED_META_KEY);
      if (meta?.value.version !== options.seed.version) await writeSeed();
    })().catch((error: unknown) => {
      ready = null; // permite nova tentativa
      throw error;
    });
    return ready;
  };

  return {
    async readAll(table) {
      await ensureSeeded();
      return db.records(table).toArray();
    },
    async reset() {
      await ensureSeeded();
      return writeSeed();
    },
    async getInfo() {
      await ensureSeeded();
      return (await db.meta.get(SEED_META_KEY))?.value ?? null;
    },
    close() {
      db.close();
    },
  };
}
