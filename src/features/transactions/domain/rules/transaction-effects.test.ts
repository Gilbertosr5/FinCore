import {
  countsAsExpense,
  countsAsIncome,
  getAccountEffect,
  getTransactionDisplayDate,
} from './transaction-effects';
import { d, m, transfer, tx } from '../../../../../tests/helpers/finance-fixtures';

const today = d('2026-03-31');

describe('efeito no saldo da conta', () => {
  it('receita soma e despesa subtrai quando liquidadas', () => {
    expect(
      getAccountEffect(tx({ kind: 'income', accountId: 'a', amount: '100' }), today).toString(),
    ).toBe('100.00');
    expect(
      getAccountEffect(tx({ kind: 'expense', accountId: 'a', amount: '40.5' }), today).toString(),
    ).toBe('-40.50');
  });

  it('pendentes, canceladas e liquidadas depois da data não afetam o saldo', () => {
    expect(
      getAccountEffect(tx({ accountId: 'a', amount: '10', status: 'pending' }), today).isZero(),
    ).toBe(true);
    expect(
      getAccountEffect(tx({ accountId: 'a', amount: '10', status: 'cancelled' }), today).isZero(),
    ).toBe(true);
    const future = tx({ accountId: 'a', amount: '10', competenceDate: d('2026-04-01') });
    expect(getAccountEffect(future, today).isZero()).toBe(true);
  });

  it('transferência: a soma das duas pernas é zero (sem criar nem destruir dinheiro)', () => {
    const [out, inn] = transfer('a', 'b', '250', '2026-03-10');
    if (!out || !inn) throw new Error('par inválido');
    const total = getAccountEffect(out, today).add(getAccountEffect(inn, today));
    expect(getAccountEffect(out, today).toString()).toBe('-250.00');
    expect(total.isZero()).toBe(true);
  });

  it('pagamento de fatura reduz o saldo; aplicação reduz e resgate aumenta', () => {
    const payment = tx({
      kind: 'card_payment',
      accountId: 'a',
      amount: '900',
      cardPayment: { cardId: 'c', invoiceMonth: m('2026-03') },
    });
    expect(getAccountEffect(payment, today).toString()).toBe('-900.00');
    const application = tx({
      kind: 'investment',
      accountId: 'a',
      amount: '300',
      investment: { assetId: 'x', direction: 'application' },
    });
    const redemption = tx({
      kind: 'investment',
      accountId: 'a',
      amount: '120',
      investment: { assetId: 'x', direction: 'redemption' },
    });
    expect(getAccountEffect(application, today).toString()).toBe('-300.00');
    expect(getAccountEffect(redemption, today).toString()).toBe('120.00');
  });
});

describe('contabilização no resultado', () => {
  it('somente receitas e despesas ativas entram no resultado', () => {
    expect(countsAsIncome(tx({ kind: 'income', accountId: 'a', amount: '1' }))).toBe(true);
    expect(countsAsExpense(tx({ kind: 'expense', accountId: 'a', amount: '1' }))).toBe(true);
    expect(
      countsAsExpense(tx({ kind: 'expense', accountId: 'a', amount: '1', status: 'pending' })),
    ).toBe(true);
    expect(
      countsAsExpense(tx({ kind: 'expense', accountId: 'a', amount: '1', status: 'cancelled' })),
    ).toBe(false);
  });

  it('transferências, pagamentos de fatura e investimentos nunca são receita nem despesa', () => {
    const items = [
      ...transfer('a', 'b', '10', '2026-03-01'),
      tx({
        kind: 'card_payment',
        accountId: 'a',
        amount: '1',
        cardPayment: { cardId: 'c', invoiceMonth: m('2026-03') },
      }),
      tx({
        kind: 'investment',
        accountId: 'a',
        amount: '1',
        investment: { assetId: 'x', direction: 'application' },
      }),
    ];
    for (const item of items) {
      expect(countsAsIncome(item)).toBe(false);
      expect(countsAsExpense(item)).toBe(false);
    }
  });

  it('data de exibição prioriza pagamento, depois vencimento e competência', () => {
    const pending = tx({
      accountId: 'a',
      amount: '1',
      status: 'pending',
      competenceDate: d('2026-03-01'),
      dueDate: d('2026-03-15'),
    });
    expect(getTransactionDisplayDate(pending)).toBe('2026-03-15');
  });
});
