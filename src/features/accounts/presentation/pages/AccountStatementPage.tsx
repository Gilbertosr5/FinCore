import { ChevronRight, CloudOff, Inbox, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';

import { MonthNavigator } from '@/components/data-display/MonthNavigator';
import { EmptyState } from '@/components/feedback/EmptyState';
import { StatusScreen } from '@/components/feedback/StatusScreen';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ROUTES } from '@/constants/routes';
import { TransactionFormDialog, type TransactionFormMode } from '@/features/transactions';
import { formatDateBR, isMonthKey, monthEnd, monthStart, toMonthKey } from '@/lib/dates';
import { getErrorMessage } from '@/lib/errors';
import { formatMoney, type Money } from '@/lib/money';
import { cn } from '@/lib/utils';

import { ACCOUNT_TYPE_LABELS } from '../../domain/entities/account';
import { useAccountsServices } from '../context/accounts-context';
import { useAccountStatement } from '../hooks/use-accounts';

const signed = (value: Money) =>
  value.isPositive() ? formatMoney(value, { signDisplay: 'always' }) : formatMoney(value);

/** Extrato da conta: saldo de abertura, movimentações liquidadas e saldo acumulado. */
export function AccountStatementPage() {
  const { accountId = '' } = useParams();
  const { today } = useAccountsServices();
  const [params, setParams] = useSearchParams();
  const requested = params.get('mes') ?? '';
  const month = isMonthKey(requested) ? requested : toMonthKey(today());
  const statement = useAccountStatement(accountId, monthStart(month), monthEnd(month));
  const [form, setForm] = useState<TransactionFormMode | null>(null);

  const data = statement.data;

  return (
    <div className="flex flex-col gap-6">
      <nav
        aria-label="Trilha de navegação"
        className="flex items-center gap-1 text-sm text-muted-foreground"
      >
        <Link to={ROUTES.accounts} className="hover:text-foreground hover:underline">
          Contas
        </Link>
        <ChevronRight aria-hidden="true" className="size-4" />
        <span aria-current="page" className="font-medium text-foreground">
          {data?.account.name ?? 'Extrato'}
        </span>
      </nav>

      {statement.isError ? (
        <StatusScreen
          tone="destructive"
          icon={CloudOff}
          title="Não foi possível carregar o extrato"
          description={getErrorMessage(statement.error)}
          actions={
            <Button asChild variant="outline">
              <Link to={ROUTES.accounts}>Voltar às contas</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              {data ? (
                <h2 className="text-xl font-semibold tracking-tight">
                  Extrato — {data.account.name}
                </h2>
              ) : (
                <Skeleton className="h-7 w-56" />
              )}
              {data && (
                <p className="text-sm text-muted-foreground">
                  {[ACCOUNT_TYPE_LABELS[data.account.type], data.account.institution]
                    .filter(Boolean)
                    .join(' · ')}
                  {data.account.archived && ' · arquivada'}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <MonthNavigator
                month={month}
                currentMonth={toMonthKey(today())}
                onChange={(next) => {
                  setParams({ mes: next }, { replace: true });
                }}
              />
              {data && !data.account.archived && (
                <Button
                  onClick={() => {
                    setForm({ type: 'create', kind: 'expense', accountId });
                  }}
                >
                  <Plus aria-hidden="true" />
                  Lançamento
                </Button>
              )}
            </div>
          </div>

          <section
            aria-label="Resumo do período"
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            {(
              [
                ['Saldo inicial do período', data?.openingBalance],
                ['Entradas', data?.totalIn],
                ['Saídas', data?.totalOut],
                ['Saldo final', data?.closingBalance],
              ] as const
            ).map(([label, value]) => (
              <Card key={label} className="gap-1 py-3">
                <CardContent className="flex flex-col gap-1 px-4">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  {value ? (
                    <span
                      className={cn(
                        'text-lg font-semibold tabular-nums',
                        value.isNegative() && 'text-destructive',
                      )}
                    >
                      {formatMoney(value)}
                    </span>
                  ) : (
                    <Skeleton className="h-6 w-28" />
                  )}
                </CardContent>
              </Card>
            ))}
          </section>

          <Card className="gap-3">
            <CardHeader>
              <CardTitle>Movimentações liquidadas</CardTitle>
            </CardHeader>
            <CardContent>
              {!data ? (
                <Skeleton className="h-40 w-full" />
              ) : data.lines.length === 0 ? (
                <EmptyState icon={Inbox} title="Nenhuma movimentação liquidada no mês" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.lines.map((line) => (
                      <TableRow key={line.transaction.id}>
                        <TableCell className="whitespace-nowrap tabular-nums">
                          {line.transaction.paidDate
                            ? formatDateBR(line.transaction.paidDate)
                            : '—'}
                        </TableCell>
                        <TableCell className="max-w-80 truncate">
                          {line.transaction.description}
                        </TableCell>
                        <TableCell
                          className={cn(
                            'text-right font-medium whitespace-nowrap tabular-nums',
                            line.effect.isPositive() && 'text-success',
                          )}
                        >
                          {signed(line.effect)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            'text-right whitespace-nowrap tabular-nums',
                            line.balance.isNegative() && 'text-destructive',
                          )}
                        >
                          {formatMoney(line.balance)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {data && data.pending.length > 0 && (
            <Card className="gap-3">
              <CardHeader>
                <CardTitle>Pendentes no mês</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col divide-y divide-border">
                  {data.pending.map((tx) => (
                    <li
                      key={tx.id}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate">{tx.description}</span>
                        <Badge variant="warning">
                          {tx.kind === 'income' ? 'A receber' : 'A pagar'}
                        </Badge>
                      </span>
                      <span className="flex shrink-0 items-center gap-3 tabular-nums">
                        <span className="text-xs text-muted-foreground">
                          {formatDateBR(tx.dueDate ?? tx.competenceDate)}
                        </span>
                        <span className="font-medium">{formatMoney(tx.amount)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <TransactionFormDialog
        mode={form}
        onClose={() => {
          setForm(null);
        }}
      />
    </div>
  );
}
