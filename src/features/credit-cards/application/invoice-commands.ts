import type { Transaction } from '@/features/transactions/domain/entities/transaction';
import { assertValidAmount } from '@/features/transactions/domain/rules/transaction-rules';
import { formatDateBR, formatMonthShort, type IsoDate, type MonthKey } from '@/lib/dates';
import { formatMoney, type Money } from '@/lib/money';

import { cardAudit, type CreditCardContext } from './card-context';
import { CreditCardError } from '../domain/rules/card-rules';
import { buildInvoiceForMonth, INVOICE_STATUS_LABELS } from '../domain/services/invoices';

export interface PayInvoiceInput {
  cardId: string;
  invoiceMonth: MonthKey;
  amount: Money;
  /** Conta debitada (padrão: conta de pagamento do cartão). */
  accountId: string;
  paidDate: IsoDate;
}

/**
 * Paga (total ou parcialmente) uma fatura. Cria uma transação `card_payment`
 * liquidada na conta escolhida: reduz o saldo da conta e liquida a obrigação do
 * cartão, mas NUNCA é despesa de consumo — o consumo já está nas parcelas
 * (ADR 0007). Não aceita pagar mais que o saldo em aberto nem faturas futuras.
 */
export class PayInvoiceUseCase {
  constructor(private readonly context: CreditCardContext) {}

  async execute(input: PayInvoiceInput): Promise<Transaction> {
    await this.context.prepare?.();
    const today = this.context.today();
    assertValidAmount(input.amount);
    if (input.paidDate > today) {
      throw new CreditCardError('paid_in_future', 'A data do pagamento não pode ser futura.');
    }
    const card = await this.context.cards.findById(input.cardId);
    if (!card) throw new CreditCardError('not_found', 'Cartão não encontrado.');
    const account = await this.context.accounts.findById(input.accountId);
    if (!account) throw new CreditCardError('account_not_found', 'Conta não encontrada.');
    if (account.archived) {
      throw new CreditCardError(
        'account_archived',
        `A conta "${account.name}" está arquivada. Escolha outra conta.`,
      );
    }

    const [purchases, transactions] = await Promise.all([
      this.context.cards.findPurchases(),
      this.context.transactions.findAll(),
    ]);
    const invoice = buildInvoiceForMonth(card, purchases, transactions, input.invoiceMonth, today);
    const month = formatMonthShort(invoice.month);
    if (invoice.status === 'future') {
      throw new CreditCardError(
        'invoice_not_payable',
        `A fatura de ${month} ainda não está aberta.`,
      );
    }
    if (!invoice.outstanding.isPositive()) {
      throw new CreditCardError(
        'invoice_not_payable',
        `A fatura de ${month} não tem saldo em aberto (${INVOICE_STATUS_LABELS[invoice.status].toLowerCase()}).`,
      );
    }
    if (input.amount.greaterThan(invoice.outstanding)) {
      throw new CreditCardError(
        'payment_exceeds_outstanding',
        `O valor excede o saldo em aberto da fatura (${formatMoney(invoice.outstanding)}).`,
      );
    }

    const payment: Transaction = {
      id: this.context.newId(),
      kind: 'card_payment',
      description: `Pagamento fatura ${card.name} — ${month}`,
      amount: input.amount,
      accountId: account.id,
      categoryId: null,
      competenceDate: input.paidDate,
      dueDate: invoice.dueDate,
      paidDate: input.paidDate,
      status: 'paid',
      transfer: null,
      cardPayment: { cardId: card.id, invoiceMonth: invoice.month },
      investment: null,
      recurrenceId: null,
      installment: null,
      tags: [],
      notes: null,
    };
    await this.context.transactions.commit({ upsert: [payment] });
    const partial = input.amount.lessThan(invoice.outstanding);
    await this.context.audit.append([
      cardAudit(
        this.context,
        'transaction',
        payment.id,
        'paid',
        `${partial ? 'Pagamento parcial' : 'Pagamento'} de ${formatMoney(input.amount)} da fatura de ${month} em ${formatDateBR(input.paidDate)}, debitado de ${account.name}.`,
      ),
      cardAudit(
        this.context,
        'credit_card',
        card.id,
        'paid',
        `Fatura de ${month}: ${partial ? 'pagamento parcial' : 'pagamento'} de ${formatMoney(input.amount)}.`,
      ),
    ]);
    return payment;
  }
}

/**
 * Estorna um pagamento de fatura: a transação fica cancelada (sem efeito no
 * saldo da conta) e a fatura volta a ter o valor em aberto.
 */
export class ReversePaymentUseCase {
  constructor(private readonly context: CreditCardContext) {}

  async execute(transactionId: string): Promise<void> {
    const payment = await this.context.transactions.findById(transactionId);
    if (payment?.kind !== 'card_payment' || payment.cardPayment === null) {
      throw new CreditCardError('payment_not_found', 'Pagamento de fatura não encontrado.');
    }
    if (payment.status === 'cancelled') return;
    await this.context.transactions.commit({
      upsert: [{ ...payment, status: 'cancelled', paidDate: null }],
    });
    const month = formatMonthShort(payment.cardPayment.invoiceMonth);
    await this.context.audit.append([
      cardAudit(
        this.context,
        'transaction',
        payment.id,
        'cancelled',
        `Pagamento de ${formatMoney(payment.amount)} estornado.`,
      ),
      cardAudit(
        this.context,
        'credit_card',
        payment.cardPayment.cardId,
        'unpaid',
        `Fatura de ${month}: pagamento de ${formatMoney(payment.amount)} estornado.`,
      ),
    ]);
  }
}
