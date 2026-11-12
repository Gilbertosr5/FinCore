import type { CreditCardRepository } from '@/features/credit-cards/domain/repositories/credit-card.repository';
import { getFinancialEntries } from '@/features/dashboard/domain/financial-entries';
import type { AuditEntry, AuditLogRepository } from '@/features/history/domain/audit-entry';
import type {
  CategoryRepository,
  TransactionRepository,
} from '@/features/transactions/domain/repositories/transaction.repository';
import {
  addMonthsToKey,
  getDateParts,
  monthStart,
  toIsoDate,
  toMonthKey,
  type IsoDate,
  type MonthKey,
} from '@/lib/dates';
import { DomainError } from '@/lib/errors/domain-error';
import { formatMoney, Money } from '@/lib/money';

import type { Budget, BudgetPeriod } from '../domain/entities/budget';
import type { BudgetRepository } from '../domain/repositories/budget.repository';
import {
  computeBudgetUsage,
  getBudgetPeriod,
  sumBudgetSpending,
  type BudgetSpendingEntry,
  type BudgetUsage,
  type BudgetUsageStatus,
} from '../domain/services/budget-usage';

export interface BudgetContext {
  budgets: BudgetRepository;
  transactions: TransactionRepository;
  cards: CreditCardRepository;
  categories: CategoryRepository;
  audit: AuditLogRepository;
  newId: () => string;
  today: () => IsoDate;
  now: () => string;
  /** Garante as ocorrências de recorrências antes de medir o consumo. */
  prepare?: () => Promise<unknown>;
}

export interface BudgetInput {
  name: string;
  /** null = orçamento geral (todas as despesas). */
  categoryId: string | null;
  amount: Money;
  period: BudgetPeriod;
  alertThresholdPercent: number;
}

export const BUDGET_NAME_MAX_LENGTH = 60;
export const MAX_BUDGET_AMOUNT = Money.of('99999999.99');
export const DEFAULT_ALERT_THRESHOLD = 80;
export const BUDGET_PERIOD_LABELS: Record<BudgetPeriod, string> = {
  monthly: 'Mensal',
  yearly: 'Anual',
};

type BudgetErrorCode =
  | 'not_found'
  | 'invalid_name'
  | 'invalid_amount'
  | 'invalid_threshold'
  | 'category_not_found'
  | 'category_mismatch'
  | 'duplicate';

export class BudgetError extends DomainError<BudgetErrorCode> {
  constructor(code: BudgetErrorCode, message: string) {
    super(code, message);
    this.name = 'BudgetError';
  }
}

function audit(
  context: BudgetContext,
  entityId: string,
  action: AuditEntry['action'],
  summary: string,
): AuditEntry {
  return {
    id: context.newId(),
    entityType: 'budget',
    entityId,
    action,
    at: context.now(),
    summary,
  };
}

/** Só um orçamento ATIVO por categoria (ou geral) e período, evitando alertas duplicados. */
function assertNoDuplicate(
  budgets: readonly Budget[],
  candidate: Pick<Budget, 'categoryId' | 'period'>,
  ignoreId?: string,
): void {
  const duplicate = budgets.find(
    (item) =>
      item.active &&
      item.id !== ignoreId &&
      item.categoryId === candidate.categoryId &&
      item.period === candidate.period,
  );
  if (duplicate) {
    throw new BudgetError(
      'duplicate',
      `Já existe o orçamento ${BUDGET_PERIOD_LABELS[candidate.period].toLowerCase()} "${duplicate.name}" para ${candidate.categoryId === null ? 'todas as despesas' : 'esta categoria'}.`,
    );
  }
}

async function normalizeInput(context: BudgetContext, input: BudgetInput): Promise<BudgetInput> {
  const name = input.name.trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > BUDGET_NAME_MAX_LENGTH) {
    throw new BudgetError(
      'invalid_name',
      `O nome do orçamento deve ter entre 2 e ${BUDGET_NAME_MAX_LENGTH} caracteres.`,
    );
  }
  if (!input.amount.isPositive()) {
    throw new BudgetError('invalid_amount', 'O limite deve ser maior que zero.');
  }
  if (input.amount.greaterThan(MAX_BUDGET_AMOUNT)) {
    throw new BudgetError('invalid_amount', 'O limite excede o máximo permitido.');
  }
  const threshold = input.alertThresholdPercent;
  if (!Number.isInteger(threshold) || threshold < 1 || threshold > 100) {
    throw new BudgetError('invalid_threshold', 'O alerta deve ser um percentual entre 1 e 100.');
  }
  if (input.categoryId !== null) {
    const category = (await context.categories.findAll()).find(
      (item) => item.id === input.categoryId,
    );
    if (!category) throw new BudgetError('category_not_found', 'Categoria não encontrada.');
    if (category.kind !== 'expense') {
      throw new BudgetError('category_mismatch', 'Orçamentos limitam categorias de despesa.');
    }
  }
  return { ...input, name };
}

