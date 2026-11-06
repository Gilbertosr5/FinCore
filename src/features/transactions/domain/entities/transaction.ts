import type { IsoDate, MonthKey } from '@/lib/dates';
import type { Money } from '@/lib/money';

/**
 * Tipos de movimentação de conta:
 * - income / expense: receitas e despesas (entram no resultado financeiro);
 * - transfer: um lado de uma transferência entre contas (nunca é receita/despesa);
 * - card_payment: pagamento de fatura de cartão. Reduz o saldo da conta, mas NÃO
 *   é despesa de consumo — o consumo já foi contabilizado nas compras do cartão;
 * - investment: aplicação (saída) ou resgate (entrada) entre a conta e um ativo da
 *   carteira. Muda a forma do patrimônio, não o resultado: nunca é receita/despesa.
 */
export type TransactionKind = 'income' | 'expense' | 'transfer' | 'card_payment' | 'investment';

/** pending = a pagar/receber; paid = liquidada (paga ou recebida); cancelled = sem efeito. */
export type TransactionStatus = 'pending' | 'paid' | 'cancelled';

export interface TransferLink {
  /** Identificador comum às duas pernas (saída e entrada). */
  id: string;
  direction: 'in' | 'out';
  counterpartAccountId: string;
}

export interface CardPaymentLink {
  cardId: string;
  invoiceMonth: MonthKey;
}

export interface InvestmentLink {
  assetId: string;
  direction: 'application' | 'redemption';
}

export interface InstallmentInfo {
  groupId: string;
  number: number;
  total: number;
}

export interface Transaction {
  id: string;
  kind: TransactionKind;
  description: string;
  /** Sempre positivo; o sentido decorre de `kind` / `transfer.direction`. */
  amount: Money;
  accountId: string;
  categoryId: string | null;
  /** Data de competência: mês ao qual a receita/despesa pertence. */
  competenceDate: IsoDate;
  dueDate: IsoDate | null;
  /** Data de pagamento ou recebimento efetivo. */
  paidDate: IsoDate | null;
  status: TransactionStatus;
  transfer: TransferLink | null;
  cardPayment: CardPaymentLink | null;
  investment: InvestmentLink | null;
  recurrenceId: string | null;
  installment: InstallmentInfo | null;
  tags: string[];
  notes: string | null;
}
