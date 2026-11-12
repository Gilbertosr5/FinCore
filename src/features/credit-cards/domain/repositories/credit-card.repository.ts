import type { CardPurchase, CreditCard } from '../entities/credit-card';

/**
 * Contrato do repositório de cartões. Ids gerados no cliente: gravações são
 * "cria ou substitui" (idempotentes). Pagamentos de fatura NÃO ficam aqui: são
 * transações `card_payment` gravadas no livro de lançamentos (ADR 0007/0010).
 */
export interface CreditCardRepository {
  findAll(): Promise<CreditCard[]>;
  findById(id: string): Promise<CreditCard | null>;
  save(card: CreditCard): Promise<void>;
  /** Exclui o cartão (somente sem compras e pagamentos — validado no caso de uso). */
  remove(id: string): Promise<void>;
  findPurchases(): Promise<CardPurchase[]>;
  findPurchaseById(id: string): Promise<CardPurchase | null>;
  /** Uma compra (avulsa ou parcelada) é um único registro: as parcelas são derivadas. */
  savePurchase(purchase: CardPurchase): Promise<void>;
}
