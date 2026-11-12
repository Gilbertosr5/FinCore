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
  'recurrences',
  'auditLog',
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

export interface DemoSeedFactory {
  version: number;
  /**
   * Gera os dados a partir de uma data de referência — deve ser determinístico.
   * Pode ser assíncrono: o gerador é carregado sob demanda (fora do bundle inicial).
   */
  create(referenceDate: string): DemoSeedData | Promise<DemoSeedData>;
}

export interface DemoDataStoreOptions {
  databaseName: string;
  seed: DemoSeedFactory;
  /** Data de referência para (re)gerar o seed. */
  getReferenceDate: () => string;
}

/** Alterações aplicadas em uma única transação do IndexedDB (tudo ou nada). */
export interface DemoWriteBatch {
  put?: Partial<Record<DemoTableName, DemoRecord[]>>;
  remove?: Partial<Record<DemoTableName, string[]>>;
}

export interface DemoDataStore {
  readAll(table: DemoTableName): Promise<DemoRecord[]>;
  get(table: DemoTableName, id: string): Promise<DemoRecord | undefined>;
  /** Grava e remove registros atomicamente: se algo falhar, nada é aplicado. */
  write(batch: DemoWriteBatch): Promise<void>;
  /** Apaga tudo e recria o ambiente de demonstração com a data de referência atual. */
  reset(): Promise<DemoSeedInfo>;
  getInfo(): Promise<DemoSeedInfo | null>;
  close(): void;
}
