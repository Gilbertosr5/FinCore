import type { Asset } from '@/features/investments/domain/entities/investment';

import { SearchEntitiesUseCase, type SearchContext } from './search-entities';
import { account, card, d, transfer, tx } from '../../../../tests/helpers/finance-fixtures';

const itsa: Asset = {
  id: 'itsa',
  name: 'Itaúsa',
  ticker: 'ITSA4',
  assetClass: 'stocks',
  institution: 'Corretora',
  notes: null,
};

function useCase(): SearchEntitiesUseCase {
  const transactions = [
    tx({
      id: 'old',
      accountId: 'chk',
      amount: '30',
      description: 'Padaria',
      competenceDate: d('2026-01-02'),
    }),
    tx({
      id: 'new',
      accountId: 'chk',
      amount: '45',
      description: 'Padaria do bairro',
      competenceDate: d('2026-03-02'),
    }),
    tx({
      id: 'off',
      accountId: 'chk',
      amount: '99',
      description: 'Padaria cancelada',
      status: 'cancelled',
    }),
    ...transfer('chk', 'sav', '100', '2026-02-10').map((leg) => ({
      ...leg,
      description: 'Reserva poupança',
    })),
  ];
  const context: SearchContext = {
    accounts: {
      findAll: () =>
        Promise.resolve([account({ id: 'chk', name: 'Conta Itaú', institution: 'Itaú' })]),
      findById: () => Promise.resolve(null),
      save: () => Promise.resolve(),
    },
    transactions: {
      findAll: () => Promise.resolve(transactions),
      findById: () => Promise.resolve(null),
      findRecurrences: () => Promise.resolve([]),
      commit: () => Promise.resolve(),
    },
    cards: {
      findAll: () => Promise.resolve([card({ id: 'c1', name: 'Roxinho', institution: 'Nubank' })]),
      findById: () => Promise.resolve(null),
      save: () => Promise.resolve(),
      remove: () => Promise.resolve(),
      findPurchases: () => Promise.resolve([]),
      findPurchaseById: () => Promise.resolve(null),
      savePurchase: () => Promise.resolve(),
    },
    budgets: {
      findAll: () => Promise.resolve([]),
      findById: () => Promise.resolve(null),
      save: () => Promise.resolve(),
      remove: () => Promise.resolve(),
    },
    goals: {
      findAll: () => Promise.resolve([]),
      findById: () => Promise.resolve(null),
      save: () => Promise.resolve(),
      remove: () => Promise.resolve(),
      findContributions: () => Promise.resolve([]),
      saveContribution: () => Promise.resolve(),
      removeContribution: () => Promise.resolve(),
    },
    investments: {
      findAssets: () => Promise.resolve([itsa]),
      findMovements: () => Promise.resolve([]),
      findValuations: () => Promise.resolve([]),
      saveAsset: () => Promise.resolve(),
      removeAsset: () => Promise.resolve(),
      saveMovement: () => Promise.resolve(),
      removeMovement: () => Promise.resolve(),
      saveValuation: () => Promise.resolve(),
      removeValuation: () => Promise.resolve(),
    },
  };
  return new SearchEntitiesUseCase(context);
}

describe('busca global de entidades', () => {
  it('ignora acentos e maiúsculas e encontra conta e ativo', async () => {
    const results = await useCase().execute('itau');
    expect(results.map((item) => item.id)).toEqual(['account:chk', 'asset:itsa']);
    expect(results[0]?.href).toBe('/contas/chk');
    expect(results[1]).toMatchObject({ label: 'ITSA4 — Itaúsa', href: '/investimentos/itsa' });
  });

  it('lançamentos mais recentes primeiro, sem cancelados', async () => {
    const results = await useCase().execute('padaria');
    expect(results.map((item) => item.id)).toEqual(['tx:new', 'tx:old']);
    expect(results[0]?.href).toBe('/transacoes?mes=2026-03&q=Padaria%20do%20bairro');
  });

  it('transferência aparece uma vez e termos curtos não buscam', async () => {
    expect(await useCase().execute('reserva')).toHaveLength(1);
    expect(await useCase().execute('p')).toEqual([]);
    expect(await useCase().execute('nubank')).toMatchObject([
      { id: 'card:c1', href: '/cartoes/c1' },
    ]);
  });
});
