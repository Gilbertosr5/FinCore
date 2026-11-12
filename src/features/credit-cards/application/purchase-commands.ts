import {
  assertValidAmount,
  normalizeDescription,
} from '@/features/transactions/domain/rules/transaction-rules';
import { formatDateBR, type IsoDate } from '@/lib/dates';
import { formatMoney, Money } from '@/lib/money';

import { cardAudit, type CreditCardContext } from './card-context';
import type { CardPurchase, CreditCard } from '../domain/entities/credit-card';
import { assertValidInstallments, CreditCardError } from '../domain/rules/card-rules';
import { computeCardDebt } from '../domain/services/invoices';

export interface PurchaseInput {
  cardId: string;
  description: string;
  categoryId: string | null;
  /** Valor total da compra (dividido entre as parcelas). */
  totalAmount: Money;
  purchaseDate: IsoDate;
  installmentCount: number;
}

function installmentsLabel(purchase: Pick<CardPurchase, 'installmentCount' | 'totalAmount'>) {
  return purchase.installmentCount > 1
    ? `${formatMoney(purchase.totalAmount)} em ${purchase.installmentCount}x`
    : formatMoney(purchase.totalAmount);
}

/**
 * Valida a compra: cartão ativo, data não futura, categoria de despesa e
 * limite disponível suficiente (a compra compromete o limite pelo valor total).
 */
async function preparePurchase(
  context: CreditCardContext,
  input: PurchaseInput,
  replacing?: CardPurchase,
): Promise<{ card: CreditCard; values: Omit<CardPurchase, 'id' | 'status'> }> {
  const card = await context.cards.findById(input.cardId);
  if (!card) throw new CreditCardError('not_found', 'Cartão não encontrado.');
  if (card.status !== 'active') {
    throw new CreditCardError(
      'card_inactive',
      `O cartão "${card.name}" está ${card.status === 'blocked' ? 'bloqueado' : 'cancelado'} e não aceita compras.`,
    );
  }
  const description = normalizeDescription(input.description);
  assertValidAmount(input.totalAmount);
  assertValidInstallments(input.installmentCount);
  const today = context.today();
  if (input.purchaseDate > today) {
    throw new CreditCardError('purchase_in_future', 'A data da compra não pode ser futura.');
  }
  if (input.categoryId !== null) {
    const category = (await context.categories.findAll()).find(
      (item) => item.id === input.categoryId,
    );
    if (!category) throw new CreditCardError('category_not_found', 'Categoria não encontrada.');
    if (category.kind !== 'expense') {
      throw new CreditCardError('category_mismatch', 'Escolha uma categoria de despesa.');
    }
  }

  const [purchases, transactions] = await Promise.all([
    context.cards.findPurchases(),
    context.transactions.findAll(),
  ]);
  const others = purchases.filter((item) => item.id !== replacing?.id);
  const debt = computeCardDebt(card, others, transactions, today);
  const available = card.limit.subtract(debt).max(Money.zero(card.limit.currency));
  if (input.totalAmount.greaterThan(available)) {
    throw new CreditCardError(
      'limit_exceeded',
      `Limite disponível insuficiente: ${formatMoney(available)} livres no "${card.name}".`,
    );
  }

  return {
    card,
    values: {
      cardId: card.id,
      description,
      categoryId: input.categoryId,
      totalAmount: input.totalAmount,
      purchaseDate: input.purchaseDate,
      installmentCount: input.installmentCount,
    },
  };
}

/** Registra compra avulsa (1x) ou parcelada. As parcelas são derivadas (ADR 0007). */
export class RegisterPurchaseUseCase {
  constructor(private readonly context: CreditCardContext) {}

  async execute(input: PurchaseInput): Promise<CardPurchase> {
    await this.context.prepare?.();
    const { card, values } = await preparePurchase(this.context, input);
    const purchase: CardPurchase = { id: this.context.newId(), ...values, status: 'active' };
    await this.context.cards.savePurchase(purchase);
    await this.context.audit.append([
      cardAudit(
        this.context,
        'card_purchase',
        purchase.id,
        'created',
        `Compra de ${installmentsLabel(purchase)} no ${card.name} em ${formatDateBR(purchase.purchaseDate)}.`,
      ),
    ]);
    return purchase;
  }
}

/** Edita uma compra ativa (o cartão não muda). Faturas são recalculadas automaticamente. */
export class UpdatePurchaseUseCase {
  constructor(private readonly context: CreditCardContext) {}

  async execute(id: string, input: PurchaseInput): Promise<void> {
    await this.context.prepare?.();
    const current = await this.context.cards.findPurchaseById(id);
    if (!current) throw new CreditCardError('purchase_not_found', 'Compra não encontrada.');
    if (current.status === 'cancelled') {
      throw new CreditCardError('purchase_cancelled', 'Compras canceladas não podem ser editadas.');
    }
    if (input.cardId !== current.cardId) {
      throw new CreditCardError(
        'purchase_card_change',
        'Não é possível mover a compra para outro cartão. Cancele-a e registre novamente.',
      );
    }
    const { values } = await preparePurchase(this.context, input, current);
    const updated: CardPurchase = { ...current, ...values };
    await this.context.cards.savePurchase(updated);
    const summary =
      current.totalAmount.equals(updated.totalAmount) &&
      current.installmentCount === updated.installmentCount
        ? 'Dados da compra alterados.'
        : `Valor alterado de ${installmentsLabel(current)} para ${installmentsLabel(updated)}.`;
    await this.context.audit.append([
      cardAudit(this.context, 'card_purchase', id, 'updated', summary),
    ]);
  }
}

/**
 * Cancela (estorno da compra): todas as parcelas deixam de compor as faturas e
 * o limite é liberado. O registro permanece no histórico.
 */
export class CancelPurchaseUseCase {
  constructor(private readonly context: CreditCardContext) {}

  async execute(id: string): Promise<void> {
    const current = await this.context.cards.findPurchaseById(id);
    if (!current) throw new CreditCardError('purchase_not_found', 'Compra não encontrada.');
    if (current.status === 'cancelled') return;
    await this.context.cards.savePurchase({ ...current, status: 'cancelled' });
    await this.context.audit.append([
      cardAudit(
        this.context,
        'card_purchase',
        id,
        'cancelled',
        `Compra cancelada: ${current.description} (${installmentsLabel(current)}).`,
      ),
    ]);
  }
}
