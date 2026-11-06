import { accountRecordSchema, computeAccountBalances } from '@/features/accounts';
import { budgetRecordSchema } from '@/features/budgets';
import {
  buildInvoices,
  cardPurchaseRecordSchema,
  creditCardRecordSchema,
} from '@/features/credit-cards';
import { goalContributionRecordSchema, goalRecordSchema } from '@/features/goals';
import {
  assetRecordSchema,
  assetValuationRecordSchema,
  investmentMovementRecordSchema,
} from '@/features/investments';
import { categoryRecordSchema, transactionRecordSchema } from '@/features/transactions';
import { addMonthsToKey, asIsoDate, monthEnd, monthKeysBetween, toMonthKey } from '@/lib/dates';
import { Money } from '@/lib/money';
import { parseRecords } from '@/lib/schemas/parse-records';

import { createDemoSeed } from './demo-seed';

function parseSeed(referenceDate: string) {
  const seed = createDemoSeed(referenceDate);
  return {
    seed,
    accounts: parseRecords(accountRecordSchema, seed.accounts, 'accounts'),
    categories: parseRecords(categoryRecordSchema, seed.categories, 'categories'),
    transactions: parseRecords(transactionRecordSchema, seed.transactions, 'transactions'),
    cards: parseRecords(creditCardRecordSchema, seed.creditCards, 'cards'),
    purchases: parseRecords(cardPurchaseRecordSchema, seed.cardPurchases, 'purchases'),
    budgets: parseRecords(budgetRecordSchema, seed.budgets, 'budgets'),
    goals: parseRecords(goalRecordSchema, seed.goals, 'goals'),
    contributions: parseRecords(goalContributionRecordSchema, seed.goalContributions, 'contribs'),
    assets: parseRecords(assetRecordSchema, seed.assets, 'assets'),
    movements: parseRecords(investmentMovementRecordSchema, seed.investmentMovements, 'mov'),
    valuations: parseRecords(assetValuationRecordSchema, seed.assetValuations, 'val'),
  };
}

const REFERENCE_DATES = ['2026-11-06', '2026-02-28', '2027-01-01'];

describe('seed de demonstração', () => {
  it('é determinístico: mesma data de referência gera exatamente os mesmos dados', () => {
    expect(createDemoSeed('2026-11-06')).toEqual(createDemoSeed('2026-11-06'));
  });

  it('o histórico de um mês não depende do dia em que o seed foi gerado', () => {
    const early = parseSeed('2026-11-02');
    const late = parseSeed('2026-11-28');
    const octoberAmounts = (items: typeof early.transactions) =>
      items
        .filter((item) => toMonthKey(item.competenceDate) === '2026-10')
        .map((item) => `${item.description}:${item.amount.toString()}`)
        .sort();
    expect(octoberAmounts(early.transactions)).toEqual(octoberAmounts(late.transactions));
  });

  it.each(REFERENCE_DATES)('todos os registros respeitam os contratos (%s)', (date) => {
    expect(() => parseSeed(date)).not.toThrow();
  });

  it('identificadores são únicos em todas as tabelas', () => {
    const { seed } = parseSeed('2026-11-06');
    for (const records of Object.values(seed)) {
      const ids = records.map((record) => record.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('transferências formam pares de mesmo valor entre contas diferentes', () => {
    const { transactions } = parseSeed('2026-11-06');
    const groups = new Map<string, typeof transactions>();
    for (const item of transactions.filter((tx) => tx.kind === 'transfer')) {
      const id = item.transfer?.id ?? '';
      groups.set(id, [...(groups.get(id) ?? []), item]);
    }
    expect(groups.size).toBeGreaterThan(0);
    for (const pair of groups.values()) {
      expect(pair).toHaveLength(2);
      const [a, b] = pair;
      expect(a?.amount.equals(b?.amount ?? Money.zero())).toBe(true);
      expect(a?.accountId).not.toBe(b?.accountId);
    }
  });

  it.each(REFERENCE_DATES)('faturas vencidas estão integralmente pagas (%s)', (date) => {
    const { cards, purchases, transactions } = parseSeed(date);
    const today = asIsoDate(date);
    for (const card of cards) {
      for (const invoice of buildInvoices(card, purchases, transactions, today)) {
        if (invoice.dueDate < today) expect(invoice.status).toBe('paid');
      }
    }
  });

  it.each(REFERENCE_DATES)('nenhuma conta fica negativa no fim de cada mês (%s)', (date) => {
    const { accounts, transactions } = parseSeed(date);
    const today = asIsoDate(date);
    const current = toMonthKey(today);
    for (const month of monthKeysBetween(addMonthsToKey(current, -12), current)) {
      const asOf = monthEnd(month) < today ? monthEnd(month) : today;
      for (const { account, balance } of computeAccountBalances(accounts, transactions, asOf)) {
        expect(balance.isNegative(), `${account.name} em ${month}: ${balance.toString()}`).toBe(
          false,
        );
      }
    }
  });

  it('contém dados de todos os módulos e lançamentos futuros pendentes', () => {
    const parsed = parseSeed('2026-11-06');
    expect(parsed.accounts.length).toBeGreaterThanOrEqual(3);
    expect(parsed.purchases.some((item) => item.installmentCount > 1)).toBe(true);
    expect(parsed.goals.length).toBeGreaterThan(0);
    expect(parsed.valuations.length).toBeGreaterThan(0);
    expect(parsed.transactions.some((item) => item.status === 'pending')).toBe(true);
    expect(parsed.transactions.some((item) => item.status === 'cancelled')).toBe(true);
    expect(parsed.transactions.some((item) => item.kind === 'card_payment')).toBe(true);
    // Pendentes nunca têm data de pagamento.
    expect(
      parsed.transactions.every((item) => item.status !== 'pending' || item.paidDate === null),
    ).toBe(true);
  });
});
