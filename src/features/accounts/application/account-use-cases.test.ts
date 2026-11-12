import { asIsoDate } from '@/lib/dates';
import { Money } from '@/lib/money';

import { createInMemoryLedger } from '../../../../tests/helpers/in-memory-ledger';

const d = asIsoDate;
const brl = (value: string) => Money.of(value);

describe('contas', () => {
  it('cria, edita, arquiva e restaura com histórico', async () => {
    const env = createInMemoryLedger();
    const account = await env.accounts.create.execute({
      name: '  Carteira   digital ',
      type: 'digital_wallet',
      institution: '  ',
      initialBalance: brl('-50'),
      initialBalanceDate: d('2026-03-01'),
    });
    expect(account).toMatchObject({ name: 'Carteira digital', institution: null, archived: false });

    await env.accounts.update.execute(account.id, {
      name: 'Carteira',
      type: 'digital_wallet',
      institution: 'App',
      initialBalance: brl('20'),
      initialBalanceDate: d('2026-03-01'),
    });
    await env.accounts.setArchived.execute(account.id, true);
    expect(env.state.accounts.get(account.id)).toMatchObject({ name: 'Carteira', archived: true });
    await env.accounts.setArchived.execute(account.id, false);

    const actions = env.state.auditLog
      .filter((e) => e.entityId === account.id)
      .map((e) => e.action);
    expect(actions).toEqual(['created', 'updated', 'archived', 'restored']);
  });

  it('valida o nome', async () => {
    const env = createInMemoryLedger();
    await expect(
      env.accounts.create.execute({
        name: 'X',
        type: 'checking',
        institution: null,
        initialBalance: brl('0'),
        initialBalanceDate: d('2026-03-01'),
      }),
    ).rejects.toMatchObject({ code: 'invalid_name' });
  });

  it('lista saldos atuais, pendentes e saldo previsto; identifica negativos', async () => {
    const env = createInMemoryLedger({ today: '2026-03-10' });
    await env.ledger.createEntry.execute({
      kind: 'expense',
      description: 'Aluguel',
      amount: brl('1500'),
      accountId: 'checking',
      categoryId: 'food',
      competenceDate: d('2026-03-08'),
      paidDate: d('2026-03-08'),
    });
    await env.ledger.createEntry.execute({
      kind: 'income',
      description: 'Freela',
      amount: brl('300'),
      accountId: 'checking',
      categoryId: 'salary',
      competenceDate: d('2026-03-20'),
      paidDate: null,
    });
    const checking = (await env.accounts.list.execute()).find(
      (item) => item.account.id === 'checking',
    );
    expect(checking?.balance.toString()).toBe('-500.00');
    expect(checking?.balance.isNegative()).toBe(true);
    expect(checking?.pendingIn.toString()).toBe('300.00');
    expect(checking?.projectedBalance.toString()).toBe('-200.00');
  });
});

describe('extrato da conta', () => {
  it('saldo de abertura, lançamentos liquidados com saldo acumulado e pendentes à parte', async () => {
    const env = createInMemoryLedger({ today: '2026-03-10' });
    const base = { accountId: 'checking', categoryId: 'food', kind: 'expense' as const };
    await env.ledger.createEntry.execute({
      ...base,
      description: 'Fevereiro',
      amount: brl('100'),
      competenceDate: d('2026-02-20'),
      paidDate: d('2026-02-20'),
    });
    await env.ledger.createEntry.execute({
      ...base,
      kind: 'income',
      categoryId: 'salary',
      description: 'Salário',
      amount: brl('2000'),
      competenceDate: d('2026-03-05'),
      paidDate: d('2026-03-05'),
    });
    await env.ledger.createEntry.execute({
      ...base,
      description: 'Mercado',
      amount: brl('250.50'),
      competenceDate: d('2026-03-06'),
      paidDate: d('2026-03-07'),
    });
    await env.ledger.createEntry.execute({
      ...base,
      description: 'Conta futura',
      amount: brl('90'),
      competenceDate: d('2026-03-25'),
      paidDate: null,
    });
    await env.ledger.createTransfer.execute({
      fromAccountId: 'checking',
      toAccountId: 'savings',
      amount: brl('500'),
      date: d('2026-03-08'),
    });

    const statement = await env.accounts.statement.execute(
      'checking',
      d('2026-03-01'),
      d('2026-03-31'),
    );
    expect(statement.openingBalance.toString()).toBe('900.00');
    expect(
      statement.lines.map((line) => [
        line.transaction.description,
        line.effect.toString(),
        line.balance.toString(),
      ]),
    ).toEqual([
      ['Salário', '2000.00', '2900.00'],
      ['Mercado', '-250.50', '2649.50'],
      ['Transferência entre contas', '-500.00', '2149.50'],
    ]);
    expect(statement.closingBalance.toString()).toBe('2149.50');
    expect(statement.totalIn.toString()).toBe('2000.00');
    expect(statement.totalOut.toString()).toBe('750.50');
    expect(statement.pending.map((tx) => tx.description)).toEqual(['Conta futura']);

    // O saldo de fechamento coincide com o saldo atual da conta.
    const checking = (await env.accounts.list.execute()).find(
      (item) => item.account.id === 'checking',
    );
    expect(checking?.balance.toString()).toBe(statement.closingBalance.toString());
  });
});
