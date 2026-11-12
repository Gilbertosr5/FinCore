import type { Account } from '@/features/accounts/domain/entities/account';
import type { Transaction } from '@/features/transactions/domain/entities/transaction';
import type { IsoDate, MonthKey } from '@/lib/dates';
import { Money } from '@/lib/money';

import type { CreditCardContext } from './card-context';
import type { CardPurchase, CreditCard } from '../domain/entities/credit-card';
import { CreditCardError } from '../domain/rules/card-rules';
import { expandInstallments, type CardInstallment } from '../domain/services/invoice-schedule';
import {
  buildInvoiceForMonth,
  buildInvoices,
  computeCardDebt,
  computeLimitUsage,
  getOpenInvoiceMonth,
  type CardLimitUsage,
  type Invoice,
} from '../domain/services/invoices';

export interface CardOverview {
  card: CreditCard;
  paymentAccountName: string | null;
  usage: CardLimitUsage;
  /** Fatura aberta hoje (pode estar vazia). */
  openInvoice: Invoice;
  /** Faturas fechadas, vencidas ou parcialmente pagas com saldo em aberto. */
  pendingInvoices: Invoice[];
  /** Soma das parcelas lançadas em faturas posteriores à aberta. */
  futureInstallments: Money;
}

export interface CardsSummary {
  cards: CardOverview[];
  /** Totais dos cartões não cancelados. */
  totalLimit: Money;
  totalUsed: Money;
  totalAvailable: Money;
  /** Saldo em aberto de faturas já fechadas (a pagar). */
  totalDue: Money;
}

export interface PurchaseView {
  purchase: CardPurchase;
  categoryName: string | null;
  installments: CardInstallment[];
  /** Parcelas em faturas posteriores à aberta. */
  futureCount: number;
  futureAmount: Money;
}

export interface PaymentView {
  transaction: Transaction;
  accountName: string;
}

export interface FutureMonth {
  month: MonthKey;
  amount: Money;
  count: number;
}

export interface CardDetails {
  overview: CardOverview;
  openMonth: MonthKey;
  /** Todas as faturas em ordem cronológica, incluindo a aberta mesmo que vazia. */
  invoices: Invoice[];
  purchases: PurchaseView[];
  /** Pagamentos de fatura, inclusive estornados (mais recente primeiro). */
  payments: PaymentView[];
  futureByMonth: FutureMonth[];
  /** Contas ativas que podem pagar a fatura. */
  paymentAccounts: Pick<Account, 'id' | 'name'>[];
}

function buildOverview(
  card: CreditCard,
  purchases: readonly CardPurchase[],
  transactions: readonly Transaction[],
  accounts: readonly Account[],
  today: IsoDate,
): CardOverview {
  const openMonth = getOpenInvoiceMonth(card, today);
  const invoices = buildInvoices(card, purchases, transactions, today);
  const debt = computeCardDebt(card, purchases, transactions, today);
  return {
    card,
    paymentAccountName: accounts.find((item) => item.id === card.paymentAccountId)?.name ?? null,
    usage: computeLimitUsage(card, debt),
    openInvoice: buildInvoiceForMonth(card, purchases, transactions, openMonth, today),
    pendingInvoices: invoices.filter(
      (invoice) =>
        invoice.month < openMonth &&
        invoice.outstanding.isPositive() &&
        invoice.status !== 'future',
    ),
    futureInstallments: Money.sum(
      invoices.filter((invoice) => invoice.month > openMonth).map((invoice) => invoice.total),
      card.limit.currency,
    ),
  };
}

const STATUS_ORDER: Record<CreditCard['status'], number> = { active: 0, blocked: 1, cancelled: 2 };

async function load(context: CreditCardContext) {
  await context.prepare?.();
  const [cards, purchases, transactions, accounts] = await Promise.all([
    context.cards.findAll(),
    context.cards.findPurchases(),
    context.transactions.findAll(),
    context.accounts.findAll(),
  ]);
  return { cards, purchases, transactions, accounts };
}

/** Cartões com limite, fatura aberta, faturas a pagar e parcelas futuras. */
export class ListCardsUseCase {
  constructor(private readonly context: CreditCardContext) {}

