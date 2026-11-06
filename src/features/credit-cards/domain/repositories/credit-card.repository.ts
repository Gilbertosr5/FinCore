import type { CardPurchase, CreditCard } from '../entities/credit-card';

/** Contrato de leitura. Escrita (cartões, compras, pagamentos) entra na Fase 5. */
export interface CreditCardRepository {
  findAll(): Promise<CreditCard[]>;
  findPurchases(): Promise<CardPurchase[]>;
}
