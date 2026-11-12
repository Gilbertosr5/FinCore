import { Decimal } from 'decimal.js';

import { accountToRecord, type Account } from '@/features/accounts';
import { budgetToRecord, type Budget } from '@/features/budgets';
import {
  buildInvoices,
  cardPurchaseToRecord,
  creditCardToRecord,
  type CardPurchase,
  type CreditCard,
} from '@/features/credit-cards';
import {
  goalContributionToRecord,
  goalToRecord,
  type Goal,
  type GoalContribution,
} from '@/features/goals';
import {
  assetValuationToRecord,
  investmentMovementToRecord,
  type Asset,
  type AssetClass,
  type AssetValuation,
  type InvestmentMovement,
} from '@/features/investments';
import {
  recurrenceToRecord,
  transactionToRecord,
  type Category,
  type Recurrence,
  type Transaction,
} from '@/features/transactions';
import {
  addMonthsToKey,
  asIsoDate,
  dayOfMonth,
  formatMonthShort,
  getDateParts,
  monthEnd,
  monthKeysBetween,
  monthStart,
  toMonthKey,
  type IsoDate,
  type MonthKey,
} from '@/lib/dates';
import { Money } from '@/lib/money';
import type { DemoRecord, DemoSeedData, DemoSeedFactory } from '@/services/storage/demo-data-store';

import { SeededRandom } from './seeded-random';

/**
 * DADOS DE DEMONSTRAÇÃO — pessoa fictícia, valores fictícios.
 *
 * Cenário: 12 meses de histórico até a data de referência + contas fixas do mês
 * seguinte (pendentes). Determinístico: a mesma data de referência gera sempre
 * os mesmos dados (gerador pseudoaleatório com semente = mês de referência).
 * Todas as sorteadas ocorrem antes de qualquer filtro por data, para que o
 * conteúdo de um mês não dependa do dia em que o seed foi gerado.
 *
 * Coerência garantida pelo próprio domínio:
 * - transferências geram pares saída/entrada de mesmo valor;
 * - aplicações em investimentos saem da conta da corretora e entram na carteira;
 * - faturas são pagas com o total calculado pelas regras de cartão;
 * - aportes em metas acompanham transferências para a poupança.
 */
/** v2 (Fase 4): inclui recorrências, que geram automaticamente as próximas ocorrências. */
export const DEMO_SEED_VERSION = 2;

const ACC = {
  checking: 'acc-corrente',
  savings: 'acc-poupanca',
  cash: 'acc-carteira',
  broker: 'acc-investimentos',
} as const;

const CAT = {
  salary: 'cat-salario',
  freelance: 'cat-freelance',
  yields: 'cat-rendimentos',
  bonus: 'cat-bonificacoes',
  housing: 'cat-moradia',
  food: 'cat-alimentacao',
  transport: 'cat-transporte',
  health: 'cat-saude',
  education: 'cat-educacao',
  leisure: 'cat-lazer',
  subscriptions: 'cat-assinaturas',
  shopping: 'cat-compras',
  taxes: 'cat-impostos',
  other: 'cat-outros',
} as const;

const CARD = { nubank: 'card-roxinho', itau: 'card-azul' } as const;

const ASSET = {
  cdb: 'asset-cdb-inter',
  treasury: 'asset-tesouro-selic',
  itsa: 'asset-itsa4',
  hglg: 'asset-hglg11',
  ivvb: 'asset-ivvb11',
  btc: 'asset-btc',
} as const;

const GOAL = { emergency: 'goal-reserva', travel: 'goal-viagem', car: 'goal-carro' } as const;

const brl = (value: string) => Money.of(value);

