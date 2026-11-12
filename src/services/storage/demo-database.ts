import Dexie, { type Table } from 'dexie';

import {
  DEMO_TABLES,
  type DemoDataStore,
  type DemoDataStoreOptions,
  type DemoRecord,
  type DemoSeedInfo,
  type DemoTableName,
} from './demo-data-contracts';

/** Implementação com Dexie (carregada sob demanda por `createDemoDataStore`). */

interface MetaRecord {
  key: string;
  value: DemoSeedInfo;
}

class DemoDatabase extends Dexie {
  meta!: Table<MetaRecord, string>;

  constructor(name: string) {
    super(name);
    const stores = (tables: readonly string[]) => ({
      meta: 'key',
      ...Object.fromEntries(tables.map((table) => [table, 'id'])),
    });
    // v1: tabelas da Fase 3. v2 (Fase 4): recorrências e histórico de alterações.
    this.version(1).stores(
      stores(DEMO_TABLES.filter((t) => t !== 'recurrences' && t !== 'auditLog')),
    );
    this.version(2).stores(stores(DEMO_TABLES));
  }

  records(table: DemoTableName): Table<DemoRecord, string> {
    return this.table(table);
  }
}

const SEED_META_KEY = 'seed';

export function openDemoDataStore(options: DemoDataStoreOptions): DemoDataStore {
  const db = new DemoDatabase(options.databaseName);
  let ready: Promise<void> | null = null;

  const writeSeed = async (): Promise<DemoSeedInfo> => {
    const referenceDate = options.getReferenceDate();
    const data = await options.seed.create(referenceDate);
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
    async get(table, id) {
      await ensureSeeded();
      return db.records(table).get(id);
    },
    async write(batch) {
      await ensureSeeded();
      const tables = [
        ...new Set([...Object.keys(batch.put ?? {}), ...Object.keys(batch.remove ?? {})]),
      ] as DemoTableName[];
      if (tables.length === 0) return;
      await db.transaction(
        'rw',
        tables.map((table) => db.records(table)),
        async () => {
          for (const table of tables) {
            const removals = batch.remove?.[table];
            if (removals?.length) await db.records(table).bulkDelete(removals);
            const puts = batch.put?.[table];
            if (puts?.length) await db.records(table).bulkPut(puts);
          }
        },
      );
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