export class CreateBudgetUseCase {
  constructor(private readonly context: BudgetContext) {}

  async execute(input: BudgetInput): Promise<Budget> {
    const normalized = await normalizeInput(this.context, input);
    assertNoDuplicate(await this.context.budgets.findAll(), normalized);
    const budget: Budget = { id: this.context.newId(), ...normalized, active: true };
    await this.context.budgets.save(budget);
    await this.context.audit.append([
      audit(
        this.context,
        budget.id,
        'created',
        `Orçamento ${BUDGET_PERIOD_LABELS[budget.period].toLowerCase()} criado com limite de ${formatMoney(budget.amount)}.`,
      ),
    ]);
    return budget;
  }
}

export class UpdateBudgetUseCase {
  constructor(private readonly context: BudgetContext) {}

  async execute(id: string, input: BudgetInput): Promise<void> {
    const current = await this.context.budgets.findById(id);
    if (!current) throw new BudgetError('not_found', 'Orçamento não encontrado.');
    const normalized = await normalizeInput(this.context, input);
    if (current.active) assertNoDuplicate(await this.context.budgets.findAll(), normalized, id);
    await this.context.budgets.save({ ...current, ...normalized });
    await this.context.audit.append([
      audit(
        this.context,
        id,
        'updated',
        current.amount.equals(normalized.amount)
          ? 'Dados do orçamento alterados.'
          : `Limite alterado de ${formatMoney(current.amount)} para ${formatMoney(normalized.amount)}.`,
      ),
    ]);
  }
}

/** Pausa ou reativa o orçamento (pausado não gera alertas nem entra nos totais). */
export class SetBudgetActiveUseCase {
  constructor(private readonly context: BudgetContext) {}

  async execute(id: string, active: boolean): Promise<void> {
    const current = await this.context.budgets.findById(id);
    if (!current) throw new BudgetError('not_found', 'Orçamento não encontrado.');
    if (current.active === active) return;
    if (active) assertNoDuplicate(await this.context.budgets.findAll(), current, id);
    await this.context.budgets.save({ ...current, active });
    await this.context.audit.append([
      audit(
        this.context,
        id,
        active ? 'restored' : 'archived',
        active ? 'Orçamento reativado.' : 'Orçamento pausado.',
      ),
    ]);
  }
}

export class DeleteBudgetUseCase {
  constructor(private readonly context: BudgetContext) {}

  async execute(id: string): Promise<void> {
    const current = await this.context.budgets.findById(id);
    if (!current) throw new BudgetError('not_found', 'Orçamento não encontrado.');
    await this.context.budgets.remove(id);
    await this.context.audit.append([
      audit(this.context, id, 'deleted', `Excluído: ${current.name}.`),
    ]);
  }
}

async function loadEntries(context: BudgetContext): Promise<BudgetSpendingEntry[]> {
  await context.prepare?.();
  const [transactions, cards, purchases] = await Promise.all([
    context.transactions.findAll(),
    context.cards.findAll(),
    context.cards.findPurchases(),
  ]);
  return getFinancialEntries({ transactions, cards, purchases });
}

export interface BudgetView {
  usage: BudgetUsage;
  categoryName: string | null;
  period: { start: IsoDate; end: IsoDate };
}

export interface BudgetMonthOverview {
  month: MonthKey;
  items: BudgetView[];
  /** Somente orçamentos ativos. */
  counts: Record<BudgetUsageStatus, number>;
  /** Soma dos orçamentos mensais ativos por categoria (planejado × realizado). */
  plannedByCategory: Money;
  spentByCategory: Money;
}

const STATUS_ORDER: Record<BudgetUsageStatus, number> = { exceeded: 0, warning: 1, ok: 2 };

