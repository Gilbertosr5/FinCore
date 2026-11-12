import type { Account } from '@/features/accounts/domain/entities/account';
import type { AccountRepository } from '@/features/accounts/domain/repositories/account.repository';
import type { AuditEntry, AuditLogRepository } from '@/features/history/domain/audit-entry';
import { formatDateBR, type IsoDate } from '@/lib/dates';
import { DomainError } from '@/lib/errors/domain-error';
import { formatMoney, Money } from '@/lib/money';

import type {
  Goal,
  GoalCategory,
  GoalContribution,
  GoalPriority,
  GoalStatus,
} from '../domain/entities/goal';
import { GOAL_STATUS_LABELS } from '../domain/entities/goal';
import type { GoalRepository } from '../domain/repositories/goal.repository';
import {
  computeGoalProgress,
  projectGoal,
  type GoalProgress,
  type GoalProjection,
} from '../domain/services/goal-progress';

/**
 * Porta para transferências entre contas (implementada pelos casos de uso de
 * lançamentos na composição). Aportes nunca são receita: quando há movimento
 * de dinheiro, ele é uma transferência (ADR 0007/0011).
 */
export interface GoalTransferPort {
  create(input: {
    fromAccountId: string;
    toAccountId: string;
    amount: Money;
    date: IsoDate;
    description: string;
  }): Promise<string>;
  remove(transferId: string): Promise<void>;
}

export interface GoalContext {
  goals: GoalRepository;
  accounts: AccountRepository;
  transfers: GoalTransferPort;
  audit: AuditLogRepository;
  newId: () => string;
  today: () => IsoDate;
  now: () => string;
}

export interface GoalInput {
  name: string;
  description: string | null;
  category: GoalCategory;
  targetAmount: Money;
  startDate: IsoDate;
  targetDate: IsoDate | null;
  priority: GoalPriority;
  /** Conta onde o dinheiro da meta fica guardado (opcional). */
  accountId: string | null;
}

export interface ContributionInput {
  goalId: string;
  type: GoalContribution['type'];
  amount: Money;
  date: IsoDate;
  /**
   * Conta de origem (aporte) ou de destino (retirada) para registrar também a
   * transferência para/da conta da meta. null = registrar só a destinação.
   */
  counterpartAccountId: string | null;
}

export const GOAL_NAME_MAX_LENGTH = 60;
export const GOAL_DESCRIPTION_MAX_LENGTH = 200;
export const MAX_GOAL_AMOUNT = Money.of('999999999.99');

type GoalErrorCode =
  | 'not_found'
  | 'invalid_name'
  | 'invalid_description'
  | 'invalid_amount'
  | 'invalid_dates'
  | 'account_not_found'
  | 'account_archived'
  | 'goal_not_active'
  | 'contribution_in_future'
  | 'contribution_before_start'
  | 'insufficient_balance'
  | 'transfer_requires_account'
  | 'same_account'
  | 'goal_in_use'
  | 'contribution_not_found';

export class GoalError extends DomainError<GoalErrorCode> {
  constructor(code: GoalErrorCode, message: string) {
    super(code, message);
    this.name = 'GoalError';
  }
}

function audit(
  context: GoalContext,
  entityId: string,
  action: AuditEntry['action'],
  summary: string,
): AuditEntry {
  return { id: context.newId(), entityType: 'goal', entityId, action, at: context.now(), summary };
}

async function loadGoal(context: GoalContext, id: string): Promise<Goal> {
  const goal = await context.goals.findById(id);
  if (!goal) throw new GoalError('not_found', 'Meta não encontrada.');
  return goal;
}

async function assertAccount(
  context: GoalContext,
  accountId: string,
  allowArchivedId?: string | null,
): Promise<Account> {
  const account = await context.accounts.findById(accountId);
  if (!account) throw new GoalError('account_not_found', 'Conta não encontrada.');
  if (account.archived && account.id !== allowArchivedId) {
    throw new GoalError('account_archived', `A conta "${account.name}" está arquivada.`);
  }
  return account;
}