const CATEGORIES: Category[] = [
  { id: CAT.salary, name: 'Salário', kind: 'income', nature: 'fixed' },
  { id: CAT.freelance, name: 'Freelances', kind: 'income', nature: 'variable' },
  { id: CAT.yields, name: 'Rendimentos', kind: 'income', nature: 'variable' },
  { id: CAT.bonus, name: 'Bonificações', kind: 'income', nature: 'variable' },
  { id: CAT.housing, name: 'Moradia', kind: 'expense', nature: 'fixed' },
  { id: CAT.food, name: 'Alimentação', kind: 'expense', nature: 'variable' },
  { id: CAT.transport, name: 'Transporte', kind: 'expense', nature: 'variable' },
  { id: CAT.health, name: 'Saúde', kind: 'expense', nature: 'fixed' },
  { id: CAT.education, name: 'Educação', kind: 'expense', nature: 'fixed' },
  { id: CAT.leisure, name: 'Lazer', kind: 'expense', nature: 'variable' },
  { id: CAT.subscriptions, name: 'Assinaturas', kind: 'expense', nature: 'fixed' },
  { id: CAT.shopping, name: 'Compras', kind: 'expense', nature: 'variable' },
  { id: CAT.taxes, name: 'Impostos', kind: 'expense', nature: 'fixed' },
  { id: CAT.other, name: 'Outros', kind: 'expense', nature: 'variable' },
];

const CARDS: CreditCard[] = [
  {
    id: CARD.nubank,
    name: 'Roxinho Platinum',
    institution: 'Nubank',
    brand: 'mastercard',
    limit: brl('12000'),
    closingDay: 3,
    dueDay: 10,
    paymentAccountId: ACC.checking,
    status: 'active',
  },
  {
    id: CARD.itau,
    name: 'Azul Visa Gold',
    institution: 'Itaú',
    brand: 'visa',
    limit: brl('6000'),
    closingDay: 25,
    dueDay: 5,
    paymentAccountId: ACC.checking,
    status: 'active',
  },
];

const ASSETS: Asset[] = [
  {
    id: ASSET.cdb,
    name: 'CDB Banco Inter 110% CDI',
    ticker: null,
    assetClass: 'cdb',
    institution: 'Banco Inter',
    notes: 'Liquidez diária',
  },
  {
    id: ASSET.treasury,
    name: 'Tesouro Selic 2029',
    ticker: null,
    assetClass: 'treasury',
    institution: 'XP Investimentos',
    notes: 'Valor estimado pela taxa contratada',
  },
  {
    id: ASSET.itsa,
    name: 'Itaúsa',
    ticker: 'ITSA4',
    assetClass: 'stocks',
    institution: 'XP Investimentos',
    notes: null,
  },
  {
    id: ASSET.hglg,
    name: 'CSHG Logística FII',
    ticker: 'HGLG11',
    assetClass: 'reits',
    institution: 'XP Investimentos',
    notes: null,
  },
  {
    id: ASSET.ivvb,
    name: 'iShares S&P 500',
    ticker: 'IVVB11',
    assetClass: 'etf',
    institution: 'XP Investimentos',
    notes: null,
  },
  {
    id: ASSET.btc,
    name: 'Bitcoin',
    ticker: 'BTC',
    assetClass: 'crypto',
    institution: 'Mercado Bitcoin',
    notes: null,
  },
];

/** Variação mensal sorteada por classe, em pontos-base (1/10000). */
const MONTHLY_RETURN_BP: Record<AssetClass, [number, number]> = {
  cdb: [80, 92],
  treasury: [78, 88],
  fixed_income: [75, 90],
  lci: [70, 80],
  lca: [70, 80],
  stocks: [-500, 620],
  reits: [-300, 360],
  etf: [-420, 520],
  funds: [-150, 200],
  crypto: [-1500, 1800],
  other: [-100, 150],
};

