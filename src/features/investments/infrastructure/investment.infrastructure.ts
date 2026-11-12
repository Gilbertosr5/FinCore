import type { AxiosInstance } from 'axios';
import { z } from 'zod';

import { parseRecords } from '@/lib/schemas/parse-records';
import { idField, isoDateField, moneyField, nullableString } from '@/lib/schemas/record-fields';
import { isApiError } from '@/services/api/api-error';
import { fetchList } from '@/services/api/list-resource';
import type { DemoDataStore } from '@/services/storage/demo-data-store';

import type { Asset, AssetValuation, InvestmentMovement } from '../domain/entities/investment';
import type {
  MarketIndicatorQuote,
  MarketIndicatorsSnapshot,
} from '../domain/entities/market-indicator';
import type {
  InvestmentRepository,
  MarketIndicatorRepository,
} from '../domain/repositories/investment.repository';

export const INVESTMENT_ENDPOINTS = {
  assets: '/investments/assets',
  asset: (id: string) => `/investments/assets/${encodeURIComponent(id)}`,
  movements: '/investments/movements',
  movement: (id: string) => `/investments/movements/${encodeURIComponent(id)}`,
  valuations: '/investments/valuations',
  valuation: (id: string) => `/investments/valuations/${encodeURIComponent(id)}`,
  /** Contrato futuro — ainda não implementado pelo backend (ADR 0012). */
  marketIndicators: '/market/indicators',
} as const;

export const assetRecordSchema = z
  .object({
    id: idField,
    name: z.string().min(1),
    ticker: nullableString,
    assetClass: z.enum([
      'fixed_income',
      'treasury',
      'cdb',
      'lci',
      'lca',
      'stocks',
      'reits',
      'etf',
      'funds',
      'crypto',
      'other',
    ]),
    institution: z.string(),
    notes: nullableString,
  })
  .transform((record): Asset => record);

export const investmentMovementRecordSchema = z
  .object({
    id: idField,
    assetId: idField,
    type: z.enum([
      'contribution',
      'buy',
      'sell',
      'redemption',
      'dividend',
      'interest',
      'income',
      'fee',
      'tax',
    ]),
    date: isoDateField,
    quantity: z
      .string()
      .regex(/^\d+(\.\d+)?$/)
      .nullish()
      .transform((value) => value ?? null),
    amount: moneyField,
    transactionId: idField.nullish().transform((value) => value ?? null),
  })
  .refine((record) => !record.amount.isNegative(), 'O valor deve ser positivo.')
  .transform((record): InvestmentMovement => record);

export const assetValuationRecordSchema = z
  .object({
    id: idField,
    assetId: idField,
    date: isoDateField,
    value: moneyField,
    source: z.enum(['manual', 'market_quote', 'estimate']),
  })
  .transform((record): AssetValuation => record);

export const marketIndicatorRecordSchema = z
  .object({
    code: z.enum(['cdi', 'ipca', 'selic', 'ibovespa']),
    date: isoDateField,
    value: z.string().regex(/^-?\d+(\.\d+)?$/),
    unit: z.enum(['percent_year', 'percent_12m', 'points']),
    source: z.string().min(1),
  })
  .transform((record): MarketIndicatorQuote => record);

export function assetToRecord(asset: Asset) {
  return { ...asset };
}

export function investmentMovementToRecord(movement: InvestmentMovement) {
  return { ...movement, amount: movement.amount.toString() };
}

export function assetValuationToRecord(valuation: AssetValuation) {
  return { ...valuation, value: valuation.value.toString() };
}

/** Implementação de demonstração (IndexedDB). */
export class DemoInvestmentRepository implements InvestmentRepository {
  constructor(private readonly store: DemoDataStore) {}

  async findAssets(): Promise<Asset[]> {
    return parseRecords(assetRecordSchema, await this.store.readAll('assets'), 'assets');
  }

