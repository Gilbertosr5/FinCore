import type { Account } from '@/features/accounts/domain/entities/account';
import type { AccountRepository } from '@/features/accounts/domain/repositories/account.repository';
import type { AuditEntry, AuditLogRepository } from '@/features/history/domain/audit-entry';
import type { Category } from '@/features/transactions/domain/entities/category';
import type { Transaction } from '@/features/transactions/domain/entities/transaction';
import type { CategoryRepository } from '@/features/transactions/domain/repositories/transaction.repository';
import { formatDateBR, type IsoDate } from '@/lib/dates';
import { DomainError } from '@/lib/errors/domain-error';
import { formatMoney, Money } from '@/lib/money';

import {
  ASSET_CLASS_LABELS,
  MOVEMENT_TYPE_LABELS,
  QUANTITY_ASSET_CLASSES,
  type Asset,
  type AssetClass,
  type AssetValuation,
  type InvestmentMovement,
  type InvestmentMovementType,
} from '../domain/entities/investment';
import type { MarketIndicatorsSnapshot } from '../domain/entities/market-indicator';
import type {
  InvestmentRepository,
  MarketIndicatorRepository,
} from '../domain/repositories/investment.repository';
import {
  CAPITAL_IN_TYPES,
  CAPITAL_OUT_TYPES,
  computePortfolio,
  computePosition,
  findOversell,
  INCOME_TYPES,
  type PortfolioSummary,
  type Position,
} from '../domain/services/portfolio';
import {
  buildEvolution,
  buildIncomeByMonth,
  type EvolutionPoint,
  type IncomePoint,
} from '../domain/services/portfolio-analytics';

/**
 * Porta para lançamentos na conta (implementada por `InvestmentLedgerCommands`
 * da feature de transações). Aplicação/resgate nunca são receita/despesa;
 * proventos são receita (ADR 0007/0012).
 */
export interface InvestmentLedgerPort {
  /**
   * Valida e monta o lançamento SEM gravar: o repositório da carteira grava
   * movimentação + lançamento juntos (ADR 0015). `confirm` registra o histórico.
   */
  prepare(input: {
    flow: 'application' | 'redemption' | 'income';
    accountId: string;
    assetId: string;
    amount: Money;
    date: IsoDate;
    description: string;
    categoryId: string | null;
  }): Promise<{ transactions: Transaction[]; confirm: () => Promise<void> }>;
  /** Lançamento vinculado ainda existente (vazio se já foi excluído). */
  prepareRemoval(
    transactionId: string,
  ): Promise<{ transactionIds: string[]; confirm: () => Promise<void> }>;
}

export interface InvestmentContext {
  investments: InvestmentRepository;
  market: MarketIndicatorRepository;
  accounts: AccountRepository;
  categories: CategoryRepository;
  ledger: InvestmentLedgerPort;
  audit: AuditLogRepository;
  newId: () => string;
  today: () => IsoDate;
  now: () => string;
}

export interface AssetInput {
  name: string;
  ticker: string | null;
  assetClass: AssetClass;
  institution: string;
  notes: string | null;
}

export interface MovementInput {
  assetId: string;
  type: InvestmentMovementType;
  date: IsoDate;
  amount: Money;
  /** Quantidade negociada (decimal com ponto) — obrigatória em compra/venda. */
  quantity: string | null;
  /** Conta movimentada junto (aplicação, resgate ou recebimento de proventos). */
  accountId: string | null;
  /** Categoria de receita dos proventos quando há conta. */
  categoryId: string | null;
}

export interface ValuationInput {
  assetId: string;
  date: IsoDate;
  value: Money;
  source: 'manual' | 'estimate';
}

/** Sugestão de atualização do valor atual após uma movimentação. */
export interface RevaluationSuggestion {
  assetId: string;
  date: IsoDate;
  suggestedValue: Money;
}

