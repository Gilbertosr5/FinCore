import {
  Archive,
  ArchiveRestore,
  ArrowLeftRight,
  CloudOff,
  FileText,
  Landmark,
  MoreHorizontal,
  Pencil,
  Plus,
  TriangleAlert,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { EmptyState } from '@/components/feedback/EmptyState';
import { StatusScreen } from '@/components/feedback/StatusScreen';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { accountStatementPath } from '@/constants/routes';
import { TransactionFormDialog, type TransactionFormMode } from '@/features/transactions';
import { getErrorMessage } from '@/lib/errors';
import { formatMoney, Money } from '@/lib/money';
import { cn } from '@/lib/utils';

import type { AccountSummary } from '../../application/account-use-cases';
import { ACCOUNT_TYPE_LABELS, type Account } from '../../domain/entities/account';
import { AccountFormDialog } from '../components/AccountFormDialog';
import { useAccountsServices } from '../context/accounts-context';
import { useAccountSummaries, useSetAccountArchived } from '../hooks/use-accounts';

export function AccountsPage() {
  const { today } = useAccountsServices();
  const summaries = useAccountSummaries();
  const setArchived = useSetAccountArchived();
  const [showArchived, setShowArchived] = useState(false);
  const [formTarget, setFormTarget] = useState<Account | 'new' | null>(null);
  const [transactionForm, setTransactionForm] = useState<TransactionFormMode | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<AccountSummary | null>(null);

  const all = summaries.data ?? [];
  const active = all.filter((item) => !item.account.archived);
  const visible = showArchived ? all : active;
  const total = Money.sum(active.map((item) => item.balance));
  const projected = Money.sum(active.map((item) => item.projectedBalance));
  const negativeCount = active.filter((item) => item.balance.isNegative()).length;

  const toggleArchived = (summary: AccountSummary) => {
    const archived = !summary.account.archived;
    setArchived.mutate(
      { id: summary.account.id, archived },
      {
        onSuccess: () => {
          toast.success(archived ? 'Conta arquivada.' : 'Conta restaurada.');
          setArchiveTarget(null);
        },
        onError: (error) => {
          toast.error(getErrorMessage(error));
        },
      },
    );
  };

  if (summaries.isError) {
    return (
      <StatusScreen
        tone="destructive"
        icon={CloudOff}
        title="Não foi possível carregar as contas"
        description={getErrorMessage(summaries.error)}
        actions={
          <Button
            onClick={() => {
              void summaries.refetch();
            }}
          >
            Tentar novamente
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">Saldo total das contas ativas</p>
          {summaries.isPending ? (
            <Skeleton className="h-9 w-48" />
          ) : (
            <p
              className={cn(
                'text-3xl font-semibold tracking-tight tabular-nums',
                total.isNegative() && 'text-destructive',
              )}
            >
              {formatMoney(total)}
            </p>
          )}
          {!summaries.isPending && (
            <p className="text-xs text-muted-foreground">
              Previsto após pendentes: {formatMoney(projected)}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={active.length < 2}
            onClick={() => {
              setTransactionForm({ type: 'create', kind: 'transfer' });
            }}
          >
            <ArrowLeftRight aria-hidden="true" />
            Transferir
          </Button>
          <Button
            onClick={() => {
              setFormTarget('new');
            }}
          >
            <Plus aria-hidden="true" />
            Nova conta
          </Button>
        </div>
      </div>

      {negativeCount > 0 && (
        <p role="status" className="flex items-center gap-2 text-sm text-destructive">
          <TriangleAlert aria-hidden="true" className="size-4" />
          {negativeCount === 1
            ? '1 conta com saldo negativo.'
            : `${negativeCount} contas com saldo negativo.`}
        </p>
      )}

      {all.some((item) => item.account.archived) && (
        <div className="flex items-center gap-2">
          <Checkbox
            id="show-archived"
            checked={showArchived}
            onCheckedChange={(checked) => {
              setShowArchived(checked === true);
            }}
          />
          <Label htmlFor="show-archived">Mostrar contas arquivadas</Label>
        </div>
      )}

      {summaries.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={Landmark}
            title="Nenhuma conta cadastrada"
            description="Cadastre sua primeira conta para começar."
            action={
              <Button
                size="sm"
                onClick={() => {
                  setFormTarget('new');
                }}
              >
                Nova conta
              </Button>
            }
          />
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((summary) => {
            const { account, balance } = summary;
            const negative = balance.isNegative();
            return (
              <li key={account.id}>
                <Card className={cn('h-full gap-3', account.archived && 'opacity-70')}>
                  <CardHeader className="flex-row items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-col gap-1">
                      <CardTitle className="truncate">{account.name}</CardTitle>
                      <p className="truncate text-xs text-muted-foreground">
                        {[ACCOUNT_TYPE_LABELS[account.type], account.institution]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Ações da conta ${account.name}`}
                        >
                          <MoreHorizontal aria-hidden="true" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link to={accountStatementPath(account.id)}>
                            <FileText aria-hidden="true" />
                            Ver extrato
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => {
                            setFormTarget(account);
                          }}
                        >
                          <Pencil aria-hidden="true" />
                          Editar
                        </DropdownMenuItem>
                        {!account.archived && (
                          <DropdownMenuItem
                            onSelect={() => {
                              setTransactionForm({
                                type: 'create',
                                kind: 'expense',
                                accountId: account.id,
                              });
                            }}
                          >
                            <Plus aria-hidden="true" />
                            Novo lançamento
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onSelect={() => {
                            if (account.archived) toggleArchived(summary);
                            else setArchiveTarget(summary);
                          }}
                        >
                          {account.archived ? (
                            <ArchiveRestore aria-hidden="true" />
                          ) : (
                            <Archive aria-hidden="true" />
                          )}
                          {account.archived ? 'Restaurar' : 'Arquivar'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p
                        className={cn(
                          'text-2xl font-semibold tabular-nums',
                          negative && 'text-destructive',
                        )}
                      >
                        {formatMoney(balance)}
                      </p>
                      {negative && <Badge variant="destructive">Saldo negativo</Badge>}
                      {account.archived && <Badge variant="outline">Arquivada</Badge>}
                    </div>
                    <dl className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <dt className="text-muted-foreground">A receber</dt>
                        <dd className="font-medium tabular-nums">
                          {formatMoney(summary.pendingIn)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">A pagar</dt>
                        <dd className="font-medium tabular-nums">
                          {formatMoney(summary.pendingOut)}
                        </dd>
                      </div>
                    </dl>
                    <Button asChild variant="outline" size="sm" className="w-fit">
                      <Link to={accountStatementPath(account.id)}>
                        <FileText aria-hidden="true" />
                        Extrato
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <AccountFormDialog
        target={formTarget}
        today={today()}
        onClose={() => {
          setFormTarget(null);
        }}
      />
      <TransactionFormDialog
        mode={transactionForm}
        onClose={() => {
          setTransactionForm(null);
        }}
      />
      <ConfirmDialog
        open={archiveTarget !== null}
        onOpenChange={(open) => {
          if (!open) setArchiveTarget(null);
        }}
        title="Arquivar conta?"
        description={
          archiveTarget && !archiveTarget.balance.isZero()
            ? `A conta ainda tem saldo de ${formatMoney(archiveTarget.balance)}. Ela sairá dos totais e das seleções, mas o histórico será preservado. Você pode restaurá-la depois.`
            : 'A conta sairá dos totais e das seleções, mas o histórico será preservado. Você pode restaurá-la depois.'
        }
        confirmLabel="Arquivar"
        pending={setArchived.isPending}
        onConfirm={() => {
          if (archiveTarget) toggleArchived(archiveTarget);
        }}
      />
    </div>
  );
}
