import type { IsoDate } from '@/lib/dates';
import type { Money } from '@/lib/money';

export type CardBrand = 'visa' | 'mastercard' | 'elo' | 'amex' | 'hipercard' | 'other';

export const CARD_BRAND_LABELS: Record<CardBrand, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  elo: 'Elo',
  amex: 'American Express',
  hipercard: 'Hipercard',
  other: 'Outra',
};

export type CardStatus = 'active' | 'blocked' | 'cancelled';

export interface CreditCard {
  id: string;
  name: string;
  institution: string;
  brand: CardBrand;
  limit: Money;
  /** Dia de fechamento (1–31; ajustado ao último dia em meses mais curtos). */
  closingDay: number;
  /** Dia de vencimento (1–31). Se <= fechamento, vence no mês seguinte ao fechamento. */
  dueDay: number;
  paymentAccountId: string;
  status: CardStatus;
}

export type CardPurchaseStatus = 'active' | 'cancelled';

/**
 * Compra no cartão. Não altera saldo de conta: compromete o limite e gera
 * parcelas nas faturas. O consumo é contabilizado pelas parcelas.
 */
export interface CardPurchase {
  id: string;
  cardId: string;
  description: string;
  categoryId: string | null;
  totalAmount: Money;
  purchaseDate: IsoDate;
  installmentCount: number;
  status: CardPurchaseStatus;
}
