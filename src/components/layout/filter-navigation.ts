import { NAVIGATION_ITEMS, type NavigationItem } from '@/constants/navigation';

/** Remove acentos e normaliza caixa para busca tolerante ("orcamento" encontra "Orçamentos"). */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

export function filterNavigation(query: string): readonly NavigationItem[] {
  const term = normalize(query.trim());
  if (!term) return NAVIGATION_ITEMS;
  return NAVIGATION_ITEMS.filter(
    (item) => normalize(item.label).includes(term) || normalize(item.description).includes(term),
  );
}
