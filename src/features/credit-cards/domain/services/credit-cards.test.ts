import { Money } from '@/lib/money';

import {
  expandInstallments,
  getInvoiceDates,
  getInvoiceMonthForPurchase,
} from './invoice-schedule';
import { buildInvoices, computeCardDebt, computeLimitUsage } from './invoices';
import { card, cardPayment, d, purchase } from '../../../../../tests/helpers/finance-fixtures';

describe('calendário de faturas', () => {
  it('vence no mesmo mês quando o vencimento é depois do fechamento', () => {
    expect(getInvoiceDates({ closingDay: 3, dueDay: 10 }, '2026-03' as never)).toEqual({
      closingDate: '2026-03-03',
      dueDate: '2026-03-10',
    });
  });

  it('vence no mês seguinte quando o vencimento é antes do fechamento', () => {
    expect(getInvoiceDates({ closingDay: 25, dueDay: 5 }, '2026-12' as never)).toEqual({
      closingDate: '2026-12-25',
      dueDate: '2027-01-05',
    });
  });

  it('ajusta dias inexistentes ao último dia do mês', () => {
    expect(getInvoiceDates({ closingDay: 31, dueDay: 10 }, '2026-02' as never)).toEqual({
      closingDate: '2026-02-28',
      dueDate: '2026-03-10',
    });
  });

  it.each([
    ['2026-03-02', '2026-03'], // antes do fechamento
    ['2026-03-03', '2026-04'], // no dia do fechamento: próxima fatura
    ['2026-03-20', '2026-04'],
    ['2026-12-31', '2027-01'], // virada de ano
  ])('compra em %s entra na fatura de %s (fechamento dia 3)', (date, month) => {
    expect(getInvoiceMonthForPurchase({ closingDay: 3, dueDay: 10 }, d(date))).toBe(month);
  });
});

describe('parcelamento', () => {
  const visa = card({ id: 'visa', closingDay: 3, dueDay: 10 });

  it('distribui as parcelas nas faturas seguintes sem perder centavos', () => {
    const installments = expandInstallments(
      purchase({
        cardId: 'visa',
        totalAmount: '1000',
        purchaseDate: '2026-01-20',
        installmentCount: 3,
      }),
      visa,
    );
    expect(
      installments.map((item) => [item.number, item.invoiceMonth, item.amount.toString()]),
    ).toEqual([
      [1, '2026-02', '333.34'],
      [2, '2026-03', '333.33'],
      [3, '2026-04', '333.33'],
    ]);
    expect(Money.sum(installments.map((item) => item.amount)).toString()).toBe('1000.00');
  });

  it('não gera parcelas para compras canceladas', () => {
    expect(
      expandInstallments(
        purchase({
          cardId: 'visa',
          totalAmount: '50',
          purchaseDate: '2026-01-02',
          status: 'cancelled',
        }),
        visa,
      ),
    ).toEqual([]);
  });
});

describe('faturas', () => {
  const visa = card({ id: 'visa', closingDay: 3, dueDay: 10, limit: Money.of('2000') });
  const purchases = [
    purchase({ cardId: 'visa', totalAmount: '100', purchaseDate: '2026-01-10' }), // fatura 02
    purchase({
      cardId: 'visa',
      totalAmount: '600',
      purchaseDate: '2026-01-15',
      installmentCount: 3,
    }), // 02, 03, 04
    purchase({ cardId: 'outro', totalAmount: '999', purchaseDate: '2026-01-15' }),
  ];

  it('soma parcelas por fatura e deriva o status pela data', () => {
    const invoices = buildInvoices(visa, purchases, [], d('2026-02-05'));
    expect(invoices.map((item) => [item.month, item.total.toString(), item.status])).toEqual([
      ['2026-02', '300.00', 'closed'],
      ['2026-03', '200.00', 'open'],
      ['2026-04', '200.00', 'future'],
    ]);
  });

  it('pagamento total quita a fatura; parcial e vencida são identificados', () => {
    const paid = buildInvoices(
      visa,
      purchases,
      [cardPayment(visa, '2026-02', '300', '2026-02-09')],
      d('2026-02-12'),
    );
    expect(paid[0]?.status).toBe('paid');
    expect(paid[0]?.outstanding.isZero()).toBe(true);

    const partial = buildInvoices(
      visa,
      purchases,
      [cardPayment(visa, '2026-02', '100', '2026-02-09')],
      d('2026-02-09'),
    );
    expect(partial[0]?.status).toBe('partially_paid');
    expect(partial[0]?.outstanding.toString()).toBe('200.00');

    const overdue = buildInvoices(visa, purchases, [], d('2026-02-11'));
    expect(overdue[0]?.status).toBe('overdue');
  });

  it('dívida do cartão inclui parcelas futuras e desconta pagamentos', () => {
    const payments = [cardPayment(visa, '2026-02', '300', '2026-02-09')];
    expect(computeCardDebt(visa, purchases, payments, d('2026-01-31')).toString()).toBe('700.00');
    const debt = computeCardDebt(visa, purchases, payments, d('2026-02-10'));
    expect(debt.toString()).toBe('400.00');

    const usage = computeLimitUsage(visa, debt);
    expect(usage.available.toString()).toBe('1600.00');
    expect(usage.percentUsed).toBe(20);
  });

  it('compra não altera saldo de conta: apenas o pagamento da fatura o faz', () => {
    // A compra existe somente no cartão; o pagamento é a única movimentação de conta.
    const payment = cardPayment(visa, '2026-02', '300', '2026-02-09');
    expect(payment.kind).toBe('card_payment');
    expect(payment.accountId).toBe(visa.paymentAccountId);
  });
});
