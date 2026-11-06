import type { AxiosInstance } from 'axios';
import { z } from 'zod';

import { parseRecords } from '@/lib/schemas/parse-records';
import { idField, isoDateField, moneyField, nullableString } from '@/lib/schemas/record-fields';
import { fetchList } from '@/services/api/list-resource';
import type { DemoDataStore } from '@/services/storage/demo-data-store';

import type { Asset, AssetValuation, InvestmentMovement } from '../domain/entities/investment';
import type { InvestmentRepository } from '../domain/repositories/investment.repository';

export const INVESTMENT_ENDPOINTS = {
  assets: '/investments/assets',
  movements: '/investments/movements',
  valuations: '/investments/valuations',
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

export function investmentMovementToRecord(movement: InvestmentMovement) {
  return { ...movement, amount: movement.amount.toString() };
}

export function assetValuationToRecord(valuation: AssetValuation) {
  return { ...valuation, value: valuation.value.toString() };
}

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
}

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
}
