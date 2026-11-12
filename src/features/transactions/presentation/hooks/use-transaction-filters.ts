import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { isMonthKey, toMonthKey, type IsoDate, type MonthKey } from '@/lib/dates';

import type { TransactionSort } from '../../application/list-transactions';
import type { TransactionKind, TransactionStatus } from '../../domain/entities/transaction';

export interface TransactionFilterState {
  month: MonthKey;
  kind: TransactionKind | null;
  status: TransactionStatus | null;
  categoryId: string | null;
  accountId: string | null;
  search: string;
  sort: TransactionSort;
  page: number;
}

const KINDS: readonly TransactionKind[] = [
  'income',
  'expense',
  'transfer',
  'card_payment',
  'investment',
];
const STATUSES: readonly TransactionStatus[] = ['pending', 'paid', 'cancelled'];
const SORTS: readonly TransactionSort[] = ['date_desc', 'date_asc', 'amount_desc', 'amount_asc'];

const pick = <T extends string>(values: readonly T[], value: string | null): T | null =>
  values.find((item) => item === value) ?? null;

const nonEmpty = (value: string | null): string | null =>
  value !== null && value !== '' ? value : null;

/** Lê os filtros da URL (compartilhável e preservado ao recarregar). */
export function parseTransactionFilters(
  params: URLSearchParams,
  today: IsoDate,
): TransactionFilterState {
  const month = params.get('mes') ?? '';
  const page = Number(params.get('pagina'));
  return {
    month: isMonthKey(month) ? month : toMonthKey(today),
    kind: pick(KINDS, params.get('tipo')),
    status: pick(STATUSES, params.get('situacao')),
    categoryId: nonEmpty(params.get('categoria')),
    accountId: nonEmpty(params.get('conta')),
    search: params.get('q') ?? '',
    sort: pick(SORTS, params.get('ordem')) ?? 'date_desc',
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

export function transactionFiltersToParams(state: TransactionFilterState): Record<string, string> {
  const params: Record<string, string> = { mes: state.month };
  if (state.kind) params.tipo = state.kind;
  if (state.status) params.situacao = state.status;
  if (state.categoryId) params.categoria = state.categoryId;
  if (state.accountId) params.conta = state.accountId;
  if (state.search.trim()) params.q = state.search;
  if (state.sort !== 'date_desc') params.ordem = state.sort;
  if (state.page > 1) params.pagina = String(state.page);
  return params;
}

export function useTransactionFilters(today: IsoDate) {
  const [params, setParams] = useSearchParams();
  const state = useMemo(() => parseTransactionFilters(params, today), [params, today]);
  const update = useCallback(
    (changes: Partial<TransactionFilterState>) => {
      // Qualquer mudança de filtro volta para a primeira página.
      const next = { ...state, page: 1, ...changes };
      setParams(transactionFiltersToParams(next), { replace: true });
    },
    [state, setParams],
  );
  return [state, update] as const;
}
