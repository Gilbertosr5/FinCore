import { computeAccountBalance, computeAccountBalances, sumBalances } from './account-balance';
import { account, brl, d, transfer, tx } from '../../../../../tests/helpers/finance-fixtures';

describe('computeAccountBalance', () => {
  it('parte do saldo inicial e aplica apenas lançamentos liquidados da própria conta', () => {
    const checking = account({ id: 'c1', initialBalance: brl('1000') });
    const transactions = [
      tx({ kind: 'income', accountId: 'c1', amount: '500', competenceDate: d('2026-01-05') }),
      tx({ kind: 'expense', accountId: 'c1', amount: '120.35', competenceDate: d('2026-01-10') }),
      tx({ accountId: 'c1', amount: '80', status: 'pending', competenceDate: d('2026-01-12') }),
      tx({ accountId: 'c1', amount: '99', status: 'cancelled', competenceDate: d('2026-01-12') }),
      tx({ accountId: 'outra', amount: '700', competenceDate: d('2026-01-12') }),
    ];
    expect(computeAccountBalance(checking, transactions, d('2026-01-31')).toString()).toBe(
      '1379.65',
    );
  });

  it('respeita a data de corte (saldo histórico) e a data do saldo inicial', () => {
    const checking = account({ id: 'c1', initialBalance: brl('100') });
    const transactions = [
      tx({ kind: 'income', accountId: 'c1', amount: '50', competenceDate: d('2026-02-01') }),
      // anterior ao saldo inicial: já está refletido nele
      tx({ kind: 'income', accountId: 'c1', amount: '999', competenceDate: d('2025-12-20') }),
    ];
    expect(computeAccountBalance(checking, transactions, d('2026-01-31')).toString()).toBe(
      '100.00',
    );
    expect(computeAccountBalance(checking, transactions, d('2026-02-01')).toString()).toBe(
      '150.00',
    );
    expect(computeAccountBalance(checking, transactions, d('2025-12-31')).isZero()).toBe(true);
  });

  it('transferência move saldo entre contas sem alterar o total', () => {
    const a = account({ id: 'a', initialBalance: brl('1000') });
    const b = account({ id: 'b' });
    const balances = computeAccountBalances(
      [a, b],
      transfer('a', 'b', '300', '2026-01-15'),
      d('2026-01-31'),
    );
    expect(balances.map((item) => item.balance.toString())).toEqual(['700.00', '300.00']);
    expect(sumBalances(balances).toString()).toBe('1000.00');
  });

  it('identifica saldo negativo', () => {
    const checking = account({ id: 'c1', initialBalance: brl('50') });
    const balance = computeAccountBalance(
      checking,
      [tx({ accountId: 'c1', amount: '80.10', competenceDate: d('2026-01-03') })],
      d('2026-01-31'),
    );
    expect(balance.toString()).toBe('-30.10');
    expect(balance.isNegative()).toBe(true);
  });
});
