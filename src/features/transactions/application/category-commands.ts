import { auditEntry, type LedgerContext } from './ledger-context';
import { normalizeSearch } from './list-transactions';
import type { Category, CategoryKind, CategoryNature } from '../domain/entities/category';
import { TransactionError } from '../domain/errors/transaction-error';

export interface CategoryInput {
  name: string;
  kind: CategoryKind;
  nature: CategoryNature;
}

export const CATEGORY_NAME_MAX_LENGTH = 40;

/** Verifica se uma categoria é usada fora do livro de lançamentos (cartões, orçamentos...). */
export type CategoryUsageChecker = (categoryId: string) => Promise<boolean>;

function normalizeName(name: string): string {
  const normalized = name.trim().replace(/\s+/g, ' ');
  if (normalized.length < 2 || normalized.length > CATEGORY_NAME_MAX_LENGTH) {
    throw new TransactionError(
      'invalid_description',
      `O nome da categoria deve ter entre 2 e ${CATEGORY_NAME_MAX_LENGTH} caracteres.`,
    );
  }
  return normalized;
}

function assertUniqueName(
  categories: readonly Category[],
  input: CategoryInput,
  ignoreId?: string,
) {
  const key = normalizeSearch(input.name);
  const duplicate = categories.some(
    (category) =>
      category.id !== ignoreId &&
      category.kind === input.kind &&
      normalizeSearch(category.name) === key,
  );
  if (duplicate) {
    throw new TransactionError('duplicate_category', 'Já existe uma categoria com este nome.');
  }
}

async function isInUse(
  context: LedgerContext,
  categoryId: string,
  externalCheckers: readonly CategoryUsageChecker[],
): Promise<boolean> {
  const [transactions, recurrences] = await Promise.all([
    context.transactions.findAll(),
    context.transactions.findRecurrences(),
  ]);
  if (transactions.some((tx) => tx.categoryId === categoryId)) return true;
  if (recurrences.some((item) => item.template.categoryId === categoryId)) return true;
  for (const check of externalCheckers) {
    if (await check(categoryId)) return true;
  }
  return false;
}

export class CreateCategoryUseCase {
  constructor(private readonly context: LedgerContext) {}

  async execute(input: CategoryInput): Promise<Category> {
    const name = normalizeName(input.name);
    assertUniqueName(await this.context.categories.findAll(), { ...input, name });
    const category: Category = {
      id: this.context.newId(),
      name,
      kind: input.kind,
      nature: input.nature,
    };
    await this.context.categories.save(category);
    await this.context.audit.append([
      auditEntry(this.context, 'category', category.id, 'created', `Categoria "${name}" criada.`),
    ]);
    return category;
  }
}

export class UpdateCategoryUseCase {
  constructor(
    private readonly context: LedgerContext,
    private readonly externalCheckers: readonly CategoryUsageChecker[] = [],
  ) {}

  async execute(id: string, input: CategoryInput): Promise<void> {
    const categories = await this.context.categories.findAll();
    const current = categories.find((category) => category.id === id);
    if (!current) throw new TransactionError('category_not_found', 'Categoria não encontrada.');
    const name = normalizeName(input.name);
    assertUniqueName(categories, { ...input, name }, id);
    if (input.kind !== current.kind && (await isInUse(this.context, id, this.externalCheckers))) {
      throw new TransactionError(
        'category_in_use',
        'Não é possível mudar o tipo de uma categoria que já possui lançamentos.',
      );
    }
    await this.context.categories.save({
      ...current,
      name,
      kind: input.kind,
      nature: input.nature,
    });
    await this.context.audit.append([
      auditEntry(this.context, 'category', id, 'updated', `Categoria "${name}" alterada.`),
    ]);
  }
}

/** Exclusão permitida apenas para categorias sem nenhum uso (preserva relatórios). */
export class DeleteCategoryUseCase {
  constructor(
    private readonly context: LedgerContext,
    private readonly externalCheckers: readonly CategoryUsageChecker[] = [],
  ) {}

  async execute(id: string): Promise<void> {
    if (await isInUse(this.context, id, this.externalCheckers)) {
      throw new TransactionError(
        'category_in_use',
        'Esta categoria possui lançamentos, compras ou orçamentos e não pode ser excluída.',
      );
    }
    await this.context.categories.remove(id);
    await this.context.audit.append([
      auditEntry(this.context, 'category', id, 'deleted', 'Categoria excluída.'),
    ]);
  }
}
