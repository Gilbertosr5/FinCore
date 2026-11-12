import { createContext, useContext } from 'react';

import type { NavigationItem } from '@/constants/navigation';

/** Resultado de busca de uma entidade (lançamento, conta, cartão, meta…). */
export interface SearchResultItem {
  id: string;
  label: string;
  description: string;
  /** Rota de destino. */
  href: string;
  /** Módulo de origem (define o ícone e o agrupamento). */
  module: NavigationItem['id'];
}

/**
 * Fonte de busca de entidades, fornecida pela camada de aplicação. Sem fonte,
 * a busca global pesquisa apenas os módulos.
 */
export interface CommandSearchSource {
  search(term: string): Promise<SearchResultItem[]>;
}

export const CommandSearchSourceContext = createContext<CommandSearchSource | null>(null);

export function useCommandSearchSource(): CommandSearchSource | null {
  return useContext(CommandSearchSourceContext);
}