export function createDemoSeed(referenceDate: string): DemoSeedData {
  const today = asIsoDate(referenceDate);
  const currentMonth = toMonthKey(today);
  const firstMonth = addMonthsToKey(currentMonth, -12);
  const startDate = monthStart(firstMonth);
  const rng = new SeededRandom(`fincore-demo:${currentMonth}`);

  let sequence = 0;
  const nextId = (prefix: string) => `${prefix}-${String(++sequence).padStart(5, '0')}`;

  const transactions: Transaction[] = [];
  const purchases: CardPurchase[] = [];
  const movements: InvestmentMovement[] = [];
  const contributions: GoalContribution[] = [];

  const settlement = (date: IsoDate) =>
    date <= today
      ? { status: 'paid' as const, paidDate: date }
      : { status: 'pending' as const, paidDate: null };

  const baseTransaction = {
    transfer: null,
    cardPayment: null,
    investment: null,
    recurrenceId: null,
    installment: null,
    tags: [],
    notes: null,
  };

  const addEntry = (
    kind: 'income' | 'expense',
    accountId: string,
    description: string,
    amount: Money,
    date: IsoDate,
    categoryId: string,
    extra: Partial<Pick<Transaction, 'recurrenceId' | 'tags' | 'status' | 'notes'>> = {},
  ) => {
    const settled = settlement(date);
    const cancelled = extra.status === 'cancelled';
    transactions.push({
      ...baseTransaction,
      id: nextId('tx'),
      kind,
      description,
      amount,
      accountId,
      categoryId,
      competenceDate: date,
      dueDate: date,
      ...(cancelled ? { status: 'cancelled' as const, paidDate: null } : settled),
      recurrenceId: extra.recurrenceId ?? null,
      tags: extra.tags ?? [],
      notes: extra.notes ?? null,
    });
  };

  /** Gastos/receitas variáveis só existem se já aconteceram (o futuro é desconhecido). */
  const addPastEntry = (...args: Parameters<typeof addEntry>) => {
    if (args[4] <= today) addEntry(...args);
  };

  const addTransfer = (
    from: string,
    to: string,
    amount: Money,
    date: IsoDate,
    description: string,
  ) => {
    if (date > today) return;
    const transferId = nextId('trf');
    for (const [accountId, direction, counterpart] of [
      [from, 'out', to],
      [to, 'in', from],
    ] as const) {
      transactions.push({
        ...baseTransaction,
        id: `${transferId}-${direction}`,
        kind: 'transfer',
        description,
        amount,
        accountId,
        categoryId: null,
        competenceDate: date,
        dueDate: null,
        status: 'paid',
        paidDate: date,
        transfer: { id: transferId, direction, counterpartAccountId: counterpart },
      });
    }
  };

  const addApplication = (
    assetId: string,
    amount: Money,
    date: IsoDate,
    quantity: string | null,
  ) => {
    if (date > today) return;
    const movementId = nextId('mov');
    movements.push({
      id: movementId,
      assetId,
      type: quantity ? 'buy' : 'contribution',
      date,
      quantity,
      transactionId: `${movementId}-tx`,
      amount,
    });
    const asset = ASSETS.find((item) => item.id === assetId);
    transactions.push({
      ...baseTransaction,
      id: `${movementId}-tx`,
      kind: 'investment',
      description: `Aplicação — ${asset?.ticker ?? asset?.name ?? assetId}`,
      amount,
      accountId: ACC.broker,
      categoryId: null,
      competenceDate: date,
      dueDate: null,
      status: 'paid',
      paidDate: date,
      investment: { assetId, direction: 'application' },
    });
  };

  const addDividend = (assetId: string, amount: Money, date: IsoDate) => {
    if (date > today) return;
    const asset = ASSETS.find((item) => item.id === assetId);
    movements.push({
      id: nextId('mov'),
      assetId,
      type: 'dividend',
      date,
      quantity: null,
      amount,
      transactionId: null,
    });
    addEntry(
      'income',
      ACC.broker,
      `Proventos ${asset?.ticker ?? ''}`.trim(),
      amount,
      date,
      CAT.yields,
    );
  };

  const addPurchase = (
    cardId: string,
    description: string,
    amount: Money,
    date: IsoDate,
    categoryId: string,
    installmentCount = 1,
  ) => {
    if (date > today) return;
    purchases.push({
      id: nextId('cp'),
      cardId,
      description,
      categoryId,
      totalAmount: amount,
      purchaseDate: date,
      installmentCount,
      status: 'active',
    });
  };

  const addContribution = (goalId: string, amount: Money, date: IsoDate) => {
    if (date > today) return;
    contributions.push({
      id: nextId('gc'),
      goalId,
      date,
      amount,
      type: 'deposit',
      transferId: null,
    });
  };

  // Saldo inicial da poupança corresponde à reserva já acumulada.
  addContribution(GOAL.emergency, brl('12000'), startDate);
  // Saldo inicial da corretora aplicado no CDB no primeiro dia.
  addApplication(ASSET.cdb, brl('5000'), startDate, null);

  const months = monthKeysBetween(firstMonth, addMonthsToKey(currentMonth, 1));
  months.forEach((month, index) => {
    const day = (value: number) => dayOfMonth(month, value);
    const isNextMonth = month > currentMonth;
    const { month: monthNumber } = getDateParts(monthStart(month));

    // Receitas e contas fixas (no mês seguinte entram como pendentes).
    addEntry(
      'income',
      ACC.checking,
      'Salário — Empresa Exemplo Ltda.',
      brl(index < 7 ? '7800' : '8400'),
      day(5),
      CAT.salary,
      { recurrenceId: 'rec-salario' },
    );
    addEntry('expense', ACC.checking, 'Aluguel', brl('2200'), day(10), CAT.housing, {
      recurrenceId: 'rec-aluguel',
    });
    addEntry('expense', ACC.checking, 'Condomínio', brl('650'), day(10), CAT.housing, {
      recurrenceId: 'rec-condominio',
    });
    addEntry('expense', ACC.checking, 'Plano de saúde', brl('480'), day(8), CAT.health, {
      recurrenceId: 'rec-saude',
    });
    addEntry('expense', ACC.checking, 'Curso de inglês', brl('390'), day(12), CAT.education, {
      recurrenceId: 'rec-ingles',
    });
    addEntry('expense', ACC.checking, 'Internet fibra', brl('119.90'), day(20), CAT.housing, {
      recurrenceId: 'rec-internet',
    });
    const energy = rng.money(160, 290);
    addEntry('expense', ACC.checking, 'Conta de energia', energy, day(15), CAT.housing, {
      recurrenceId: 'rec-energia',
    });
    if (isNextMonth) return;

    // Valores variáveis: sorteados sempre, incluídos apenas se já ocorreram.
    const draws = {
      supermarket: rng.money(280, 520),
      market: rng.money(80, 140),
      pharmacyChance: rng.chance(0.5),
      pharmacy: rng.money(40, 160),
      freelanceChance: rng.chance(0.3),
      freelance: rng.money(800, 2200),
      bakery: [rng.money(25, 60), rng.money(25, 60), rng.money(25, 60)],
      savingsYield: rng.money(65, 95),
      itsaDividend: rng.money(10, 35),
      hglgDividend: rng.money(15, 60),
      nuMarket1: rng.money(180, 420),
      nuMarket2: rng.money(180, 420),
      restaurants: [rng.money(60, 180), rng.money(60, 180), rng.money(60, 180)],
      rides: [rng.money(18, 45), rng.money(18, 45), rng.money(18, 45), rng.money(18, 45)],
      fuel: [rng.money(180, 260), rng.money(180, 260)],
      leisureChance: rng.chance(0.7),
      leisure: rng.money(60, 150),
      onlineChance: rng.chance(0.6),
      online: rng.money(80, 350),
      itauPharmacyChance: rng.chance(0.6),
      itauPharmacy: rng.money(35, 120),
      clothesChance: rng.chance(0.35),
      clothes: rng.money(150, 450),
    };

    addPastEntry('expense', ACC.checking, 'Supermercado', draws.supermarket, day(13), CAT.food);
    addPastEntry('expense', ACC.cash, 'Feira', draws.market, day(6), CAT.food);
    [11, 19, 26].forEach((d, i) => {
      addPastEntry(
        'expense',
        ACC.cash,
        'Padaria e café',
        draws.bakery[i] ?? Money.zero(),
        day(d),
        CAT.food,
      );
    });
    if (draws.pharmacyChance)
      addPastEntry('expense', ACC.checking, 'Farmácia', draws.pharmacy, day(22), CAT.health);
    if (draws.freelanceChance)
      addPastEntry(
        'income',
        ACC.checking,
        'Projeto freelance',
        draws.freelance,
        day(18),
        CAT.freelance,
      );
    if (index > 0)
      addPastEntry(
        'income',
        ACC.savings,
        'Rendimento da poupança',
        draws.savingsYield,
        day(1),
        CAT.yields,
      );
    if (monthNumber === 1)
      addPastEntry('expense', ACC.checking, 'IPVA', brl('1850'), day(20), CAT.taxes);
    if (monthNumber === 12)
      addPastEntry('income', ACC.checking, 'Bonificação anual', brl('4500'), day(20), CAT.bonus);
    if (index === 9) {
      addPastEntry('expense', ACC.checking, 'Seguro viagem', brl('189'), day(16), CAT.other, {
        status: 'cancelled',
        notes: 'Cancelado: viagem adiada',
      });
    }

    // Transferências e metas (aportes não são receita).
    addTransfer(ACC.checking, ACC.cash, brl('250'), day(2), 'Saque para a carteira');
    const savingsTransfer = index >= 6 ? brl('1100') : brl('600');
    addTransfer(ACC.checking, ACC.savings, savingsTransfer, day(6), 'Transferência para poupança');
    addContribution(GOAL.emergency, brl('600'), day(6));
    if (index >= 6) addContribution(GOAL.travel, brl('500'), day(6));
    addTransfer(ACC.checking, ACC.broker, brl('700'), day(6), 'Transferência para a corretora');

    // Investimentos (aplicações a partir da conta da corretora).
    addApplication(ASSET.treasury, brl('300'), day(7), null);
    if (index % 2 === 1) addApplication(ASSET.itsa, brl('300'), day(7), '30');
    if (index % 3 === 1) addApplication(ASSET.hglg, brl('250'), day(7), '2');
    if (index === 2 || index === 8) addApplication(ASSET.btc, brl('400'), day(9), '0.0011');
    if (index === 5 || index === 11) addApplication(ASSET.ivvb, brl('500'), day(9), '1');
    if (index > 1) addDividend(ASSET.itsa, draws.itsaDividend, day(15));
    if (index > 1) addDividend(ASSET.hglg, draws.hglgDividend, day(15));

    // Cartões.
    addPurchase(CARD.nubank, 'Supermercado Pão de Mel', draws.nuMarket1, day(4), CAT.food);
    addPurchase(CARD.nubank, 'Supermercado Pão de Mel', draws.nuMarket2, day(19), CAT.food);
    [9, 16, 27].forEach((d, i) => {
      addPurchase(
        CARD.nubank,
        'Restaurante',
        draws.restaurants[i] ?? Money.zero(),
        day(d),
        CAT.food,
      );
    });
    [3, 11, 17, 25].forEach((d, i) => {
      addPurchase(
        CARD.nubank,
        'Corrida por aplicativo',
        draws.rides[i] ?? Money.zero(),
        day(d),
        CAT.transport,
      );
    });
    [8, 22].forEach((d, i) => {
      addPurchase(
        CARD.nubank,
        'Posto de combustível',
        draws.fuel[i] ?? Money.zero(),
        day(d),
        CAT.transport,
      );
    });
    addPurchase(CARD.nubank, 'Streaming de vídeo', brl('55.90'), day(7), CAT.subscriptions);
    addPurchase(CARD.nubank, 'Streaming de música', brl('21.90'), day(12), CAT.subscriptions);
    if (draws.leisureChance)
      addPurchase(CARD.nubank, 'Cinema e lazer', draws.leisure, day(14), CAT.leisure);
    if (draws.onlineChance)
      addPurchase(CARD.nubank, 'Compra online', draws.online, day(21), CAT.shopping);
    addPurchase(CARD.itau, 'Academia', brl('129.90'), day(4), CAT.health);
    if (draws.itauPharmacyChance)
      addPurchase(CARD.itau, 'Farmácia', draws.itauPharmacy, day(18), CAT.health);
    if (draws.clothesChance)
      addPurchase(CARD.itau, 'Loja de roupas', draws.clothes, day(26), CAT.shopping);
    if (index === 8) addPurchase(CARD.itau, 'Notebook', brl('4799'), day(14), CAT.shopping, 10);
    if (index === 10) addPurchase(CARD.nubank, 'Geladeira', brl('3299'), day(20), CAT.shopping, 6);
    if (index === 11)
      addPurchase(CARD.nubank, 'Passagens aéreas', brl('2380'), day(9), CAT.leisure, 4);
  });

  // Pagamento integral das faturas vencidas (calculadas pelas regras do domínio).
  for (const card of CARDS) {
    for (const invoice of buildInvoices(card, purchases, [], today)) {
      if (invoice.dueDate >= today || invoice.total.isZero()) continue;
      transactions.push({
        ...baseTransaction,
        id: nextId('pay'),
        kind: 'card_payment',
        description: `Pagamento fatura ${card.name} — ${formatMonthShort(invoice.month)}`,
        amount: invoice.total,
        accountId: card.paymentAccountId,
        categoryId: null,
        competenceDate: invoice.dueDate,
        dueDate: invoice.dueDate,
        status: 'paid',
        paidDate: invoice.dueDate,
        cardPayment: { cardId: card.id, invoiceMonth: invoice.month },
      });
    }
  }

  const valuations = buildValuations(rng, movements, firstMonth, currentMonth, today, nextId);

  const accounts: Account[] = [
    {
      id: ACC.checking,
      name: 'Conta corrente',
      type: 'checking',
      institution: 'Nubank',
      initialBalance: brl('6000'),
      initialBalanceDate: startDate,
      archived: false,
    },
    {
      id: ACC.savings,
      name: 'Poupança',
      type: 'savings',
      institution: 'Itaú',
      initialBalance: brl('12000'),
      initialBalanceDate: startDate,
      archived: false,
    },
    {
      id: ACC.cash,
      name: 'Carteira',
      type: 'cash',
      institution: null,
      initialBalance: brl('350'),
      initialBalanceDate: startDate,
      archived: false,
    },
    {
      id: ACC.broker,
      name: 'Conta investimentos',
      type: 'investment',
      institution: 'XP Investimentos',
      initialBalance: brl('5000'),
      initialBalanceDate: startDate,
      archived: false,
    },
  ];

  const budgets: Budget[] = [
    {
      id: 'bud-geral',
      name: 'Gastos do mês',
      categoryId: null,
      amount: brl('8500'),
      period: 'monthly',
      alertThresholdPercent: 80,
      active: true,
    },
    {
      id: 'bud-alimentacao',
      name: 'Alimentação',
      categoryId: CAT.food,
      amount: brl('1800'),
      period: 'monthly',
      alertThresholdPercent: 80,
      active: true,
    },
    {
      id: 'bud-transporte',
      name: 'Transporte',
      categoryId: CAT.transport,
      amount: brl('900'),
      period: 'monthly',
      alertThresholdPercent: 80,
      active: true,
    },
    {
      id: 'bud-lazer',
      name: 'Lazer',
      categoryId: CAT.leisure,
      amount: brl('600'),
      period: 'monthly',
      alertThresholdPercent: 80,
      active: true,
    },
    {
      id: 'bud-compras',
      name: 'Compras',
      categoryId: CAT.shopping,
      amount: brl('700'),
      period: 'monthly',
      alertThresholdPercent: 80,
      active: true,
    },
    {
      id: 'bud-assinaturas',
      name: 'Assinaturas',
      categoryId: CAT.subscriptions,
      amount: brl('70'),
      period: 'monthly',
      alertThresholdPercent: 80,
      active: true,
    },
    {
      id: 'bud-moradia',
      name: 'Moradia',
      categoryId: CAT.housing,
      amount: brl('3400'),
      period: 'monthly',
      alertThresholdPercent: 90,
      active: true,
    },
  ];

  const goals: Goal[] = [
    {
      id: GOAL.emergency,
      name: 'Reserva de emergência',
      description: 'Seis meses de custo de vida',
      category: 'emergency_fund',
      targetAmount: brl('30000'),
      startDate,
      targetDate: monthEnd(addMonthsToKey(currentMonth, 8)),
      priority: 'high',
      accountId: ACC.savings,
      status: 'active',
    },
    {
      id: GOAL.travel,
      name: 'Viagem para Portugal',
      description: 'Passagens já parceladas no cartão; meta para hospedagem e passeios',
      category: 'travel',
      targetAmount: brl('15000'),
      startDate: monthStart(addMonthsToKey(firstMonth, 6)),
      targetDate: monthEnd(addMonthsToKey(currentMonth, 10)),
      priority: 'medium',
      accountId: ACC.savings,
      status: 'active',
    },
    {
      id: GOAL.car,
      name: 'Troca de carro',
      description: null,
      category: 'vehicle',
      targetAmount: brl('60000'),
      startDate: monthStart(currentMonth),
      targetDate: monthEnd(addMonthsToKey(currentMonth, 30)),
      priority: 'low',
      accountId: null,
      status: 'active',
    },
  ];

  const recurrence = (
    id: string,
    kind: 'income' | 'expense',
    description: string,
    amount: string,
    day: number,
    categoryId: string,
  ): Recurrence => ({
    id,
    frequency: 'monthly',
    startDate: dayOfMonth(firstMonth, day),
    endDate: null,
    template: {
      kind,
      description,
      amount: brl(amount),
      accountId: ACC.checking,
      categoryId,
      tags: [],
      notes: null,
    },
    excludedDates: [],
  });

  // Mesmos ids usados nas ocorrências acima: a materialização não as duplica.
  const recurrences: Recurrence[] = [
    recurrence('rec-salario', 'income', 'Salário — Empresa Exemplo Ltda.', '8400', 5, CAT.salary),
    recurrence('rec-aluguel', 'expense', 'Aluguel', '2200', 10, CAT.housing),
    recurrence('rec-condominio', 'expense', 'Condomínio', '650', 10, CAT.housing),
    recurrence('rec-saude', 'expense', 'Plano de saúde', '480', 8, CAT.health),
    recurrence('rec-ingles', 'expense', 'Curso de inglês', '390', 12, CAT.education),
    recurrence('rec-internet', 'expense', 'Internet fibra', '119.90', 20, CAT.housing),
    recurrence('rec-energia', 'expense', 'Conta de energia (estimativa)', '230', 15, CAT.housing),
  ];

  const records = <T>(items: readonly T[], map: (item: T) => object): DemoRecord[] =>
    items.map((item) => map(item) as DemoRecord);

  return {
    accounts: records(accounts, accountToRecord),
    categories: records(CATEGORIES, (item) => ({ ...item })),
    transactions: records(transactions, transactionToRecord),
    creditCards: records(CARDS, creditCardToRecord),
    cardPurchases: records(purchases, cardPurchaseToRecord),
    budgets: records(budgets, budgetToRecord),
    goals: records(goals, goalToRecord),
    goalContributions: records(contributions, goalContributionToRecord),
    assets: records(ASSETS, (item) => ({ ...item })),
    investmentMovements: records(movements, investmentMovementToRecord),
    assetValuations: records(valuations, assetValuationToRecord),
    recurrences: records(recurrences, recurrenceToRecord),
    auditLog: [],
  };
}

