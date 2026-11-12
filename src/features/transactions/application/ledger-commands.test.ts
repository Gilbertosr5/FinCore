import { asIsoDate } from '@/lib/dates';
import { Money } from '@/lib/money';

import type { EntryInput } from './entry-commands';
import { createInMemoryLedger } from '../../../../tests/helpers/in-memory-ledger';

const d = asIsoDate;
const brl = (value: string) => Money.of(value);

const expense = (overrides: Partial<EntryInput> = {}): EntryInput => ({
  kind: 'expense',
  description: 'Mercado',
  amount: brl('150'),
  accountId: 'checking',
  categoryId: 'food',
  competenceDate: d('2026-03-05'),
  paidDate: null,
  ...overrides,
});

describe('criação de lançamentos', () => {
  it('cria despesa pendente ou paga e registra no histórico', async () => {
    const { ledger, state } = createInMemoryLedger();
    const [pendingId] = await ledger.createEntry.execute(expense());
    const [paidId] = await ledger.createEntry.execute(expense({ paidDate: d('2026-03-05') }));

    expect(state.transactions.get(pendingId ?? '')).toMatchObject({
      status: 'pending',
      paidDate: null,
      dueDate: '2026-03-05',
    });
    expect(state.transactions.get(paidId ?? '')).toMatchObject({
      status: 'paid',
      paidDate: '2026-03-05',
    });
    expect(state.auditLog.filter((entry) => entry.action === 'created')).toHaveLength(2);
  });

  it('normaliza descrição e tags', async () => {
    const { ledger, state } = createInMemoryLedger();
    const [id] = await ledger.createEntry.execute(
      expense({ description: '  Feira   do  sábado ', tags: ['Casa', 'casa', ' mercado '] }),
    );
    expect(state.transactions.get(id ?? '')).toMatchObject({
      description: 'Feira do sábado',
      tags: ['casa', 'mercado'],
    });
  });

  it.each([
    [{ amount: brl('0') }, 'invalid_amount'],
    [{ description: '   ' }, 'invalid_description'],
    [{ paidDate: d('2026-03-11') }, 'paid_in_future'],
    [{ categoryId: 'salary' }, 'category_mismatch'],
    [{ categoryId: 'inexistente' }, 'category_not_found'],
    [{ accountId: 'old' }, 'account_archived'],
    [{ accountId: 'inexistente' }, 'account_not_found'],
  ])('rejeita entrada inválida %o', async (overrides, code) => {
    const { ledger, state } = createInMemoryLedger();
    await expect(ledger.createEntry.execute(expense(overrides))).rejects.toMatchObject({ code });
    expect(state.transactions.size).toBe(0);
  });
});

describe('parcelamento em conta', () => {
  it('divide o total sem perder centavos, mês a mês, ajustando o fim do mês', async () => {
    const { ledger, all } = createInMemoryLedger();
    await ledger.createEntry.execute(
      expense({ amount: brl('1000'), competenceDate: d('2026-01-31'), paidDate: d('2026-01-31') }),
      { type: 'installments', count: 3 },
    );
    const installments = all();
    expect(
      installments.map((tx) => [
        tx.competenceDate,
        tx.amount.toString(),
        tx.installment?.number,
        tx.status,
      ]),
    ).toEqual([
      ['2026-01-31', '333.34', 1, 'paid'],
      ['2026-02-28', '333.33', 2, 'pending'],
      ['2026-03-31', '333.33', 3, 'pending'],
    ]);
    expect(Money.sum(installments.map((tx) => tx.amount)).toString()).toBe('1000.00');
    expect(new Set(installments.map((tx) => tx.installment?.groupId)).size).toBe(1);
  });

  it.each([1, 0, 121, 2.5])('rejeita %s parcelas', async (count) => {
    const { ledger } = createInMemoryLedger();
    await expect(
      ledger.createEntry.execute(expense(), { type: 'installments', count }),
    ).rejects.toMatchObject({ code: 'invalid_installments' });
  });

  it('cancelar "esta e as próximas" mantém as parcelas já pagas', async () => {
    const { ledger, all } = createInMemoryLedger();
    await ledger.createEntry.execute(
      expense({ amount: brl('300'), competenceDate: d('2026-01-10'), paidDate: d('2026-01-10') }),
      { type: 'installments', count: 3 },
    );
    const [first] = all();
    await ledger.cancel.execute(first?.id ?? '', 'following');
    // a 1ª é o alvo e é cancelada; as demais pendentes também
    expect(all().map((tx) => tx.status)).toEqual(['cancelled', 'cancelled', 'cancelled']);

    const second = createInMemoryLedger();
    await second.ledger.createEntry.execute(
      expense({ amount: brl('300'), competenceDate: d('2026-01-10'), paidDate: d('2026-01-10') }),
      { type: 'installments', count: 3 },
    );
    const [, middle] = second.all();
    await second.ledger.cancel.execute(middle?.id ?? '', 'following');
    expect(second.all().map((tx) => tx.status)).toEqual(['paid', 'cancelled', 'cancelled']);
  });
});

