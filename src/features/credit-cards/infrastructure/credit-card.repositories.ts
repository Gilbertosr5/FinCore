import type { AxiosInstance } from 'axios';

import { parseRecords } from '@/lib/schemas/parse-records';
import { isApiError } from '@/services/api/api-error';
import { fetchList } from '@/services/api/list-resource';
import type { DemoDataStore, DemoRecord } from '@/services/storage/demo-data-store';

import {
  cardPurchaseRecordSchema,
  cardPurchaseToRecord,
  creditCardRecordSchema,
  creditCardToRecord,
} from './credit-card.records';
import type { CardPurchase, CreditCard } from '../domain/entities/credit-card';
import type { CreditCardRepository } from '../domain/repositories/credit-card.repository';

export const CREDIT_CARD_ENDPOINTS = {
  list: '/credit-cards',
  byId: (id: string) => `/credit-cards/${encodeURIComponent(id)}`,
  purchases: '/credit-cards/purchases',
  purchase: (id: string) => `/credit-cards/purchases/${encodeURIComponent(id)}`,
} as const;

const asRecord = (value: object) => value as DemoRecord;

/** Implementação de demonstração (IndexedDB). */
export class DemoCreditCardRepository implements CreditCardRepository {
  constructor(private readonly store: DemoDataStore) {}

  async findAll(): Promise<CreditCard[]> {
    return parseRecords(
      creditCardRecordSchema,
      await this.store.readAll('creditCards'),
      'creditCards',
    );
  }

  async findById(id: string): Promise<CreditCard | null> {
    const record = await this.store.get('creditCards', id);
    if (!record) return null;
    return parseRecords(creditCardRecordSchema, [record], 'creditCards')[0] ?? null;
  }

  async save(card: CreditCard): Promise<void> {
    await this.store.write({ put: { creditCards: [asRecord(creditCardToRecord(card))] } });
  }

  async remove(id: string): Promise<void> {
    await this.store.write({ remove: { creditCards: [id] } });
  }

  async findPurchases(): Promise<CardPurchase[]> {
    return parseRecords(
      cardPurchaseRecordSchema,
      await this.store.readAll('cardPurchases'),
      'cardPurchases',
    );
  }

  async findPurchaseById(id: string): Promise<CardPurchase | null> {
    const record = await this.store.get('cardPurchases', id);
    if (!record) return null;
    return parseRecords(cardPurchaseRecordSchema, [record], 'cardPurchases')[0] ?? null;
  }

  async savePurchase(purchase: CardPurchase): Promise<void> {
    await this.store.write({ put: { cardPurchases: [asRecord(cardPurchaseToRecord(purchase))] } });
  }
}

async function getOrNull<T>(load: () => Promise<T>): Promise<T | null> {
  try {
    return await load();
  } catch (error) {
    if (isApiError(error) && error.kind === 'not_found') return null;
    throw error;
  }
}

/** Implementação REST (contrato em docs/api-contract.md). */
export class ApiCreditCardRepository implements CreditCardRepository {
  constructor(private readonly http: AxiosInstance) {}

  findAll(): Promise<CreditCard[]> {
    return fetchList(this.http, CREDIT_CARD_ENDPOINTS.list, creditCardRecordSchema);
  }

  findById(id: string): Promise<CreditCard | null> {
    return getOrNull(async () => {
      const { data } = await this.http.get<unknown>(CREDIT_CARD_ENDPOINTS.byId(id));
      return parseRecords(creditCardRecordSchema, [data], `GET /credit-cards/${id}`)[0] ?? null;
    });
  }

  async save(card: CreditCard): Promise<void> {
    await this.http.put(CREDIT_CARD_ENDPOINTS.byId(card.id), creditCardToRecord(card));
  }

  async remove(id: string): Promise<void> {
    await this.http.delete(CREDIT_CARD_ENDPOINTS.byId(id));
  }

  findPurchases(): Promise<CardPurchase[]> {
    return fetchList(this.http, CREDIT_CARD_ENDPOINTS.purchases, cardPurchaseRecordSchema);
  }

  findPurchaseById(id: string): Promise<CardPurchase | null> {
    return getOrNull(async () => {
      const { data } = await this.http.get<unknown>(CREDIT_CARD_ENDPOINTS.purchase(id));
      return (
        parseRecords(cardPurchaseRecordSchema, [data], `GET /credit-cards/purchases/${id}`)[0] ??
        null
      );
    });
  }

  async savePurchase(purchase: CardPurchase): Promise<void> {
    await this.http.put(
      CREDIT_CARD_ENDPOINTS.purchase(purchase.id),
      cardPurchaseToRecord(purchase),
    );
  }
}
