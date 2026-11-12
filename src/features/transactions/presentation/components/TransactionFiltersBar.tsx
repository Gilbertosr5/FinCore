import { Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { MonthNavigator } from '@/components/data-display/MonthNavigator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { MonthKey } from '@/lib/dates';

import { KIND_LABELS, SORT_LABELS, STATUS_LABELS } from './transaction-labels';
import type { Category } from '../../domain/entities/category';
import type { TransactionFilterState } from '../hooks/use-transaction-filters';

const ALL = 'all';
const KINDS = ['income', 'expense', 'transfer', 'card_payment', 'investment'] as const;
const STATUSES = ['pending', 'paid', 'cancelled'] as const;
const SORTS = ['date_desc', 'date_asc', 'amount_desc', 'amount_asc'] as const;

interface TransactionFiltersBarProps {
  state: TransactionFilterState;
  currentMonth: MonthKey;
  accounts: { id: string; name: string }[];
  categories: Category[];
  onChange: (changes: Partial<TransactionFilterState>) => void;
}

function FilterSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | null;
  options: { value: T; label: string }[];
  onChange: (value: T | null) => void;
}) {
  return (
    <Select
      value={value ?? ALL}
      onValueChange={(next) => {
        onChange(options.find((option) => option.value === next)?.value ?? null);
      }}
    >
      <SelectTrigger aria-label={label} className="h-9 w-full sm:w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{label}: todos</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function TransactionFiltersBar({
  state,
  currentMonth,
  accounts,
  categories,
  onChange,
}: TransactionFiltersBarProps) {
  const [search, setSearch] = useState(state.search);

  // Busca com atraso curto para não recalcular a cada tecla.
  useEffect(() => {
    if (search === state.search) return;
    const timer = setTimeout(() => {
      onChange({ search });
    }, 300);
    return () => {
      clearTimeout(timer);
    };
  }, [search, state.search, onChange]);

  const hasFilters = Boolean(
    state.kind ?? state.status ?? state.categoryId ?? state.accountId ?? (state.search || null),
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthNavigator
          month={state.month}
          currentMonth={currentMonth}
          onChange={(month) => {
            onChange({ month });
          }}
        />
        <div className="relative w-full sm:w-72">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            aria-label="Pesquisar lançamentos"
            placeholder="Pesquisar descrição, categoria ou tag"
            className="h-9 pl-9"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
            }}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <FilterSelect
          label="Tipo"
          value={state.kind}
          options={KINDS.map((value) => ({ value, label: KIND_LABELS[value] }))}
          onChange={(kind) => {
            onChange({ kind });
          }}
        />
        <FilterSelect
          label="Situação"
          value={state.status}
          options={STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] }))}
          onChange={(status) => {
            onChange({ status });
          }}
        />
        <FilterSelect
          label="Categoria"
          value={state.categoryId}
          options={categories.map((category) => ({
            value: category.id,
            label: `${category.name} (${category.kind === 'income' ? 'receita' : 'despesa'})`,
          }))}
          onChange={(categoryId) => {
            onChange({ categoryId });
          }}
        />
        <FilterSelect
          label="Conta"
          value={state.accountId}
          options={accounts.map((account) => ({ value: account.id, label: account.name }))}
          onChange={(accountId) => {
            onChange({ accountId });
          }}
        />
        <Select
          value={state.sort}
          onValueChange={(sort) => {
            const next = SORTS.find((option) => option === sort);
            if (next) onChange({ sort: next });
          }}
        >
          <SelectTrigger aria-label="Ordenar por" className="h-9 w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORTS.map((value) => (
              <SelectItem key={value} value={value}>
                {SORT_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch('');
              onChange({ kind: null, status: null, categoryId: null, accountId: null, search: '' });
            }}
          >
            <X aria-hidden="true" />
            Limpar filtros
          </Button>
        )}
      </div>
    </div>
  );
}