export const ASSET_NAME_MAX_LENGTH = 80;
export const TICKER_MAX_LENGTH = 12;
export const MAX_INVESTMENT_AMOUNT = Money.of('999999999.99');
const QUANTITY_PATTERN = /^\d+(\.\d{1,8})?$/;

type InvestmentErrorCode =
  | 'not_found'
  | 'invalid_name'
  | 'invalid_ticker'
  | 'duplicate_ticker'
  | 'invalid_amount'
  | 'invalid_quantity'
  | 'invalid_type'
  | 'in_future'
  | 'insufficient_quantity'
  | 'insufficient_value'
  | 'account_not_supported'
  | 'asset_in_use'
  | 'movement_not_found'
  | 'valuation_not_found';

export class InvestmentError extends DomainError<InvestmentErrorCode> {
  constructor(code: InvestmentErrorCode, message: string) {
    super(code, message);
    this.name = 'InvestmentError';
  }
}

/** Tipos de movimentação aceitos por classe: negociados em quantidade usam compra/venda. */
export function allowedMovementTypes(assetClass: AssetClass): InvestmentMovementType[] {
  const capital: InvestmentMovementType[] = QUANTITY_ASSET_CLASSES.has(assetClass)
    ? ['buy', 'sell']
    : ['contribution', 'redemption'];
  return [...capital, 'dividend', 'interest', 'income', 'fee', 'tax'];
}

function audit(
  context: InvestmentContext,
  entityId: string,
  action: AuditEntry['action'],
  summary: string,
): AuditEntry {
  return {
    id: context.newId(),
    entityType: 'asset',
    entityId,
    action,
    at: context.now(),
    summary,
  };
}

async function loadAsset(context: InvestmentContext, id: string): Promise<Asset> {
  const asset = (await context.investments.findAssets()).find((item) => item.id === id);
  if (!asset) throw new InvestmentError('not_found', 'Ativo não encontrado.');
  return asset;
}

async function normalizeAsset(
  context: InvestmentContext,
  input: AssetInput,
  ignoreId?: string,
): Promise<AssetInput> {
  const name = input.name.trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > ASSET_NAME_MAX_LENGTH) {
    throw new InvestmentError(
      'invalid_name',
      `O nome do ativo deve ter entre 2 e ${ASSET_NAME_MAX_LENGTH} caracteres.`,
    );
  }
  const ticker = input.ticker?.trim().toUpperCase() ?? '';
  if (ticker !== '' && !/^[A-Z0-9.-]{1,12}$/.test(ticker)) {
    throw new InvestmentError(
      'invalid_ticker',
      `Código inválido: use até ${TICKER_MAX_LENGTH} letras, números, ponto ou hífen.`,
    );
  }
  if (ticker !== '') {
    const assets = await context.investments.findAssets();
    if (assets.some((item) => item.id !== ignoreId && item.ticker?.toUpperCase() === ticker)) {
      throw new InvestmentError('duplicate_ticker', `Já existe um ativo com o código ${ticker}.`);
    }
  }
  const notes = input.notes?.trim() ?? '';
  return {
    ...input,
    name,
    ticker: ticker === '' ? null : ticker,
    institution: input.institution.trim().replace(/\s+/g, ' ').slice(0, 60),
    notes: notes === '' ? null : notes.slice(0, 200),
  };
}

export class CreateAssetUseCase {
  constructor(private readonly context: InvestmentContext) {}

  async execute(input: AssetInput): Promise<Asset> {
    const asset: Asset = {
      id: this.context.newId(),
      ...(await normalizeAsset(this.context, input)),
    };
    await this.context.investments.saveAsset(asset);
    await this.context.audit.append([
      audit(
        this.context,
        asset.id,
        'created',
        `Ativo cadastrado (${ASSET_CLASS_LABELS[asset.assetClass]}).`,
      ),
    ]);
    return asset;
  }
}

export class UpdateAssetUseCase {
  constructor(private readonly context: InvestmentContext) {}