/**
 * Consumo de cada orçamento no mês escolhido (orçamentos anuais usam o ano do
 * mês). Ativos primeiro, do mais crítico ao mais folgado.
 */
export class GetBudgetMonthUseCase {
  constructor(private readonly context: BudgetContext) {}

  async execute(month: MonthKey): Promise<BudgetMonthOverview> {
    const [entries, budgets, categories] = await Promise.all([
      loadEntries(this.context),
      this.context.budgets.findAll(),
      this.context.categories.findAll(),
    ]);
    const categoryName = new Map(categories.map((item) => [item.id, item.name]));
    const reference = monthStart(month);

    const items = budgets
      .map((budget): BudgetView => {
        const period = getBudgetPeriod(budget, reference);
        return {
          usage: computeBudgetUsage(budget, sumBudgetSpending(budget, entries, period)),
          categoryName: budget.categoryId ? (categoryName.get(budget.categoryId) ?? null) : null,
          period,
        };
      })
      .sort(
        (a, b) =>
          Number(b.usage.budget.active) - Number(a.usage.budget.active) ||
          STATUS_ORDER[a.usage.status] - STATUS_ORDER[b.usage.status] ||
          (b.usage.percent ?? 0) - (a.usage.percent ?? 0),
      );

    const active = items.filter((item) => item.usage.budget.active);
    const monthlyByCategory = active.filter(
      (item) => item.usage.budget.period === 'monthly' && item.usage.budget.categoryId !== null,
    );
    return {
      month,
      items,
      counts: {
        ok: active.filter((item) => item.usage.status === 'ok').length,
        warning: active.filter((item) => item.usage.status === 'warning').length,
        exceeded: active.filter((item) => item.usage.status === 'exceeded').length,
      },
      plannedByCategory: Money.sum(monthlyByCategory.map((item) => item.usage.budget.amount)),
      spentByCategory: Money.sum(monthlyByCategory.map((item) => item.usage.spent)),
    };
  }
}

export interface BudgetHistoryRow {
  /** Mês (orçamento mensal) ou ano (anual) — rótulo formatado na interface. */
  key: string;
  period: { start: IsoDate; end: IsoDate };
  usage: BudgetUsage;
  current: boolean;
}

export const BUDGET_HISTORY_MONTHS = 12;
export const BUDGET_HISTORY_YEARS = 5;

/**
 * Planejado × realizado período a período (últimos 12 meses ou 5 anos, mais
 * recente primeiro). Usa o limite ATUAL do orçamento (ver ADR 0010).
 */
export class GetBudgetHistoryUseCase {
  constructor(private readonly context: BudgetContext) {}

  async execute(id: string): Promise<BudgetHistoryRow[]> {
    const budget = await this.context.budgets.findById(id);
    if (!budget) throw new BudgetError('not_found', 'Orçamento não encontrado.');
    const entries = await loadEntries(this.context);
    const today = this.context.today();

    const references: { key: string; date: IsoDate }[] =
      budget.period === 'monthly'
        ? Array.from({ length: BUDGET_HISTORY_MONTHS }, (_, index) => {
            const month = addMonthsToKey(toMonthKey(today), -index);
            return { key: month, date: monthStart(month) };
          })
        : Array.from({ length: BUDGET_HISTORY_YEARS }, (_, index) => {
            const year = getDateParts(today).year - index;
            return { key: String(year), date: toIsoDate({ year, month: 1, day: 1 }) };
          });

    return references.map(({ key, date }, index) => {
      const period = getBudgetPeriod(budget, date);
      return {
        key,
        period,
        usage: computeBudgetUsage(budget, sumBudgetSpending(budget, entries, period)),
        current: index === 0,
      };
    });
  }
}

export interface BudgetUseCases {
  month: GetBudgetMonthUseCase;
  history: GetBudgetHistoryUseCase;
  create: CreateBudgetUseCase;
  update: UpdateBudgetUseCase;
  setActive: SetBudgetActiveUseCase;
  remove: DeleteBudgetUseCase;
}

export function createBudgetUseCases(context: BudgetContext): BudgetUseCases {
  return {
    month: new GetBudgetMonthUseCase(context),
    history: new GetBudgetHistoryUseCase(context),
    create: new CreateBudgetUseCase(context),
    update: new UpdateBudgetUseCase(context),
    setActive: new SetBudgetActiveUseCase(context),
    remove: new DeleteBudgetUseCase(context),
  };
}
