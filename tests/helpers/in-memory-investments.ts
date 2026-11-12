import {
  createInvestmentUseCases,
  type Asset,
  type AssetValuation,
  type InvestmentMovement,
  type InvestmentRepository,
  type MarketIndicatorsSnapshot,
} from '@/features/investments';
import type { Money } from '@/lib/money';

import { createInMemoryLedger } from './in-memory-ledger';

type LedgerOptions = Parameters<typeof createInMemoryLedger>[0];

/**
 * Livro em memória + carteira. A porta de lançamentos usa os mesmos comandos
 * (`InvestmentLedgerCommands`) que a composição real.
 */
export function createInMemoryInvestments(
  options: LedgerOptions & {
    assets?: Asset[];
    movements?: InvestmentMovement[];
    valuations?: AssetValuation[];
    market?: MarketIndicatorsSnapshot;
  } = {},
) {
  const ledger = createInMemoryLedger({
    ...options,
    categories: options.categories ?? [
      { id: 'salary', name: 'Salário', kind: 'income', nature: 'fixed' },
      { id: 'yields', name: 'Rendimentos', kind: 'income', nature: 'variable' },
      { id: 'food', name: 'Alimentação', kind: 'expense', nature: 'variable' },
    ],
  });
  const assets = new Map((options.assets ?? defaultAssets()).map((a) => [a.id, a]));
  const movements = new Map((options.movements ?? []).map((m) => [m.id, m]));
  const valuations = new Map((options.valuations ?? []).map((v) => [v.id, v]));
  const failures = { saveMovement: false };

  const repository: InvestmentRepository = {
    findAssets: () => Promise.resolve([...assets.values()]),
    findMovements: () => Promise.resolve([...movements.values()]),
    findValuations: () => Promise.resolve([...valuations.values()]),
    saveAsset: (asset) => {
      assets.set(asset.id, asset);
      return Promise.resolve();
    },
    removeAsset: (id) => {
      assets.delete(id);
      return Promise.resolve();
    },
    // Gravação atômica: com falha simulada, nem a movimentação nem o lançamento ficam.
    saveMovement: (movement, linked = null) => {
      if (failures.saveMovement) return Promise.reject(new Error('falha simulada'));
      movements.set(movement.id, movement);
      if (linked) ledger.state.transactions.set(linked.id, linked);
      return Promise.resolve();
    },
    removeMovement: (id, linkedIds = []) => {
      movements.delete(id);
      for (const linkedId of linkedIds) ledger.state.transactions.delete(linkedId);
      return Promise.resolve();
    },
    saveValuation: (valuation) => {
      valuations.set(valuation.id, valuation);
      return Promise.resolve();
    },
    removeValuation: (id) => {
      valuations.delete(id);
      return Promise.resolve();
    },
  };

  const useCases = createInvestmentUseCases({
    ...ledger.context,
    investments: repository,
    market: {
      findLatest: () => Promise.resolve(options.market ?? { available: false, quotes: [] }),
    },
    ledger: ledger.ledger.investments,
  });

  return {
    ...ledger,
    investments: useCases,
    store: { assets, movements, valuations },
    failures,
    async balanceOf(accountId: string): Promise<Money> {
      const found = (await ledger.accounts.list.execute()).find(
        (item) => item.account.id === accountId,
      );
      if (!found) throw new Error(`conta ${accountId} não encontrada`);
      return found.balance;
    },
  };
}

/** Ativos padrão: uma ação (quantidade) e um CDB (sem quantidade). */
export function defaultAssets(): Asset[] {
  return [
    {
      id: 'itsa',
      name: 'Itaúsa',
      ticker: 'ITSA4',
      assetClass: 'stocks',
      institution: 'Corretora',
      notes: null,
    },
    {
      id: 'cdb',
      name: 'CDB 110%',
      ticker: null,
      assetClass: 'cdb',
      institution: 'Banco',
      notes: null,
    },
  ];
}
