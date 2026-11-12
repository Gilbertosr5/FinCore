import { getFinancialEntries } from '@/features/dashboard/domain/financial-entries';
import { asMonthKey } from '@/lib/dates';
import { Money } from '@/lib/money';

import { createInMemoryFinance, day, defaultCard } from '../../../../tests/helpers/in-memory-cards';
import { buildInvoiceForMonth } from '../domain/services/invoices';

/*
 * Cenário padrão: hoje = 10/03/2026; cartão fecha dia 3 e vence dia 10, limite
 * R$ 5.000, pago pela conta "checking" (saldo inicial R$ 1.000).
 * Fatura aberta hoje = abril (a de março fechou em 03/03 e vence hoje).
 */

const brl = (value: string) => Money.of(value);
const month = asMonthKey;

function purchaseInput(
  overrides: {
    description?: string;
    totalAmount?: Money;
    purchaseDate?: string;
    installmentCount?: number;
    categoryId?: string | null;
    cardId?: string;
  } = {},
) {
  return {
    cardId: overrides.cardId ?? 'card',
    description: overrides.description ?? 'Mercado',
    categoryId: overrides.categoryId === undefined ? 'food' : overrides.categoryId,
    totalAmount: overrides.totalAmount ?? brl('300'),
    purchaseDate: day(overrides.purchaseDate ?? '2026-03-05'),
    installmentCount: overrides.installmentCount ?? 1,
  };
}

function invoiceOf(env: ReturnType<typeof createInMemoryFinance>, invoiceMonth: string) {
  const card = env.finance.cards.get('card');
  if (!card) throw new Error('cartão ausente');
  return buildInvoiceForMonth(
    card,
    [...env.finance.purchases.values()],
    [...env.state.transactions.values()],
    month(invoiceMonth),
    day('2026-03-10'),
  );
}

describe('cadastro de cartões', () => {
  it('cria cartão ativo e registra no histórico', async () => {
    const env = createInMemoryFinance({ cards: [] });
    const card = await env.cards.createCard.execute({
      name: '  Cartão   Novo ',
      institution: 'Banco X',
      brand: 'elo',
      limit: brl('2500'),
      closingDay: 28,
      dueDay: 5,
      paymentAccountId: 'checking',
    });
    expect(card).toMatchObject({ name: 'Cartão Novo', status: 'active', closingDay: 28 });
    expect(env.state.auditLog.at(-1)).toMatchObject({
      entityType: 'credit_card',
      entityId: card.id,
      action: 'created',
    });
  });

  it.each([
    [{ name: 'A' }, 'invalid_name'],
    [{ limit: brl('0') }, 'invalid_limit'],
    [{ closingDay: 0 }, 'invalid_day'],
    [{ dueDay: 32 }, 'invalid_day'],
    [{ paymentAccountId: 'old' }, 'account_archived'],
    [{ paymentAccountId: 'nope' }, 'account_not_found'],
  ])('rejeita dados inválidos %o', async (override, code) => {
    const env = createInMemoryFinance({ cards: [] });
    await expect(
      env.cards.createCard.execute({
        name: 'Cartão',
        institution: '',
        brand: 'visa',
        limit: brl('1000'),
        closingDay: 3,
        dueDay: 10,
        paymentAccountId: 'checking',
        ...override,
      }),
    ).rejects.toMatchObject({ code });
  });

  it('não exclui cartão com compras; cartão sem uso pode ser excluído', async () => {
    const env = createInMemoryFinance({ cards: [defaultCard(), defaultCard({ id: 'unused' })] });
    await env.cards.registerPurchase.execute(purchaseInput());
    await expect(env.cards.deleteCard.execute('card')).rejects.toMatchObject({
      code: 'card_in_use',
    });
    await env.cards.deleteCard.execute('unused');
    expect(env.finance.cards.has('unused')).toBe(false);
  });

  it('cartão bloqueado não aceita compras', async () => {
    const env = createInMemoryFinance();
    await env.cards.setStatus.execute('card', 'blocked');
    await expect(env.cards.registerPurchase.execute(purchaseInput())).rejects.toMatchObject({
      code: 'card_inactive',
    });
  });
});