describe('recorrências', () => {
  it('gera ocorrências mensais sem derivar o dia, até o fim do mês seguinte', async () => {
    const { ledger, all } = createInMemoryLedger({ today: '2026-03-10' });
    await ledger.createEntry.execute(
      expense({
        description: 'Aluguel',
        competenceDate: d('2026-01-31'),
        paidDate: d('2026-01-31'),
      }),
      { type: 'recurring', frequency: 'monthly', endDate: null },
    );
    expect(all().map((tx) => [tx.competenceDate, tx.status])).toEqual([
      ['2026-01-31', 'paid'],
      ['2026-02-28', 'pending'],
      ['2026-03-31', 'pending'],
      ['2026-04-30', 'pending'],
    ]);
  });

  it.each([
    ['daily', '2026-03-08', ['2026-03-08', '2026-03-09', '2026-03-10']],
    ['weekly', '2026-02-20', ['2026-02-20', '2026-02-27', '2026-03-06']],
    ['biweekly', '2026-02-01', ['2026-02-01', '2026-02-16', '2026-03-03']],
    ['quarterly', '2025-06-15', ['2025-06-15', '2025-09-15', '2025-12-15']],
    ['yearly', '2024-02-29', ['2024-02-29', '2025-02-28', '2026-02-28']],
  ] as const)('frequência %s', async (frequency, start, firstDates) => {
    const { ledger, all } = createInMemoryLedger({ today: '2026-03-10' });
    await ledger.createEntry.execute(expense({ competenceDate: d(start) }), {
      type: 'recurring',
      frequency,
      endDate: d('2026-03-10'),
    });
    expect(
      all()
        .map((tx) => tx.competenceDate)
        .slice(0, 3),
    ).toEqual(firstDates);
  });

  it('respeita a data final e rejeita data final anterior ao início', async () => {
    const { ledger, all } = createInMemoryLedger({ today: '2026-03-10' });
    await ledger.createEntry.execute(expense({ competenceDate: d('2026-01-05') }), {
      type: 'recurring',
      frequency: 'monthly',
      endDate: d('2026-02-05'),
    });
    expect(all()).toHaveLength(2);
    await expect(
      ledger.createEntry.execute(expense({ competenceDate: d('2026-03-05') }), {
        type: 'recurring',
        frequency: 'monthly',
        endDate: d('2026-03-01'),
      }),
    ).rejects.toMatchObject({ code: 'invalid_recurrence' });
  });

  it('o agendador é idempotente e gera novas ocorrências quando o tempo passa', async () => {
    const ledgerEnv = createInMemoryLedger({ today: '2026-03-10' });
    await ledgerEnv.ledger.createEntry.execute(expense({ competenceDate: d('2026-03-05') }), {
      type: 'recurring',
      frequency: 'monthly',
      endDate: null,
    });
    expect(ledgerEnv.all()).toHaveLength(2); // março e abril

    expect(await ledgerEnv.ledger.scheduler.ensure()).toBe(0);
    expect(await ledgerEnv.ledger.scheduler.ensure()).toBe(0);
    expect(ledgerEnv.all()).toHaveLength(2);

    ledgerEnv.setToday('2026-05-02');
    expect(await ledgerEnv.ledger.scheduler.ensure()).toBe(2); // maio e junho
    expect(ledgerEnv.all().map((tx) => tx.competenceDate)).toEqual([
      '2026-03-05',
      '2026-04-05',
      '2026-05-05',
      '2026-06-05',
    ]);
  });

  it('ocorrência excluída não é recriada; "esta e as próximas" encerra a série', async () => {
    const env = createInMemoryLedger({ today: '2026-03-10' });
    await env.ledger.createEntry.execute(expense({ competenceDate: d('2026-01-05') }), {
      type: 'recurring',
      frequency: 'monthly',
      endDate: null,
    });
    const february = env.all().find((tx) => tx.competenceDate === '2026-02-05');
    await env.ledger.remove.execute(february?.id ?? '', 'single');
    env.ledger.scheduler.invalidate();
    await env.ledger.scheduler.ensure();
    expect(env.all().map((tx) => tx.competenceDate)).toEqual([
      '2026-01-05',
      '2026-03-05',
      '2026-04-05',
    ]);

    const march = env.all().find((tx) => tx.competenceDate === '2026-03-05');
    await env.ledger.remove.execute(march?.id ?? '', 'following');
    env.setToday('2026-08-01');
    await env.ledger.scheduler.ensure();
    expect(env.all().map((tx) => tx.competenceDate)).toEqual(['2026-01-05']);
    expect([...env.state.recurrences.values()][0]?.endDate).toBe('2026-03-04');
  });

  it('editar "esta e as próximas" altera pendentes e o modelo, preservando as pagas', async () => {
    const env = createInMemoryLedger({ today: '2026-03-10' });
    await env.ledger.createEntry.execute(
      expense({ description: 'Academia', amount: brl('100'), competenceDate: d('2026-01-10') }),
      { type: 'recurring', frequency: 'monthly', endDate: null },
    );
    const [january, february] = env.all();
    await env.ledger.markAsPaid.execute(january?.id ?? '', d('2026-01-10'));

    await env.ledger.updateEntry.execute(
      february?.id ?? '',
      expense({ description: 'Academia', amount: brl('120'), competenceDate: d('2026-02-10') }),
      'following',
    );
    expect(env.all().map((tx) => tx.amount.toString())).toEqual([
      '100.00',
      '120.00',
      '120.00',
      '120.00',
    ]);
    expect([...env.state.recurrences.values()][0]?.template.amount.toString()).toBe('120.00');

    env.setToday('2026-04-15');
    await env.ledger.scheduler.ensure();
    expect(env.all().at(-1)?.amount.toString()).toBe('120.00');
  });
});

