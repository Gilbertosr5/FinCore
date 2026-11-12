import { formatMoney } from '@/lib/money';
import type { Money } from '@/lib/money';

import { cardAudit, type CreditCardContext } from './card-context';
import type { CardBrand, CardStatus, CreditCard } from '../domain/entities/credit-card';
import {
  assertValidDay,
  assertValidLimit,
  CARD_INSTITUTION_MAX_LENGTH,
  CARD_NAME_MAX_LENGTH,
  CreditCardError,
} from '../domain/rules/card-rules';

export interface CardInput {
  name: string;
  institution: string;
  brand: CardBrand;
  limit: Money;
  closingDay: number;
  dueDay: number;
  paymentAccountId: string;
}

export const CARD_STATUS_LABELS: Record<CardStatus, string> = {
  active: 'Ativo',
  blocked: 'Bloqueado',
  cancelled: 'Cancelado',
};

async function normalizeCardInput(
  context: CreditCardContext,
  input: CardInput,
  currentAccountId?: string,
): Promise<CardInput> {
  const name = input.name.trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > CARD_NAME_MAX_LENGTH) {
    throw new CreditCardError(
      'invalid_name',
      `O nome do cartão deve ter entre 2 e ${CARD_NAME_MAX_LENGTH} caracteres.`,
    );
  }
  const institution = input.institution.trim().replace(/\s+/g, ' ');
  if (institution.length > CARD_INSTITUTION_MAX_LENGTH) {
    throw new CreditCardError(
      'invalid_name',
      `A instituição pode ter até ${CARD_INSTITUTION_MAX_LENGTH} caracteres.`,
    );
  }
  assertValidLimit(input.limit);
  assertValidDay(input.closingDay, 'fechamento');
  assertValidDay(input.dueDay, 'vencimento');

  const account = await context.accounts.findById(input.paymentAccountId);
  if (!account)
    throw new CreditCardError('account_not_found', 'Conta de pagamento não encontrada.');
  // Mantém uma conta já vinculada mesmo que tenha sido arquivada depois.
  if (account.archived && account.id !== currentAccountId) {
    throw new CreditCardError(
      'account_archived',
      `A conta "${account.name}" está arquivada. Escolha outra conta de pagamento.`,
    );
  }
  return { ...input, name, institution };
}

export class CreateCardUseCase {
  constructor(private readonly context: CreditCardContext) {}

  async execute(input: CardInput): Promise<CreditCard> {
    const normalized = await normalizeCardInput(this.context, input);
    const card: CreditCard = { id: this.context.newId(), ...normalized, status: 'active' };
    await this.context.cards.save(card);
    await this.context.audit.append([
      cardAudit(
        this.context,
        'credit_card',
        card.id,
        'created',
        `Cartão criado com limite de ${formatMoney(card.limit)}.`,
      ),
    ]);
    return card;
  }
}

/**
 * Edita o cartão. Faturas são derivadas: alterar os dias de fechamento ou de
 * vencimento recalcula o calendário de todas as faturas (ver ADR 0010).
 */
export class UpdateCardUseCase {
  constructor(private readonly context: CreditCardContext) {}

  async execute(id: string, input: CardInput): Promise<void> {
    const current = await this.context.cards.findById(id);
    if (!current) throw new CreditCardError('not_found', 'Cartão não encontrado.');
    const normalized = await normalizeCardInput(this.context, input, current.paymentAccountId);
    await this.context.cards.save({ ...current, ...normalized });

    const changes: string[] = [];
    if (!current.limit.equals(normalized.limit)) {
      changes.push(`limite de ${formatMoney(current.limit)} para ${formatMoney(normalized.limit)}`);
    }
    if (current.closingDay !== normalized.closingDay || current.dueDay !== normalized.dueDay) {
      changes.push(
        `fechamento/vencimento de ${current.closingDay}/${current.dueDay} para ${normalized.closingDay}/${normalized.dueDay}`,
      );
    }
    await this.context.audit.append([
      cardAudit(
        this.context,
        'credit_card',
        id,
        'updated',
        changes.length > 0 ? `Alterado: ${changes.join('; ')}.` : 'Dados do cartão alterados.',
      ),
    ]);
  }
}

/** Bloqueia, cancela ou reativa. Faturas pendentes continuam pagáveis. */
export class SetCardStatusUseCase {
  constructor(private readonly context: CreditCardContext) {}

  async execute(id: string, status: CardStatus): Promise<void> {
    const current = await this.context.cards.findById(id);
    if (!current) throw new CreditCardError('not_found', 'Cartão não encontrado.');
    if (current.status === status) return;
    await this.context.cards.save({ ...current, status });
    await this.context.audit.append([
      cardAudit(
        this.context,
        'credit_card',
        id,
        status === 'active' ? 'restored' : status === 'cancelled' ? 'cancelled' : 'updated',
        `Situação alterada para "${CARD_STATUS_LABELS[status]}".`,
      ),
    ]);
  }
}

/** Exclusão definitiva só para cartões sem compras nem pagamentos; caso contrário, cancele. */
export class DeleteCardUseCase {
  constructor(private readonly context: CreditCardContext) {}

  async execute(id: string): Promise<void> {
    const current = await this.context.cards.findById(id);
    if (!current) throw new CreditCardError('not_found', 'Cartão não encontrado.');
    const [purchases, transactions] = await Promise.all([
      this.context.cards.findPurchases(),
      this.context.transactions.findAll(),
    ]);
    const inUse =
      purchases.some((item) => item.cardId === id) ||
      transactions.some((tx) => tx.cardPayment?.cardId === id);
    if (inUse) {
      throw new CreditCardError(
        'card_in_use',
        'Este cartão possui compras ou pagamentos e não pode ser excluído. Cancele-o para preservar o histórico.',
      );
    }
    await this.context.cards.remove(id);
    await this.context.audit.append([
      cardAudit(this.context, 'credit_card', id, 'deleted', `Excluído: ${current.name}.`),
    ]);
  }
}