  async execute(id: string, input: AssetInput): Promise<void> {
    const current = await loadAsset(this.context, id);
    const normalized = await normalizeAsset(this.context, input, id);
    if (normalized.assetClass !== current.assetClass) {
      const movements = await this.context.investments.findMovements();
      const own = movements.filter((item) => item.assetId === id);
      const allowed = new Set(allowedMovementTypes(normalized.assetClass));
      if (own.some((item) => !allowed.has(item.type))) {
        throw new InvestmentError(
          'invalid_type',
          'As movimentações já registradas não são compatíveis com a nova classe do ativo.',
        );
      }
    }
    await this.context.investments.saveAsset({ ...current, ...normalized });
    await this.context.audit.append([
      audit(this.context, id, 'updated', 'Dados do ativo alterados.'),
    ]);
  }
}

/** Exclusão definitiva só sem movimentações (as avaliações são removidas junto). */
export class DeleteAssetUseCase {
  constructor(private readonly context: InvestmentContext) {}

  async execute(id: string): Promise<void> {
    const asset = await loadAsset(this.context, id);
    const [movements, valuations] = await Promise.all([
      this.context.investments.findMovements(),
      this.context.investments.findValuations(),
    ]);
    if (movements.some((item) => item.assetId === id)) {
      throw new InvestmentError(
        'asset_in_use',
        'O ativo possui movimentações. Exclua-as antes ou mantenha o histórico.',
      );
    }
    for (const valuation of valuations.filter((item) => item.assetId === id)) {
      await this.context.investments.removeValuation(valuation.id);
    }
    await this.context.investments.removeAsset(id);
    await this.context.audit.append([
      audit(this.context, id, 'deleted', `Excluído: ${asset.name}.`),
    ]);
  }
}

function assertQuantity(asset: Asset, input: MovementInput): string | null {
  const capital = CAPITAL_IN_TYPES.has(input.type) || CAPITAL_OUT_TYPES.has(input.type);
  if (!capital) return null;
  if (!QUANTITY_ASSET_CLASSES.has(asset.assetClass)) return null;
  const quantity = input.quantity?.trim().replace(',', '.') ?? '';
  if (!QUANTITY_PATTERN.test(quantity) || Number(quantity) <= 0) {
    throw new InvestmentError(
      'invalid_quantity',
      'Informe a quantidade (até 8 casas decimais, maior que zero).',
    );
  }
  return quantity;
}

/** A sequência de movimentações nunca pode vender mais do que havia em carteira. */
function assertQuantityNeverNegative(movements: readonly InvestmentMovement[]): void {
  const oversell = findOversell(movements);
  if (oversell) {
    throw new InvestmentError(
      'insufficient_quantity',
      `A venda de ${formatDateBR(oversell.date)} excede a quantidade em carteira.`,
    );
  }
}

/**
 * Registra uma movimentação. Com conta informada, grava também o lançamento
 * (aplicação/resgate ou proventos) antes — e o desfaz se a movimentação falhar.
 * Retorna a sugestão de novo valor atual quando a operação é anterior à última
 * avaliação (que ficaria desatualizada).
 */
export class RecordMovementUseCase {
  constructor(private readonly context: InvestmentContext) {}