describe('transferências', () => {
  it('gera duas pernas de mesmo valor e não altera o patrimônio total', async () => {
    const env = createInMemoryLedger();
    await env.ledger.createTransfer.execute({
      fromAccountId: 'checking',
      toAccountId: 'savings',
      amount: brl('400'),
      date: d('2026-03-01'),
    });
    const legs = env.all();
    expect(legs.map((tx) => [tx.accountId, tx.transfer?.direction, tx.status])).toEqual([
      ['checking', 'out', 'paid'],
      ['savings', 'in', 'paid'],
    ]);
    const accounts = await env.accounts.list.execute();
    const balances = Object.fromEntries(
      accounts.map((item) => [item.account.id, item.balance.toString()]),
    );
    expect(balances).toMatchObject({ checking: '600.00', savings: '400.00' });
  });

  it('transferência futura fica agendada; pagar ou cancelar afeta as duas pernas', async () => {
    const env = createInMemoryLedger();
    const transferId = await env.ledger.createTransfer.execute({
      fromAccountId: 'checking',
      toAccountId: 'savings',
      amount: brl('50'),
      date: d('2026-03-20'),
    });
    expect(env.all().map((tx) => tx.status)).toEqual(['pending', 'pending']);
    await env.ledger.markAsPaid.execute(`${transferId}_in`, d('2026-03-10'));
    expect(env.all().map((tx) => tx.status)).toEqual(['paid', 'paid']);
    await env.ledger.cancel.execute(`${transferId}_out`);
    expect(env.all().map((tx) => tx.status)).toEqual(['cancelled', 'cancelled']);
  });

  it('valida contas e permite editar a transferência inteira', async () => {
    const env = createInMemoryLedger();
    await expect(
      env.ledger.createTransfer.execute({
        fromAccountId: 'checking',
        toAccountId: 'checking',
        amount: brl('10'),
        date: d('2026-03-01'),
      }),
    ).rejects.toMatchObject({ code: 'same_account_transfer' });

    const id = await env.ledger.createTransfer.execute({
      fromAccountId: 'checking',
      toAccountId: 'savings',
      amount: brl('10'),
      date: d('2026-03-01'),
    });
    await env.ledger.updateTransfer.execute(id, {
      fromAccountId: 'savings',
      toAccountId: 'checking',
      amount: brl('25'),
      date: d('2026-03-02'),
    });
    expect(
      env.all().map((tx) => [tx.accountId, tx.transfer?.direction, tx.amount.toString()]),
    ).toEqual([
      ['savings', 'out', '25.00'],
      ['checking', 'in', '25.00'],
    ]);
  });
});