/**
 * Avaliação mensal de cada posição: (valor anterior + aplicações do mês) ×
 * (1 + variação sorteada). Data = fim do mês, ou a data de referência no mês
 * corrente. Tesouro é marcado como "estimativa"; demais, valor informado manualmente.
 */
function buildValuations(
  rng: SeededRandom,
  movements: readonly InvestmentMovement[],
  firstMonth: MonthKey,
  currentMonth: MonthKey,
  today: IsoDate,
  nextId: (prefix: string) => string,
): AssetValuation[] {
  const valuations: AssetValuation[] = [];
  const values = new Map<string, Money>();

  for (const month of monthKeysBetween(firstMonth, currentMonth)) {
    const end = month === currentMonth ? today : monthEnd(month);
    for (const asset of ASSETS) {
      const [min, max] = MONTHLY_RETURN_BP[asset.assetClass];
      const basisPoints = rng.int(min, max); // sorteado sempre (determinismo)
      const flows = Money.sum(
        movements
          .filter(
            (item) =>
              item.assetId === asset.id &&
              (item.type === 'buy' || item.type === 'contribution') &&
              toMonthKey(item.date) === month &&
              item.date <= end,
          )
          .map((item) => item.amount),
      );
      const base = (values.get(asset.id) ?? Money.zero()).add(flows);
      if (base.isZero()) continue;
      const value = base.multiply(new Decimal(10000 + basisPoints).dividedBy(10000));
      values.set(asset.id, value);
      valuations.push({
        id: nextId('val'),
        assetId: asset.id,
        date: end,
        value,
        source: asset.assetClass === 'treasury' ? 'estimate' : 'manual',
      });
    }
  }
  return valuations;
}

export const demoSeedFactory: DemoSeedFactory = {
  version: DEMO_SEED_VERSION,
  create: createDemoSeed,
};