async function normalizeInput(
  context: GoalContext,
  input: GoalInput,
  currentAccountId?: string | null,
): Promise<GoalInput> {
  const name = input.name.trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > GOAL_NAME_MAX_LENGTH) {
    throw new GoalError(
      'invalid_name',
      `O nome da meta deve ter entre 2 e ${GOAL_NAME_MAX_LENGTH} caracteres.`,
    );
  }
  const description = input.description?.trim() ?? '';
  if (description.length > GOAL_DESCRIPTION_MAX_LENGTH) {
    throw new GoalError(
      'invalid_description',
      `A descrição pode ter até ${GOAL_DESCRIPTION_MAX_LENGTH} caracteres.`,
    );
  }
  if (!input.targetAmount.isPositive() || input.targetAmount.greaterThan(MAX_GOAL_AMOUNT)) {
    throw new GoalError('invalid_amount', 'Informe um valor desejado maior que zero.');
  }
  if (input.targetDate !== null && input.targetDate <= input.startDate) {
    throw new GoalError('invalid_dates', 'A data final deve ser posterior à data inicial.');
  }
  if (input.accountId !== null) await assertAccount(context, input.accountId, currentAccountId);
  return { ...input, name, description: description === '' ? null : description };
}

export class CreateGoalUseCase {
  constructor(private readonly context: GoalContext) {}

  async execute(input: GoalInput): Promise<Goal> {
    const normalized = await normalizeInput(this.context, input);
    const goal: Goal = { id: this.context.newId(), ...normalized, status: 'active' };
    await this.context.goals.save(goal);
    await this.context.audit.append([
      audit(
        this.context,
        goal.id,
        'created',
        `Meta criada: ${formatMoney(goal.targetAmount)}${goal.targetDate ? ` até ${formatDateBR(goal.targetDate)}` : ''}.`,
      ),
    ]);
    return goal;
  }
}

export class UpdateGoalUseCase {
  constructor(private readonly context: GoalContext) {}

  async execute(id: string, input: GoalInput): Promise<void> {
    const current = await loadGoal(this.context, id);
    const normalized = await normalizeInput(this.context, input, current.accountId);
    await this.context.goals.save({ ...current, ...normalized });
    const changes: string[] = [];
    if (!current.targetAmount.equals(normalized.targetAmount)) {
      changes.push(
        `valor de ${formatMoney(current.targetAmount)} para ${formatMoney(normalized.targetAmount)}`,
      );
    }
    if (current.targetDate !== normalized.targetDate) {
      const format = (date: IsoDate | null) => (date ? formatDateBR(date) : 'sem prazo');
      changes.push(`prazo de ${format(current.targetDate)} para ${format(normalized.targetDate)}`);
    }
    await this.context.audit.append([
      audit(
        this.context,
        id,
        'updated',
        changes.length > 0 ? `Alterado: ${changes.join('; ')}.` : 'Dados da meta alterados.',
      ),
    ]);
  }
}

/** Conclui, cancela ou reativa (o progresso e os aportes são preservados). */
export class SetGoalStatusUseCase {
  constructor(private readonly context: GoalContext) {}

  async execute(id: string, status: GoalStatus): Promise<void> {
    const current = await loadGoal(this.context, id);
    if (current.status === status) return;
    await this.context.goals.save({ ...current, status });
    const action: AuditEntry['action'] =
      status === 'active' ? 'restored' : status === 'cancelled' ? 'cancelled' : 'updated';
    await this.context.audit.append([
      audit(this.context, id, action, `Situação alterada para "${GOAL_STATUS_LABELS[status]}".`),
    ]);
  }
}

/** Exclusão definitiva só sem aportes; caso contrário, cancele a meta. */
export class DeleteGoalUseCase {
  constructor(private readonly context: GoalContext) {}

  async execute(id: string): Promise<void> {
    const current = await loadGoal(this.context, id);
    const contributions = await this.context.goals.findContributions();
    if (contributions.some((item) => item.goalId === id)) {
      throw new GoalError(
        'goal_in_use',
        'Esta meta possui aportes e não pode ser excluída. Cancele-a para preservar o histórico.',
      );
    }
    await this.context.goals.remove(id);
    await this.context.audit.append([
      audit(this.context, id, 'deleted', `Excluída: ${current.name}.`),
    ]);
  }
}

/**
 * Registra aporte ou retirada. Opcionalmente cria a transferência entre a conta
 * informada e a conta da meta. A transferência é gravada primeiro; se o aporte
 * falhar, ela é desfeita (compensação — o backend deve fazer as duas gravações
 * na mesma transação).
 */
export class AddContributionUseCase {
  constructor(private readonly context: GoalContext) {}