  async execute(
    input: MovementInput,
  ): Promise<{ movement: InvestmentMovement; revaluation: RevaluationSuggestion | null }> {
    const asset = await loadAsset(this.context, input.assetId);
    if (!allowedMovementTypes(asset.assetClass).includes(input.type)) {
      throw new InvestmentError(
        'invalid_type',
        QUANTITY_ASSET_CLASSES.has(asset.assetClass)
          ? 'Para este ativo, use compra ou venda (com quantidade).'
          : 'Para este ativo, use aporte ou resgate.',
      );
    }
    if (!input.amount.isPositive() || input.amount.greaterThan(MAX_INVESTMENT_AMOUNT)) {
      throw new InvestmentError('invalid_amount', 'Informe um valor maior que zero.');
    }
    const today = this.context.today();
    if (input.date > today) throw new InvestmentError('in_future', 'A data não pode ser futura.');
    const quantity = assertQuantity(asset, input);

    const [movements, valuations] = await Promise.all([
      this.context.investments.findMovements(),
      this.context.investments.findValuations(),
    ]);
    const own = movements.filter((item) => item.assetId === asset.id);
    const candidate: InvestmentMovement = {
      id: this.context.newId(),
      assetId: asset.id,
      type: input.type,
      date: input.date,
      quantity,
      amount: input.amount,
      transactionId: null,
    };
    if (quantity !== null) assertQuantityNeverNegative([...own, candidate]);
    if (input.type === 'redemption') {
      const position = computePosition(asset, own, valuations, input.date);
      if (input.amount.greaterThan(position.currentValue)) {
        throw new InvestmentError(
          'insufficient_value',
          `O resgate excede o valor da posição em ${formatDateBR(input.date)} (${formatMoney(position.currentValue)}). Atualize o valor atual antes.`,
        );
      }
    }

    let linked: Awaited<ReturnType<InvestmentLedgerPort['prepare']>> | null = null;
    if (input.accountId !== null) {
      const flow = CAPITAL_IN_TYPES.has(input.type)
        ? 'application'
        : CAPITAL_OUT_TYPES.has(input.type)
          ? 'redemption'
          : INCOME_TYPES.has(input.type)
            ? 'income'
            : null;
      if (flow === null) {
        throw new InvestmentError(
          'account_not_supported',
          'Taxas e impostos são registrados só na carteira (normalmente já descontados pela corretora).',
        );
      }
      const label = asset.ticker ?? asset.name;
      linked = await this.context.ledger.prepare({
        flow,
        accountId: input.accountId,
        assetId: asset.id,
        amount: input.amount,
        date: input.date,
        description:
          flow === 'application'
            ? `Aplicação — ${label}`
            : flow === 'redemption'
              ? `Resgate — ${label}`
              : `${MOVEMENT_TYPE_LABELS[input.type]} — ${label}`,
        categoryId: flow === 'income' ? input.categoryId : null,
      });
    }

    const [transaction] = linked?.transactions ?? [];
    candidate.transactionId = transaction?.id ?? null;
    // Movimentação e lançamento numa única gravação: ou os dois, ou nenhum.
    await this.context.investments.saveMovement(candidate, transaction ?? null);
    await linked?.confirm();
    await this.context.audit.append([
      audit(
        this.context,
        asset.id,
        'created',
        `${MOVEMENT_TYPE_LABELS[input.type]} de ${formatMoney(input.amount)}${quantity ? ` (${quantity.replace('.', ',')} un.)` : ''} em ${formatDateBR(input.date)}${candidate.transactionId ? ', com lançamento na conta' : ''}.`,
      ),
    ]);

    return { movement: candidate, revaluation: suggestRevaluation(asset, candidate, valuations) };
  }
}

/**
 * Se a operação de capital é anterior (ou do mesmo dia) à última avaliação, ela
 * não entra no valor atual automaticamente: sugere o valor ajustado pelo custo.
 */
function suggestRevaluation(
  asset: Asset,
  movement: InvestmentMovement,
  valuations: readonly AssetValuation[],
): RevaluationSuggestion | null {
  const isIn = CAPITAL_IN_TYPES.has(movement.type);
  const isOut = CAPITAL_OUT_TYPES.has(movement.type);
  if (!isIn && !isOut) return null;
  const latest = valuations
    .filter((item) => item.assetId === asset.id)
    .reduce<AssetValuation | null>(
      (best, item) => (best === null || item.date > best.date ? item : best),
      null,
    );
  if (!latest || latest.date < movement.date) return null;
  const adjusted = isIn
    ? latest.value.add(movement.amount)
    : latest.value.subtract(movement.amount);
  return { assetId: asset.id, date: latest.date, suggestedValue: adjusted.max(Money.zero()) };
}

