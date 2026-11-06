import type { IsoDate } from '@/lib/dates';
import type { Money } from '@/lib/money';

export type AssetClass =
  | 'fixed_income'
  | 'treasury'
  | 'cdb'
  | 'lci'
  | 'lca'
  | 'stocks'
  | 'reits'
  | 'etf'
  | 'funds'
  | 'crypto'
  | 'other';

export const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  fixed_income: 'Renda fixa',
  treasury: 'Tesouro Direto',
  cdb: 'CDB',
  lci: 'LCI',
  lca: 'LCA',
  stocks: 'Ações',
  reits: 'Fundos imobiliários',
  etf: 'ETFs',
  funds: 'Fundos de investimento',
  crypto: 'Criptomoedas',
  other: 'Outros ativos',
};

export interface Asset {
  id: string;
  name: string;
  ticker: string | null;
  assetClass: AssetClass;
  institution: string;
  notes: string | null;
}

export type InvestmentMovementType =
  | 'contribution'
  | 'buy'
  | 'sell'
  | 'redemption'
  | 'dividend'
  | 'interest'
  | 'income'
  | 'fee'
  | 'tax';

export const MOVEMENT_TYPE_LABELS: Record<InvestmentMovementType, string> = {
  contribution: 'Aporte',
  buy: 'Compra',
  sell: 'Venda',
  redemption: 'Resgate',
  dividend: 'Dividendos',
  interest: 'Juros',
  income: 'Rendimentos',
  fee: 'Taxas',
  tax: 'Impostos',
};

export interface InvestmentMovement {
  id: string;
  assetId: string;
  type: InvestmentMovementType;
  date: IsoDate;
  /** Quantidade (decimal em string) quando aplicável — ações, cotas, cripto. */
  quantity: string | null;
  /** Valor financeiro da movimentação, sempre positivo. */
  amount: Money;
}

/**
 * Origem do valor de mercado. A interface sempre diferencia valores informados
 * manualmente, cotações externas (integração futura) e estimativas.
 */
export type ValuationSource = 'manual' | 'market_quote' | 'estimate';

export const VALUATION_SOURCE_LABELS: Record<ValuationSource | 'cost', string> = {
  manual: 'Valor informado manualmente',
  market_quote: 'Cotação externa',
  estimate: 'Estimativa',
  cost: 'Sem avaliação — exibindo valor aplicado',
};

/** Valor total da posição em uma data. */
export interface AssetValuation {
  id: string;
  assetId: string;
  date: IsoDate;
  value: Money;
  source: ValuationSource;
}
