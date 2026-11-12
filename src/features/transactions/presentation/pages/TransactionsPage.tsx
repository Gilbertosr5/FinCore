import { ArrowLeftRight, CloudOff, Inbox, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Pagination } from '@/components/data-display/Pagination';
import { EmptyState } from '@/components/feedback/EmptyState';
import { StatusScreen } from '@/components/feedback/StatusScreen';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { useAccountSummaries } from '@/features/accounts';
import { monthEnd, monthStart, toMonthKey } from '@/lib/dates';
import { getErrorMessage } from '@/lib/errors';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';

import type { TransactionView } from '../../application/list-transactions';
import {
  TransactionActionDialogs,
  type ConfirmableAction,
} from '../components/TransactionActionDialogs';
import { TransactionDetailsSheet } from '../components/TransactionDetailsSheet';
import { TransactionFiltersBar } from '../components/TransactionFiltersBar';
import {
  TransactionFormDialog,
  type TransactionFormMode,
} from '../components/TransactionFormDialog';
import { TransactionList, type TransactionAction } from '../components/TransactionList';
import { useTransactionsServices } from '../context/transactions-context';
import { useTransactionFilters } from '../hooks/use-transaction-filters';
import { useCategories, useMarkAsPending, useTransactionList } from '../hooks/use-transactions';

export function TransactionsPage() {
  const { today } = useTransactionsServices();
  const [filters, setFilters] = useTransactionFilters(today());
  const accounts = useAccountSummaries();
  const categories = useCategories();
  const markAsPending = useMarkAsPending();

  const list = useTransactionList({
    start: monthStart(filters.month),
    end: monthEnd(filters.month),
    kind: filters.kind,
    status: filters.status,
    categoryId: filters.categoryId,
    accountId: filters.accountId,
    search: filters.search,
    sort: filters.sort,
    page: filters.page,
  });

  const [formMode, setFormMode] = useState<TransactionFormMode | null>(null);
  const [details, setDetails] = useState<TransactionView | null>(null);
  const [confirm, setConfirm] = useState<{
    action: ConfirmableAction;
    view: TransactionView;
  } | null>(null);

  const handleAction = (action: TransactionAction, view: TransactionView) => {
    const transaction = view.transaction;
    switch (action) {
      case 'details':
        setDetails(view);
        return;
      case 'edit':
        setFormMode({ type: 'edit', transaction });
        return;
      case 'duplicate':
        setFormMode({ type: 'duplicate', transaction });
        return;
      case 'unpay':
      case 'restore':
        markAsPending.mutate(transaction.id, {
          onSuccess: () => {
            toast.success(action === 'restore' ? 'Lançamento reativado.' : 'Pagamento desfeito.');
          },
          onError: (error) => {
            toast.error(getErrorMessage(error));
          },
        });
        return;
      case 'pay':
      case 'cancel':
      case 'delete':
        setConfirm({ action, view });
        return;
    }
  };

  const accountOptions = (accounts.data ?? []).map((item) => ({
    id: item.account.id,
    name: item.account.archived ? `${item.account.name} (arquivada)` : item.account.name,
  }));

  const totals = list.data?.totals;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Receitas, despesas e transferências das suas contas. Compras no cartão ficam no módulo de
          cartões.
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setFormMode({ type: 'create', kind: 'transfer' });
            }}
          >
            <ArrowLeftRight aria-hidden="true" />
            Transferir
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Plus aria-hidden="true" />
                Novo lançamento
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => {
                  setFormMode({ type: 'create', kind: 'expense' });
                }}
              >
                Despesa
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  setFormMode({ type: 'create', kind: 'income' });
                }}
              >
                Receita
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  setFormMode({ type: 'create', kind: 'transfer' });
                }}
              >
                Transferência
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <TransactionFiltersBar
        state={filters}
        currentMonth={toMonthKey(today())}
        accounts={accountOptions}
        categories={categories.data ?? []}
        onChange={setFilters}
      />

      <section aria-label="Totais do filtro" className="grid gap-3 sm:grid-cols-3">
        {(
          [
            ['Receitas', totals?.income, 'text-success'],
            ['Despesas', totals?.expenses, ''],
            ['Resultado', totals?.result, totals?.result.isNegative() ? 'text-destructive' : ''],
          ] as const
        ).map(([label, value, className]) => (
          <Card key={label} className="gap-1 py-3">
            <CardContent className="flex items-center justify-between gap-2 px-4">
              <span className="text-sm text-muted-foreground">{label}</span>
              {value ? (
                <span className={cn('font-semibold tabular-nums', className)}>
                  {formatMoney(value)}
                </span>
              ) : (
                <Skeleton className="h-5 w-24" />
              )}
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="gap-4 px-4 py-4 md:px-5">
        {list.isPending ? (
          <div role="status" className="flex flex-col gap-3">
            <span className="sr-only">Carregando lançamentos…</span>
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : list.isError ? (
          <StatusScreen
            tone="destructive"
            icon={CloudOff}
            title="Não foi possível carregar os lançamentos"
            description={getErrorMessage(list.error)}
            actions={
              <Button
                onClick={() => {
                  void list.refetch();
                }}
              >
                Tentar novamente
              </Button>
            }
          />
        ) : list.data.items.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="Nenhum lançamento encontrado"
            description="Ajuste os filtros ou registre um novo lançamento."
            action={
              <Button
                size="sm"
                onClick={() => {
                  setFormMode({ type: 'create', kind: 'expense' });
                }}
              >
                <Plus aria-hidden="true" />
                Novo lançamento
              </Button>
            }
          />
        ) : (
          <div
            className="flex flex-col gap-4 transition-opacity data-[stale=true]:opacity-60"
            data-stale={list.isPlaceholderData}
            aria-busy={list.isFetching}
          >
            {list.isFetching && (
              <span role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
                <Spinner className="size-3.5" />
                Atualizando…
              </span>
            )}
            <TransactionList items={list.data.items} onAction={handleAction} />
            <Pagination
              page={list.data.page}
              pageCount={list.data.pageCount}
              total={list.data.total}
              itemLabel={['lançamento', 'lançamentos']}
              onPageChange={(page) => {
                setFilters({ ...filters, page });
              }}
            />
          </div>
        )}
      </Card>

      <TransactionFormDialog
        mode={formMode}
        onClose={() => {
          setFormMode(null);
        }}
      />
      <TransactionDetailsSheet
        view={details}
        onClose={() => {
          setDetails(null);
        }}
      />
      <TransactionActionDialogs
        action={confirm?.action ?? null}
        transaction={confirm?.view.transaction ?? null}
        onClose={() => {
          setConfirm(null);
        }}
      />
    </div>
  );
}