describe('compras no cartão', () => {
  it('compra NÃO altera o saldo da conta e compromete o limite', async () => {
    const env = createInMemoryFinance();
    const before = await env.balanceOf('checking');
    await env.cards.registerPurchase.execute(purchaseInput({ totalAmount: brl('1200') }));
    expect((await env.balanceOf('checking')).equals(before)).toBe(true);

    const { cards } = await env.cards.list.execute();
    expect(cards[0]?.usage.used.equals(brl('1200'))).toBe(true);
    expect(cards[0]?.usage.available.equals(brl('3800'))).toBe(true);
  });

  it('parcelada distribui as parcelas nas faturas seguintes com soma exata', async () => {
    const env = createInMemoryFinance();
    await env.cards.registerPurchase.execute(
      purchaseInput({ totalAmount: brl('100'), installmentCount: 3, purchaseDate: '2026-03-05' }),
    );
    // Compra após o fechamento (03/03): 1ª parcela na fatura de abril.
    const totals = ['2026-04', '2026-05', '2026-06', '2026-07'].map(
      (invoiceMonth) => invoiceOf(env, invoiceMonth).total,
    );
    expect(totals.map((value) => value.toString())).toEqual(['33.34', '33.33', '33.33', '0.00']);
    expect(Money.sum(totals).equals(brl('100'))).toBe(true);
  });

  it('compra antes do fechamento entra na fatura do mês; no dia do fechamento, na seguinte', async () => {
    const env = createInMemoryFinance();
    await env.cards.registerPurchase.execute(
      purchaseInput({ description: 'Antes', purchaseDate: '2026-03-02', totalAmount: brl('10') }),
    );
    await env.cards.registerPurchase.execute(
      purchaseInput({ description: 'No dia', purchaseDate: '2026-03-03', totalAmount: brl('20') }),
    );
    expect(invoiceOf(env, '2026-03').total.toString()).toBe('10.00');
    expect(invoiceOf(env, '2026-04').total.toString()).toBe('20.00');
  });

  it('rejeita compra acima do limite disponível, data futura e categoria de receita', async () => {
    const env = createInMemoryFinance();
    await env.cards.registerPurchase.execute(purchaseInput({ totalAmount: brl('4900') }));
    await expect(
      env.cards.registerPurchase.execute(purchaseInput({ totalAmount: brl('100.01') })),
    ).rejects.toMatchObject({ code: 'limit_exceeded' });
    await expect(
      env.cards.registerPurchase.execute(purchaseInput({ purchaseDate: '2026-03-11' })),
    ).rejects.toMatchObject({ code: 'purchase_in_future' });
    await expect(
      env.cards.registerPurchase.execute(
        purchaseInput({ totalAmount: brl('1'), categoryId: 'salary' }),
      ),
    ).rejects.toMatchObject({ code: 'category_mismatch' });
    await expect(
      env.cards.registerPurchase.execute(
        purchaseInput({ totalAmount: brl('1'), installmentCount: 49 }),
      ),
    ).rejects.toMatchObject({ code: 'invalid_installments' });
  });

  it('edição recalcula parcelas considerando o limite sem contar a própria compra', async () => {
    const env = createInMemoryFinance();
    const purchase = await env.cards.registerPurchase.execute(
      purchaseInput({ totalAmount: brl('4000') }),
    );
    await env.cards.updatePurchase.execute(
      purchase.id,
      purchaseInput({ totalAmount: brl('5000'), installmentCount: 2 }),
    );
    expect(invoiceOf(env, '2026-04').total.toString()).toBe('2500.00');
    expect(invoiceOf(env, '2026-05').total.toString()).toBe('2500.00');
    await expect(
      env.cards.updatePurchase.execute(purchase.id, { ...purchaseInput(), cardId: 'other' }),
    ).rejects.toMatchObject({ code: 'purchase_card_change' });
  });

  it('cancelar compra remove as parcelas das faturas e libera o limite', async () => {
    const env = createInMemoryFinance();
    const purchase = await env.cards.registerPurchase.execute(
      purchaseInput({ totalAmount: brl('600'), installmentCount: 3 }),
    );
    await env.cards.cancelPurchase.execute(purchase.id);
    expect(invoiceOf(env, '2026-04').total.isZero()).toBe(true);
    const { cards } = await env.cards.list.execute();
    expect(cards[0]?.usage.used.isZero()).toBe(true);
    await expect(
      env.cards.updatePurchase.execute(purchase.id, purchaseInput()),
    ).rejects.toMatchObject({ code: 'purchase_cancelled' });
    expect(
      env.state.auditLog.some((e) => e.entityId === purchase.id && e.action === 'cancelled'),
    ).toBe(true);
  });
});