  async execute(input: ContributionInput): Promise<GoalContribution> {
    const goal = await loadGoal(this.context, input.goalId);
    if (goal.status !== 'active') {
      throw new GoalError('goal_not_active', 'Reative a meta para registrar aportes ou retiradas.');
    }
    if (!input.amount.isPositive() || input.amount.greaterThan(MAX_GOAL_AMOUNT)) {
      throw new GoalError('invalid_amount', 'Informe um valor maior que zero.');
    }
    if (input.date > this.context.today()) {
      throw new GoalError('contribution_in_future', 'A data não pode ser futura.');
    }
    if (input.date < goal.startDate) {
      throw new GoalError(
        'contribution_before_start',
        `A data não pode ser anterior ao início da meta (${formatDateBR(goal.startDate)}).`,
      );
    }
    const contributions = await this.context.goals.findContributions();
    if (input.type === 'withdrawal') {
      const { accumulated } = computeGoalProgress(goal, contributions, input.date);
      const candidate = { ...input, id: '', goalId: goal.id, transferId: null };
      if (
        input.amount.greaterThan(accumulated) ||
        goesNegative(goal.id, [...contributions, candidate])
      ) {
        throw new GoalError(
          'insufficient_balance',
          `A retirada excede o acumulado na data (${formatMoney(accumulated)}).`,
        );
      }
    }

    let transferId: string | null = null;
    if (input.counterpartAccountId !== null) {
      if (goal.accountId === null) {
        throw new GoalError(
          'transfer_requires_account',
          'Defina a conta da meta para registrar a transferência.',
        );
      }
      if (input.counterpartAccountId === goal.accountId) {
        throw new GoalError('same_account', 'Escolha uma conta diferente da conta da meta.');
      }
      await assertAccount(this.context, input.counterpartAccountId);
      const deposit = input.type === 'deposit';
      transferId = await this.context.transfers.create({
        fromAccountId: deposit ? input.counterpartAccountId : goal.accountId,
        toAccountId: deposit ? goal.accountId : input.counterpartAccountId,
        amount: input.amount,
        date: input.date,
        description: `${deposit ? 'Aporte na meta' : 'Retirada da meta'} "${goal.name}"`,
      });
    }

    const contribution: GoalContribution = {
      id: this.context.newId(),
      goalId: goal.id,
      date: input.date,
      amount: input.amount,
      type: input.type,
      transferId,
    };
    try {
      await this.context.goals.saveContribution(contribution);
    } catch (error) {
      if (transferId !== null) await this.context.transfers.remove(transferId);
      throw error;
    }
    await this.context.audit.append([
      audit(
        this.context,
        goal.id,
        'created',
        `${input.type === 'deposit' ? 'Aporte' : 'Retirada'} de ${formatMoney(input.amount)} em ${formatDateBR(input.date)}${transferId ? ' (com transferência entre contas)' : ''}.`,
      ),
    ]);
    return contribution;
  }
}

/** Exclui um aporte/retirada e, se houver, a transferência registrada junto. */
export class RemoveContributionUseCase {
  constructor(private readonly context: GoalContext) {}

  async execute(id: string): Promise<void> {
    const contribution = (await this.context.goals.findContributions()).find(
      (item) => item.id === id,
    );
    if (!contribution) {
      throw new GoalError('contribution_not_found', 'Aporte não encontrado.');
    }
    const goal = await loadGoal(this.context, contribution.goalId);
    const others = (await this.context.goals.findContributions()).filter((item) => item.id !== id);
    // Excluir um aporte não pode deixar retiradas posteriores sem saldo.
    if (contribution.type === 'deposit' && goesNegative(goal.id, others)) {
      throw new GoalError(
        'insufficient_balance',
        'Há retiradas que dependem deste aporte. Exclua-as antes.',
      );
    }
    await this.context.goals.removeContribution(id);
    if (contribution.transferId !== null) {
      await this.context.transfers.remove(contribution.transferId);
    }
    await this.context.audit.append([
      audit(
        this.context,
        goal.id,
        'deleted',
        `${contribution.type === 'deposit' ? 'Aporte' : 'Retirada'} de ${formatMoney(contribution.amount)} (${formatDateBR(contribution.date)}) excluído.`,
      ),
    ]);
  }
}

/** Saldo da meta fica negativo em algum momento (aportes antes de retiradas no mesmo dia)? */
function goesNegative(goalId: string, contributions: readonly GoalContribution[]): boolean {
  const ordered = contributions
    .filter((item) => item.goalId === goalId)
    .sort((x, y) =>
      x.date === y.date
        ? Number(x.type === 'withdrawal') - Number(y.type === 'withdrawal')
        : x.date < y.date
          ? -1
          : 1,
    );
  let total = Money.zero();
  for (const item of ordered) {
    total = item.type === 'deposit' ? total.add(item.amount) : total.subtract(item.amount);
    if (total.isNegative()) return true;
  }
  return false;
}

