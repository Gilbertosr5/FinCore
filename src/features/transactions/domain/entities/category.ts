export type CategoryKind = 'income' | 'expense';

/** Despesas fixas (aluguel, assinaturas) x variáveis (lazer, compras). */
export type CategoryNature = 'fixed' | 'variable';

export interface Category {
  id: string;
  name: string;
  kind: CategoryKind;
  nature: CategoryNature;
}