export class RemoveMovementUseCase {
  constructor(private readonly context: InvestmentContext) {}

  async execute(id: string): Promise<void> {
    const movements = await this.context.investments.findMovements();
    const movement = movements.find((item) => item.id === id);
    if (!movement) throw new InvestmentError('movement_not_found', 'Movimentação não encontrada.');
    const remaining = movements.filter(
      (item) => item.assetId === movement.assetId && item.id !== id,
    );
    if (CAPITAL_IN_TYPES.has(movement.type) && movement.quantity !== null) {
      assertQuantityNeverNegative(remaining);
    }
    const removal =
      movement.transactionId === null
        ? null
        : await this.context.ledger.prepareRemoval(movement.transactionId);
    await this.context.investments.removeMovement(id, removal?.transactionIds ?? []);
    await removal?.confirm();
    await this.context.audit.append([
      audit(
        this.context,
        movement.assetId,
        'deleted',
        `${MOVEMENT_TYPE_LABELS[movement.type]} de ${formatMoney(movement.amount)} (${formatDateBR(movement.date)}) excluído.`,
      ),
    ]);
  }
}

/** Valor atual informado: um por ativo e data (registrar de novo substitui). */
export class RecordValuationUseCase {
  constructor(private readonly context: InvestmentContext) {}

  async execute(input: ValuationInput): Promise<AssetValuation> {
    const asset = await loadAsset(this.context, input.assetId);
    if (input.value.isNegative() || input.value.greaterThan(MAX_INVESTMENT_AMOUNT)) {
      throw new InvestmentError('invalid_amount', 'Informe um valor igual ou maior que zero.');
    }
    if (input.date > this.context.today()) {
      throw new InvestmentError('in_future', 'A data não pode ser futura.');
    }
    const existing = (await this.context.investments.findValuations()).find(
      (item) => item.assetId === asset.id && item.date === input.date,
    );
    const valuation: AssetValuation = {
      id: existing?.id ?? this.context.newId(),
      assetId: asset.id,
      date: input.date,
      value: input.value,
      source: input.source,
    };
    await this.context.investments.saveValuation(valuation);
    await this.context.audit.append([
      audit(
        this.context,
        asset.id,
        'updated',
        `Valor atual ${input.source === 'estimate' ? 'estimado' : 'informado'}: ${formatMoney(input.value)} em ${formatDateBR(input.date)}.`,
      ),
    ]);
    return valuation;
  }
}

export class RemoveValuationUseCase {
  constructor(private readonly context: InvestmentContext) {}

  async execute(id: string): Promise<void> {
    const valuation = (await this.context.investments.findValuations()).find(
      (item) => item.id === id,
    );
    if (!valuation) throw new InvestmentError('valuation_not_found', 'Avaliação não encontrada.');
    await this.context.investments.removeValuation(id);
    await this.context.audit.append([
      audit(
        this.context,
        valuation.assetId,
        'deleted',
        `Avaliação de ${formatDateBR(valuation.date)} (${formatMoney(valuation.value)}) excluída.`,
      ),
    ]);
  }
}

export interface PositionView {
  position: Position;
  /** Participação no valor da carteira, em pontos percentuais. */
  share: number;
}

export interface PortfolioOverview {
  summary: PortfolioSummary;
  positions: PositionView[];
  /** Ativos sem posição (cadastrados ou encerrados). */
  inactiveAssets: Asset[];
  evolution: EvolutionPoint[];
  incomeByMonth: IncomePoint[];
}

const share = (value: Money, total: Money) => value.percentageOf(total)?.toNumber() ?? 0;

export class GetPortfolioUseCase {
  constructor(private readonly context: InvestmentContext) {}

