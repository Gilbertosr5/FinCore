import { createDemoDataStore, type DemoSeedData, type DemoSeedFactory } from './demo-data-store';

let counter = 0;

const emptySeed = (): DemoSeedData => ({
  accounts: [],
  categories: [],
  transactions: [],
  creditCards: [],
  cardPurchases: [],
  budgets: [],
  goals: [],
  goalContributions: [],
  assets: [],
  investmentMovements: [],
  assetValuations: [],
});

function factory(version: number) {
  const create = vi.fn((referenceDate: string) => ({
    ...emptySeed(),
    accounts: [{ id: 'acc-1', name: `Conta ${referenceDate}` }],
  }));
  return { version, create } satisfies DemoSeedFactory;
}

describe('armazenamento de demonstração (IndexedDB)', () => {
  it('aplica o seed na primeira leitura, uma única vez', async () => {
    const seed = factory(1);
    const store = createDemoDataStore({
      databaseName: `store-test-${++counter}`,
      seed,
      getReferenceDate: () => '2026-11-06',
    });
    await Promise.all([store.readAll('accounts'), store.readAll('transactions')]);
    expect(await store.readAll('accounts')).toEqual([{ id: 'acc-1', name: 'Conta 2026-11-06' }]);
    expect(seed.create).toHaveBeenCalledTimes(1);
    expect(await store.getInfo()).toMatchObject({ version: 1, referenceDate: '2026-11-06' });
  });

  it('persiste entre instâncias e recria quando a versão do seed muda', async () => {
    const databaseName = `store-test-${++counter}`;
    const v1 = factory(1);
    await createDemoDataStore({
      databaseName,
      seed: v1,
      getReferenceDate: () => '2026-01-01',
    }).readAll('accounts');

    const sameVersion = factory(1);
    const reopened = createDemoDataStore({
      databaseName,
      seed: sameVersion,
      getReferenceDate: () => '2026-02-01',
    });
    expect(await reopened.readAll('accounts')).toEqual([{ id: 'acc-1', name: 'Conta 2026-01-01' }]);
    expect(sameVersion.create).not.toHaveBeenCalled();
    reopened.close();

    const v2 = factory(2);
    const upgraded = createDemoDataStore({
      databaseName,
      seed: v2,
      getReferenceDate: () => '2026-03-01',
    });
    expect(await upgraded.readAll('accounts')).toEqual([{ id: 'acc-1', name: 'Conta 2026-03-01' }]);
  });

  it('reset recria os dados com a data de referência atual', async () => {
    let today = '2026-01-01';
    const store = createDemoDataStore({
      databaseName: `store-test-${++counter}`,
      seed: factory(1),
      getReferenceDate: () => today,
    });
    await store.readAll('accounts');
    today = '2026-05-05';
    const info = await store.reset();
    expect(info.referenceDate).toBe('2026-05-05');
    expect(await store.readAll('accounts')).toEqual([{ id: 'acc-1', name: 'Conta 2026-05-05' }]);
  });
});
