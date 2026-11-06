import type { AxiosInstance } from 'axios';

import { parseRecords } from '@/lib/schemas/parse-records';
import { fetchList } from '@/services/api/list-resource';
import type { DemoDataStore } from '@/services/storage/demo-data-store';

import { cardPurchaseRecordSchema, creditCardRecordSchema } from './credit-card.records';
import type { CardPurchase, CreditCard } from '../domain/entities/credit-card';
import type { CreditCardRepository } from '../domain/repositories/credit-card.repository';

export const CREDIT_CARD_ENDPOINTS = {
  list: '/credit-cards',
  purchases: '/credit-cards/purchases',
} as const;

export class DemoCreditCardRepository implements CreditCardRepository {
  constructor(private readonly store: DemoDataStore) {}

  async findAll(): Promise<CreditCard[]> {
    return parseRecords(
      creditCardRecordSchema,
      await this.store.readAll('creditCards'),
      'creditCards',
    );
  }

  async findPurchases(): Promise<CardPurchase[]> {
    return parseRecords(
      cardPurchaseRecordSchema,
      await this.store.readAll('cardPurchases'),
      'cardPurchases',
    );
  }
}

export class ApiCreditCardRepository implements CreditCardRepository {
  constructor(private readonly http: AxiosInstance) {}

  findAll(): Promise<CreditCard[]> {
    return fetchList(this.http, CREDIT_CARD_ENDPOINTS.list, creditCardRecordSchema);
  }

  findPurchases(): Promise<CardPurchase[]> {
    return fetchList(this.http, CREDIT_CARD_ENDPOINTS.purchases, cardPurchaseRecordSchema);
  }
}
