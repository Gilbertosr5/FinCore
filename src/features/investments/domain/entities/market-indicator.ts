import type { IsoDate } from '@/lib/dates';

/**
 * Indicadores de mercado (CDI, IPCA, Selic, Ibovespa…). A integração com uma
 * fonte externa ainda NÃO existe: o contrato está preparado (ADR 0012) e a
 * interface informa a indisponibilidade em vez de inventar valores.
 */
export type MarketIndicatorCode = 'cdi' | 'ipca' | 'selic' | 'ibovespa';

export const MARKET_INDICATOR_LABELS: Record<MarketIndicatorCode, string> = {
  cdi: 'CDI',
  ipca: 'IPCA',
  selic: 'Selic',
  ibovespa: 'Ibovespa',
};

export interface MarketIndicatorQuote {
  code: MarketIndicatorCode;
  /** Data de referência da cotação. */
  date: IsoDate;
  /** Taxa (% a.a. ou acumulado em 12 meses) ou pontos do índice, como decimal em string. */
  value: string;
  unit: 'percent_year' | 'percent_12m' | 'points';
  /** Fonte informada pelo backend (ex.: "BCB/SGS", "B3"). */
  source: string;
}

export interface MarketIndicatorsSnapshot {
  available: boolean;
  quotes: MarketIndicatorQuote[];
}