export interface GoalView {
  progress: GoalProgress;
  projection: GoalProjection;
  accountName: string | null;
}

export interface GoalsOverview {
  goals: GoalView[];
  /** Totais das metas em andamento. */
  totalTarget: Money;
  totalAccumulated: Money;
  totalRemaining: Money;
  /** Soma dos aportes mensais necessários (metas com prazo). */
  totalMonthlyRequired: Money;
}

const STATUS_ORDER: Record<GoalStatus, number> = { active: 0, completed: 1, cancelled: 2 };
const PRIORITY_ORDER: Record<GoalPriority, number> = { high: 0, medium: 1, low: 2 };

export class ListGoalsUseCase {
  constructor(private readonly context: GoalContext) {}

  async execute(): Promise<GoalsOverview> {
    const [goals, contributions, accounts] = await Promise.all([
      this.context.goals.findAll(),
      this.context.goals.findContributions(),
      this.context.accounts.findAll(),
    ]);
    const today = this.context.today();
    const accountName = new Map(accounts.map((item) => [item.id, item.name]));
    const views = goals
      .map((goal): GoalView => {
        const progress = computeGoalProgress(goal, contributions, today);
        return {
          progress,
          projection: projectGoal(progress, contributions, today),
          accountName: goal.accountId ? (accountName.get(goal.accountId) ?? null) : null,
        };
      })
      .sort(
        (a, b) =>
          STATUS_ORDER[a.progress.goal.status] - STATUS_ORDER[b.progress.goal.status] ||
          PRIORITY_ORDER[a.progress.goal.priority] - PRIORITY_ORDER[b.progress.goal.priority] ||
          a.progress.goal.name.localeCompare(b.progress.goal.name, 'pt-BR'),
      );
    const active = views.filter((view) => view.progress.goal.status === 'active');
    return {
      goals: views,
      totalTarget: Money.sum(active.map((view) => view.progress.goal.targetAmount)),
      totalAccumulated: Money.sum(active.map((view) => view.progress.accumulated)),
      totalRemaining: Money.sum(active.map((view) => view.progress.remaining)),
      totalMonthlyRequired: Money.sum(
        active.flatMap((view) =>
          view.progress.monthlyRequired ? [view.progress.monthlyRequired] : [],
        ),
      ),
    };
  }
}

export interface GoalDetails {
  view: GoalView;
  /** Mais recentes primeiro. */
  contributions: GoalContribution[];
  /** Contas ativas para aportes com transferência. */
  accounts: Pick<Account, 'id' | 'name'>[];
}

export class GetGoalDetailsUseCase {
  constructor(private readonly context: GoalContext) {}

  async execute(id: string): Promise<GoalDetails> {
    const goal = await loadGoal(this.context, id);
    const [contributions, accounts] = await Promise.all([
      this.context.goals.findContributions(),
      this.context.accounts.findAll(),
    ]);
    const today = this.context.today();
    const progress = computeGoalProgress(goal, contributions, today);
    return {
      view: {
        progress,
        projection: projectGoal(progress, contributions, today),
        accountName: goal.accountId
          ? (accounts.find((item) => item.id === goal.accountId)?.name ?? null)
          : null,
      },
      contributions: contributions
        .filter((item) => item.goalId === id)
        .sort((a, b) => (a.date === b.date ? b.id.localeCompare(a.id) : a.date < b.date ? 1 : -1)),
      accounts: accounts
        .filter((item) => !item.archived)
        .map(({ id: accountId, name }) => ({
          id: accountId,
          name,
        })),
    };
  }
}

export interface GoalUseCases {
  list: ListGoalsUseCase;
  details: GetGoalDetailsUseCase;
  create: CreateGoalUseCase;
  update: UpdateGoalUseCase;
  setStatus: SetGoalStatusUseCase;
  remove: DeleteGoalUseCase;
  addContribution: AddContributionUseCase;
  removeContribution: RemoveContributionUseCase;
}

export function createGoalUseCases(context: GoalContext): GoalUseCases {
  return {
    list: new ListGoalsUseCase(context),
    details: new GetGoalDetailsUseCase(context),
    create: new CreateGoalUseCase(context),
    update: new UpdateGoalUseCase(context),
    setStatus: new SetGoalStatusUseCase(context),
    remove: new DeleteGoalUseCase(context),
    addContribution: new AddContributionUseCase(context),
    removeContribution: new RemoveContributionUseCase(context),
  };
}