describe('situação dos lançamentos', () => {
  it('marca como pago, desfaz e reativa cancelados', async () => {
    const env = createInMemoryLedger();
    const [id = ''] = await env.ledger.createEntry.execute(expense());
    await expect(env.ledger.markAsPaid.execute(id, d('2026-04-01'))).rejects.toMatchObject({
      code: 'paid_in_future',
    });
    await env.ledger.markAsPaid.execute(id, d('2026-03-06'));
    expect(env.state.transactions.get(id)).toMatchObject({
      status: 'paid',
      paidDate: '2026-03-06',
    });

    await env.ledger.cancel.execute(id);
    await expect(env.ledger.markAsPaid.execute(id, d('2026-03-06'))).rejects.toMatchObject({
      code: 'invalid_status_change',
    });
    await env.ledger.markAsPending.execute(id);
    expect(env.state.transactions.get(id)).toMatchObject({ status: 'pending', paidDate: null });
    expect(env.state.auditLog.map((entry) => entry.action)).toEqual([
      'created',
      'paid',
      'cancelled',
      'restored',
    ]);
  });

  it('cancelado deixa de afetar saldo e resultado', async () => {
    const env = createInMemoryLedger();
    const [id = ''] = await env.ledger.createEntry.execute(
      expense({ amount: brl('200'), paidDate: d('2026-03-05') }),
    );
    const before = await env.accounts.list.execute();
    expect(before.find((item) => item.account.id === 'checking')?.balance.toString()).toBe(
      '800.00',
    );
    await env.ledger.cancel.execute(id);
    const after = await env.accounts.list.execute();
    expect(after.find((item) => item.account.id === 'checking')?.balance.toString()).toBe(
      '1000.00',
    );
  });

  it('pagamentos de fatura e aplicações não são editáveis por este módulo', async () => {
    const env = createInMemoryLedger({
      transactions: [
        {
          id: 'pay',
          kind: 'card_payment',
          description: 'Fatura',
          amount: brl('10'),
          accountId: 'checking',
          categoryId: null,
          competenceDate: d('2026-03-01'),
          dueDate: d('2026-03-01'),
          paidDate: d('2026-03-01'),
          status: 'paid',
          transfer: null,
          cardPayment: { cardId: 'c', invoiceMonth: '2026-03' as never },
          investment: null,
          recurrenceId: null,
          installment: null,
          tags: [],
          notes: null,
        },
      ],
    });
    await expect(env.ledger.remove.execute('pay')).rejects.toMatchObject({ code: 'not_editable' });
  });
});
