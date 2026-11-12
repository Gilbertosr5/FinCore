import { asIsoDate } from '@/lib/dates';
import { Money } from '@/lib/money';

import type { EntryInput } from './entry-commands';
import { createInMemoryLedger } from '../../../../tests/helpers/in-memory-ledger';

const d = asIsoDate;
const brl = (value: string) => Money.of(value);
const entry = (overrides: Partial<EntryInput>): EntryInput => ({
  kind: 'expense',
  description: 'Lançamento',
  amount: brl('10'),
  accountId: 'checking',
  categoryId: 'food',
  competenceDate: d('2026-03-05'),
  paidDate: null,
  ...overrides,
});

async function seeded() {
  const env = createInMemoryLedger({ today: '2026-03-10' });
  await env.ledger.createEntry.execute(
    entry({
      description: 'Farmácia São João',
      amount: brl('80'),
      categoryId: 'health',
      competenceDate: d('2026-03-02'),
    }),
  );
  await env.ledger.createEntry.execute(
    entry({
      description: 'Supermercado',
      amount: brl('300'),
      competenceDate: d('2026-03-08'),
      tags: ['casa'],
    }),
  );
  await env.ledger.createEntry.execute(
    entry({
      kind: 'income',
      description: 'Salário',
      amount: brl('5000'),
      categoryId: 'salary',
      competenceDate: d('2026-03-05'),
      paidDate: d('2026-03-05'),
    }),
  );
  const [cancelled = ''] = await env.ledger.createEntry.execute(
    entry({ description: 'Cancelado', amount: brl('999'), competenceDate: d('2026-03-06') }),
  );
  await env.ledger.cancel.execute(cancelled);
  await env.ledger.createTransfer.execute({
    fromAccountId: 'checking',
    toAccountId: 'savings',
    amount: brl('700'),
    date: d('2026-03-07'),
  });
  await env.ledger.createEntry.execute(
    entry({ description: 'Fora do mês', competenceDate: d('2026-04-01') }),
  );
  return env;
}

const march = { start: d('2026-03-01'), end: d('2026-03-31') };

describe('listagem de transações', () => {
  it('filtra pelo período de competência e soma apenas receitas e despesas ativas', async () => {
    const env = await seeded();
    const page = await env.ledger.list.execute(march);
    expect(page.total).toBe(6); // 4 lançamentos + 2 pernas de transferência
    expect(page.totals.income.toString()).toBe('5000.00');
    expect(page.totals.expenses.toString()).toBe('380.00'); // sem cancelado nem transferência
    expect(page.totals.result.toString()).toBe('4620.00');
  });

  it('busca sem acentos e por tags; filtra por tipo, categoria, situação e conta', async () => {
    const env = await seeded();
    const search = (term: string) =>
      env.ledger.list
        .execute({ ...march, search: term })
        .then((p) => p.items.map((i) => i.transaction.description));
    expect(await search('farmacia sao')).toEqual(['Farmácia São João']);
    expect(await search('CASA')).toEqual(['Supermercado']);

    const income = await env.ledger.list.execute({ ...march, kind: 'income' });
    expect(income.items.map((i) => i.transaction.description)).toEqual(['Salário']);
    const health = await env.ledger.list.execute({ ...march, categoryId: 'health' });
    expect(health.total).toBe(1);
    const cancelled = await env.ledger.list.execute({ ...march, status: 'cancelled' });
    expect(cancelled.total).toBe(1);
    const savings = await env.ledger.list.execute({ ...march, accountId: 'savings' });
    expect(savings.items[0]?.counterpartAccountName).toBe('Corrente');
  });

  it('ordena por valor e data; marca vencidas', async () => {
    const env = await seeded();
    const byAmount = await env.ledger.list.execute({
      ...march,
      sort: 'amount_desc',
      kind: 'expense',
    });
    expect(byAmount.items.map((i) => i.transaction.amount.toString())).toEqual([
      '999.00',
      '300.00',
      '80.00',
    ]);
    const byDate = await env.ledger.list.execute({ ...march, sort: 'date_asc', kind: 'expense' });
    expect(byDate.items[0]?.transaction.description).toBe('Farmácia São João');
    expect(byDate.items[0]?.overdue).toBe(true); // pendente, venceu em 02/03
  });

  it('pagina mantendo os totais do conjunto inteiro', async () => {
    const env = await seeded();
    const page2 = await env.ledger.list.execute({ ...march, pageSize: 4, page: 2 });
    expect(page2.items).toHaveLength(2);
    expect(page2.pageCount).toBe(2);
    expect(page2.totals.expenses.toString()).toBe('380.00');
    const beyond = await env.ledger.list.execute({ ...march, pageSize: 4, page: 9 });
    expect(beyond.page).toBe(2);
  });
});

describe('categorias personalizadas', () => {
  it('cria categoria única por tipo (sem diferenciar acentos/maiúsculas)', async () => {
    const env = createInMemoryLedger();
    await env.ledger.createCategory.execute({ name: 'Pets', kind: 'expense', nature: 'variable' });
    await expect(
      env.ledger.createCategory.execute({ name: 'PÉTS', kind: 'expense', nature: 'variable' }),
    ).rejects.toMatchObject({ code: 'duplicate_category' });
    // mesmo nome em outro tipo é permitido
    await expect(
      env.ledger.createCategory.execute({ name: 'Pets', kind: 'income', nature: 'variable' }),
    ).resolves.toMatchObject({ kind: 'income' });
  });

  it('impede excluir ou mudar o tipo de categoria em uso', async () => {
    const env = createInMemoryLedger();
    await env.ledger.createEntry.execute(entry({}));
    await expect(env.ledger.deleteCategory.execute('food')).rejects.toMatchObject({
      code: 'category_in_use',
    });
    await expect(
      env.ledger.updateCategory.execute('food', {
        name: 'Comida',
        kind: 'income',
        nature: 'variable',
      }),
    ).rejects.toMatchObject({ code: 'category_in_use' });
    await env.ledger.updateCategory.execute('food', {
      name: 'Comida',
      kind: 'expense',
      nature: 'fixed',
    });
    expect(env.state.categories.get('food')).toMatchObject({ name: 'Comida', nature: 'fixed' });
  });

  it('considera usos externos (cartões, orçamentos) e exclui quando livre', async () => {
    const env = createInMemoryLedger({ usageCheckers: [(id) => Promise.resolve(id === 'health')] });
    await expect(env.ledger.deleteCategory.execute('health')).rejects.toMatchObject({
      code: 'category_in_use',
    });
    await env.ledger.deleteCategory.execute('food');
    expect(env.state.categories.has('food')).toBe(false);
  });
});