  async execute(): Promise<CardsSummary> {
    const { cards, purchases, transactions, accounts } = await load(this.context);
    const today = this.context.today();
    const overviews = cards
      .map((card) => buildOverview(card, purchases, transactions, accounts, today))
      .sort(
        (a, b) =>
          STATUS_ORDER[a.card.status] - STATUS_ORDER[b.card.status] ||
          a.card.name.localeCompare(b.card.name, 'pt-BR'),
      );
    const counted = overviews.filter((item) => item.card.status !== 'cancelled');
    const totalLimit = Money.sum(counted.map((item) => item.card.limit));
    const totalUsed = Money.sum(counted.map((item) => item.usage.used));
    return {
      cards: overviews,
      totalLimit,
      totalUsed,
      totalAvailable: Money.sum(counted.map((item) => item.usage.available)),
      totalDue: Money.sum(
        overviews.flatMap((item) => item.pendingInvoices.map((invoice) => invoice.outstanding)),
      ),
    };
  }
}

/** Detalhes de um cartão: faturas, compras com parcelas, pagamentos e parcelas futuras. */
export class GetCardDetailsUseCase {
  constructor(private readonly context: CreditCardContext) {}

  async execute(cardId: string): Promise<CardDetails> {
    const { cards, purchases, transactions, accounts } = await load(this.context);
    const card = cards.find((item) => item.id === cardId);
    if (!card) throw new CreditCardError('not_found', 'Cartão não encontrado.');
    const today = this.context.today();
    const categories = await this.context.categories.findAll();
    const categoryName = new Map(categories.map((item) => [item.id, item.name]));
    const accountName = new Map(accounts.map((item) => [item.id, item.name]));
    const openMonth = getOpenInvoiceMonth(card, today);

    const invoices = buildInvoices(card, purchases, transactions, today);
    if (!invoices.some((invoice) => invoice.month === openMonth)) {
      invoices.push(buildInvoiceForMonth(card, purchases, transactions, openMonth, today));
    }
    invoices.sort((a, b) => (a.month < b.month ? -1 : 1));

    const purchaseViews = purchases
      .filter((purchase) => purchase.cardId === card.id)
      .map((purchase): PurchaseView => {
        const installments = expandInstallments(purchase, card);
        const future = installments.filter((item) => item.invoiceMonth > openMonth);
        return {
          purchase,
          categoryName: purchase.categoryId
            ? (categoryName.get(purchase.categoryId) ?? null)
            : null,
          installments,
          futureCount: future.length,
          futureAmount: Money.sum(future.map((item) => item.amount)),
        };
      })
      .sort((a, b) =>
        a.purchase.purchaseDate === b.purchase.purchaseDate
          ? b.purchase.id.localeCompare(a.purchase.id)
          : a.purchase.purchaseDate < b.purchase.purchaseDate
            ? 1
            : -1,
      );

    const futureByMonth = invoices
      .filter((invoice) => invoice.month > openMonth && !invoice.total.isZero())
      .map((invoice) => ({
        month: invoice.month,
        amount: invoice.total,
        count: invoice.installments.length,
      }))
      .sort((a, b) => (a.month < b.month ? -1 : 1));

    const payments = transactions
      .filter((tx) => tx.kind === 'card_payment' && tx.cardPayment?.cardId === card.id)
      .map((transaction) => ({
        transaction,
        accountName: accountName.get(transaction.accountId) ?? 'Conta',
      }))
      .sort((a, b) => {
        const dateA = a.transaction.paidDate ?? a.transaction.competenceDate;
        const dateB = b.transaction.paidDate ?? b.transaction.competenceDate;
        return dateA === dateB ? 0 : dateA < dateB ? 1 : -1;
      });

    return {
      overview: buildOverview(card, purchases, transactions, accounts, today),
      openMonth,
      invoices,
      purchases: purchaseViews,
      payments,
      futureByMonth,
      paymentAccounts: accounts
        .filter((account) => !account.archived)
        .map(({ id, name }) => ({ id, name })),
    };
  }
}