describe('pagamento de fatura', () => {
  async function withClosedInvoice() {
    const env = createInMemoryFinance();
    // 01/03 < fechamento 03/03: fatura de março (fechada, vence hoje).
    await env.cards.registerPurchase.execute(
      purchaseInput({ purchaseDate: '2026-03-01', totalAmount: brl('400') }),
    );
    return env;
  }

  it('paga a fatura: reduz o saldo da conta, quita a fatura e NÃO gera despesa', async () => {
    const env = await withClosedInvoice();
    const before = await env.balanceOf('checking');
    expect(invoiceOf(env, '2026-03').status).toBe('closed');

    const payment = await env.cards.payInvoice.execute({
      cardId: 'card',
      invoiceMonth: month('2026-03'),
      amount: brl('400'),
      accountId: 'checking',
      paidDate: day('2026-03-10'),
    });

    expect(payment).toMatchObject({
      kind: 'card_payment',
      status: 'paid',
      categoryId: null,
      cardPayment: { cardId: 'card', invoiceMonth: '2026-03' },
    });
    expect((await env.balanceOf('checking')).equals(before.subtract(brl('400')))).toBe(true);
    const invoice = invoiceOf(env, '2026-03');
    expect(invoice.status).toBe('paid');
    expect(invoice.outstanding.isZero()).toBe(true);

    // Consumo contado uma única vez: a parcela, nunca o pagamento.
    const entries = getFinancialEntries({
      transactions: [...env.state.transactions.values()],
      cards: [...env.finance.cards.values()],
      purchases: [...env.finance.purchases.values()],
    });
    const expenses = entries.filter((entry) => entry.type === 'expense');
    expect(expenses).toHaveLength(1);
    expect(expenses[0]?.amount.equals(brl('400'))).toBe(true);

    // Limite liberado após o pagamento.
    const { cards } = await env.cards.list.execute();
    expect(cards[0]?.usage.used.isZero()).toBe(true);
  });

  it('pagamento parcial deixa a fatura parcialmente paga com o saldo em aberto', async () => {
    const env = await withClosedInvoice();
    await env.cards.payInvoice.execute({
      cardId: 'card',
      invoiceMonth: month('2026-03'),
      amount: brl('150'),
      accountId: 'savings',
      paidDate: day('2026-03-09'),
    });
    const invoice = invoiceOf(env, '2026-03');
    expect(invoice.status).toBe('partially_paid');
    expect(invoice.outstanding.toString()).toBe('250.00');
  });

  it('rejeita pagar mais que o saldo, data futura, conta arquivada e fatura futura', async () => {
    const env = await withClosedInvoice();
    const base = {
      cardId: 'card',
      invoiceMonth: month('2026-03'),
      amount: brl('400'),
      accountId: 'checking',
      paidDate: day('2026-03-10'),
    };
    await expect(
      env.cards.payInvoice.execute({ ...base, amount: brl('400.01') }),
    ).rejects.toMatchObject({ code: 'payment_exceeds_outstanding' });
    await expect(
      env.cards.payInvoice.execute({ ...base, paidDate: day('2026-03-11') }),
    ).rejects.toMatchObject({ code: 'paid_in_future' });
    await expect(env.cards.payInvoice.execute({ ...base, accountId: 'old' })).rejects.toMatchObject(
      { code: 'account_archived' },
    );
    await env.cards.registerPurchase.execute(
      purchaseInput({ purchaseDate: '2026-03-05', totalAmount: brl('90'), installmentCount: 3 }),
    );
    await expect(
      env.cards.payInvoice.execute({ ...base, invoiceMonth: month('2026-05'), amount: brl('30') }),
    ).rejects.toMatchObject({ code: 'invoice_not_payable' });
  });

  it('aceita antecipar o pagamento da fatura aberta', async () => {
    const env = createInMemoryFinance();
    await env.cards.registerPurchase.execute(purchaseInput({ totalAmount: brl('80') }));
    await env.cards.payInvoice.execute({
      cardId: 'card',
      invoiceMonth: month('2026-04'),
      amount: brl('80'),
      accountId: 'checking',
      paidDate: day('2026-03-10'),
    });
    expect(invoiceOf(env, '2026-04').status).toBe('paid');
  });

  it('estorno cancela o pagamento: saldo da conta volta e a fatura reabre', async () => {
    const env = await withClosedInvoice();
    const before = await env.balanceOf('checking');
    const payment = await env.cards.payInvoice.execute({
      cardId: 'card',
      invoiceMonth: month('2026-03'),
      amount: brl('400'),
      accountId: 'checking',
      paidDate: day('2026-03-10'),
    });
    await env.cards.reversePayment.execute(payment.id);

    expect(env.state.transactions.get(payment.id)?.status).toBe('cancelled');
    expect((await env.balanceOf('checking')).equals(before)).toBe(true);
    expect(invoiceOf(env, '2026-03').outstanding.toString()).toBe('400.00');
    await expect(env.cards.reversePayment.execute('inexistente')).rejects.toMatchObject({
      code: 'payment_not_found',
    });
  });

  it('pagamento de fatura não pode ser editado pelo módulo de transações', async () => {
    const env = await withClosedInvoice();
    const payment = await env.cards.payInvoice.execute({
      cardId: 'card',
      invoiceMonth: month('2026-03'),
      amount: brl('400'),
      accountId: 'checking',
      paidDate: day('2026-03-10'),
    });
    await expect(env.ledger.cancel.execute(payment.id)).rejects.toMatchObject({
      code: 'not_editable',
    });
  });
});

