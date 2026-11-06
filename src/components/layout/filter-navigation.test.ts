import { NAVIGATION_ITEMS } from '@/constants/navigation';

import { filterNavigation } from './filter-navigation';

describe('filterNavigation', () => {
  it('retorna todos os módulos sem termo de busca', () => {
    expect(filterNavigation('  ')).toBe(NAVIGATION_ITEMS);
  });

  it('ignora acentos e maiúsculas', () => {
    expect(filterNavigation('ORCAMENTO').map((item) => item.id)).toEqual(['budgets']);
  });

  it('pesquisa também na descrição', () => {
    expect(filterNavigation('fatura').map((item) => item.id)).toEqual(['credit-cards']);
  });

  it('retorna lista vazia quando nada corresponde', () => {
    expect(filterNavigation('xyzw')).toEqual([]);
  });
});