  async findMovements(): Promise<InvestmentMovement[]> {
    return parseRecords(
      investmentMovementRecordSchema,
      await this.store.readAll('investmentMovements'),
      'investmentMovements',
    );
  }

  async findValuations(): Promise<AssetValuation[]> {
    return parseRecords(
      assetValuationRecordSchema,
      await this.store.readAll('assetValuations'),
      'assetValuations',
    );
  }

  async saveAsset(asset: Asset): Promise<void> {
    await this.store.write({ put: { assets: [assetToRecord(asset)] } });
  }

  async removeAsset(id: string): Promise<void> {
    await this.store.write({ remove: { assets: [id] } });
  }

  async saveMovement(movement: InvestmentMovement): Promise<void> {
    await this.store.write({
      put: { investmentMovements: [investmentMovementToRecord(movement)] },
    });
  }

  async removeMovement(id: string): Promise<void> {
    await this.store.write({ remove: { investmentMovements: [id] } });
  }

  async saveValuation(valuation: AssetValuation): Promise<void> {
    await this.store.write({ put: { assetValuations: [assetValuationToRecord(valuation)] } });
  }

  async removeValuation(id: string): Promise<void> {
    await this.store.write({ remove: { assetValuations: [id] } });
  }
}

/** Implementação REST (contrato em docs/api-contract.md). */
export class ApiInvestmentRepository implements InvestmentRepository {
  constructor(private readonly http: AxiosInstance) {}

  findAssets(): Promise<Asset[]> {
    return fetchList(this.http, INVESTMENT_ENDPOINTS.assets, assetRecordSchema);
  }

  findMovements(): Promise<InvestmentMovement[]> {
    return fetchList(this.http, INVESTMENT_ENDPOINTS.movements, investmentMovementRecordSchema);
  }

  findValuations(): Promise<AssetValuation[]> {
    return fetchList(this.http, INVESTMENT_ENDPOINTS.valuations, assetValuationRecordSchema);
  }

  async saveAsset(asset: Asset): Promise<void> {
    await this.http.put(INVESTMENT_ENDPOINTS.asset(asset.id), assetToRecord(asset));
  }

  async removeAsset(id: string): Promise<void> {
    await this.http.delete(INVESTMENT_ENDPOINTS.asset(id));
  }

  async saveMovement(movement: InvestmentMovement): Promise<void> {
    await this.http.put(
      INVESTMENT_ENDPOINTS.movement(movement.id),
      investmentMovementToRecord(movement),
    );
  }

  async removeMovement(id: string): Promise<void> {
    await this.http.delete(INVESTMENT_ENDPOINTS.movement(id));
  }

  async saveValuation(valuation: AssetValuation): Promise<void> {
    await this.http.put(
      INVESTMENT_ENDPOINTS.valuation(valuation.id),
      assetValuationToRecord(valuation),
    );
  }

  async removeValuation(id: string): Promise<void> {
    await this.http.delete(INVESTMENT_ENDPOINTS.valuation(id));
  }
}

/** Demonstração: não há fonte de mercado — nunca inventa cotações. */
export class DemoMarketIndicatorRepository implements MarketIndicatorRepository {
  findLatest(): Promise<MarketIndicatorsSnapshot> {
    return Promise.resolve({ available: false, quotes: [] });
  }
}

/**
 * REST: `GET /market/indicators` (contrato futuro). Enquanto o backend não o
 * implementar (404/501), a integração é tratada como indisponível.
 */
export class ApiMarketIndicatorRepository implements MarketIndicatorRepository {
  constructor(private readonly http: AxiosInstance) {}

  async findLatest(): Promise<MarketIndicatorsSnapshot> {
    try {
      const quotes = await fetchList(
        this.http,
        INVESTMENT_ENDPOINTS.marketIndicators,
        marketIndicatorRecordSchema,
      );
      return { available: true, quotes };
    } catch (error) {
      if (isApiError(error) && (error.kind === 'not_found' || error.status === 501)) {
        return { available: false, quotes: [] };
      }
      throw error;
    }
  }
}