describe('consultas de cartões', () => {
  it('lista faturas a pagar, fatura aberta e parcelas futuras', async () => {
    const env = createInMemoryFinance();
    await env.cards.registerPurchase.execute(
      purchaseInput({ purchaseDate: '2026-03-01', totalAmount: brl('400') }),
    );
    await env.cards.registerPurchase.execute(
      purchaseInput({ purchaseDate: '2026-03-06', totalAmount: brl('300'), installmentCount: 3 }),
    );
    const summary = await env.cards.list.execute();
    const overview = summary.cards[0];
    expect(overview?.openInvoice.month).toBe('2026-04');
    expect(overview?.openInvoice.total.toString()).toBe('100.00');
    expect(overview?.pendingInvoices.map((invoice) => invoice.month)).toEqual(['2026-03']);
    expect(overview?.futureInstallments.toString()).toBe('200.00');
    expect(summary.totalDue.toString()).toBe('400.00');
    expect(summary.totalUsed.toString()).toBe('700.00');

    const details = await env.cards.details.execute('card');
    expect(details.invoices.map((invoice) => invoice.month)).toEqual([
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
    ]);
    expect(details.futureByMonth.map((item) => [item.month, item.amount.toString()])).toEqual([
      ['2026-05', '100.00'],
      ['2026-06', '100.00'],
    ]);
    const parcelada = details.purchases.find((item) => item.purchase.installmentCount === 3);
    expect(parcelada?.futureCount).toBe(2);
    expect(details.paymentAccounts.map((item) => item.id)).not.toContain('old');
  });

  it('fatura aberta sem compras aparece vazia e cartões cancelados saem dos totais', async () => {
    const env = createInMemoryFinance({
      cards: [defaultCard(), defaultCard({ id: 'cancelado', status: 'cancelled' })],
    });
    const summary = await env.cards.list.execute();
    expect(summary.cards.map((item) => item.card.id)).toEqual(['card', 'cancelado']);
    expect(summary.totalLimit.toString()).toBe('5000.00');
    const details = await env.cards.details.execute('card');
    expect(details.invoices).toHaveLength(1);
    expect(details.invoices[0]).toMatchObject({ month: '2026-04', status: 'open' });
  });
});