  async execute(): Promise<PortfolioOverview> {
    const [assets, movements, valuations] = await Promise.all([
      this.context.investments.findAssets(),
      this.context.investments.findMovements(),
      this.context.investments.findValuations(),
    ]);
    const today = this.context.today();
    const summary = computePortfolio(assets, movements, valuations, today);
    const active = new Set(summary.positions.map((item) => item.asset.id));
    return {
      summary,
      positions: summary.positions
        .map((position) => ({
          position,
          share: share(position.currentValue, summary.currentValue),
        }))
        .sort((a, b) => b.position.currentValue.compare(a.position.currentValue)),
      inactiveAssets: assets
        .filter((asset) => !active.has(asset.id))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
      evolution: buildEvolution(assets, movements, valuations, today),
      incomeByMonth: buildIncomeByMonth(movements, today),
    };
  }
}

export interface AssetDetails {
  position: Position;
  /** Mais recentes primeiro. */
  movements: InvestmentMovement[];
  valuations: AssetValuation[];
  evolution: EvolutionPoint[];
  allowedTypes: InvestmentMovementType[];
  accounts: Pick<Account, 'id' | 'name'>[];
  incomeCategories: Pick<Category, 'id' | 'name'>[];
}

const byDateDesc = <T extends { date: IsoDate; id: string }>(a: T, b: T) =>
  a.date === b.date ? b.id.localeCompare(a.id) : a.date < b.date ? 1 : -1;

export class GetAssetDetailsUseCase {
  constructor(private readonly context: InvestmentContext) {}

  async execute(id: string): Promise<AssetDetails> {
    const asset = await loadAsset(this.context, id);
    const [movements, valuations, accounts, categories] = await Promise.all([
      this.context.investments.findMovements(),
      this.context.investments.findValuations(),
      this.context.accounts.findAll(),
      this.context.categories.findAll(),
    ]);
    const today = this.context.today();
    const own = movements.filter((item) => item.assetId === id);
    const ownValuations = valuations.filter((item) => item.assetId === id);
    return {
      position: computePosition(asset, own, ownValuations, today),
      movements: [...own].sort(byDateDesc),
      valuations: [...ownValuations].sort(byDateDesc),
      evolution: buildEvolution([asset], own, ownValuations, today),
      allowedTypes: allowedMovementTypes(asset.assetClass),
      accounts: accounts
        .filter((account) => !account.archived)
        .map(({ id: accountId, name }) => ({ id: accountId, name })),
      incomeCategories: categories
        .filter((category) => category.kind === 'income')
        .map(({ id: categoryId, name }) => ({ id: categoryId, name })),
    };
  }
}

export class GetMarketIndicatorsUseCase {
  constructor(private readonly context: InvestmentContext) {}

  execute(): Promise<MarketIndicatorsSnapshot> {
    return this.context.market.findLatest();
  }
}

export interface InvestmentUseCases {
  portfolio: GetPortfolioUseCase;
  details: GetAssetDetailsUseCase;
  market: GetMarketIndicatorsUseCase;
  createAsset: CreateAssetUseCase;
  updateAsset: UpdateAssetUseCase;
  deleteAsset: DeleteAssetUseCase;
  recordMovement: RecordMovementUseCase;
  removeMovement: RemoveMovementUseCase;
  recordValuation: RecordValuationUseCase;
  removeValuation: RemoveValuationUseCase;
}

export function createInvestmentUseCases(context: InvestmentContext): InvestmentUseCases {
  return {
    portfolio: new GetPortfolioUseCase(context),
    details: new GetAssetDetailsUseCase(context),
    market: new GetMarketIndicatorsUseCase(context),
    createAsset: new CreateAssetUseCase(context),
    updateAsset: new UpdateAssetUseCase(context),
    deleteAsset: new DeleteAssetUseCase(context),
    recordMovement: new RecordMovementUseCase(context),
    removeMovement: new RemoveMovementUseCase(context),
    recordValuation: new RecordValuationUseCase(context),
    removeValuation: new RemoveValuationUseCase(context),
  };
}
