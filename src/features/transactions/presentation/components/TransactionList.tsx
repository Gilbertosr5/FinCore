import {
  Ban,
  CheckCircle2,
  Copy,
  Eye,
  MoreHorizontal,
  Pencil,
  Repeat,
  RotateCcw,
  Trash2,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDateBR } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';

import { KIND_LABELS, statusLabel } from './transaction-labels';
import type { TransactionView } from '../../application/list-transactions';
import type { Transaction } from '../../domain/entities/transaction';

export type TransactionAction =
  'details' | 'edit' | 'duplicate' | 'pay' | 'unpay' | 'cancel' | 'restore' | 'delete';

interface TransactionListProps {
  items: TransactionView[];
  onAction: (action: TransactionAction, view: TransactionView) => void;
}

/** Lançamentos de cartão e investimento são somente leitura neste módulo. */
const isManaged = (tx: Transaction) => tx.kind === 'card_payment' || tx.kind === 'investment';

function signedAmount(view: TransactionView): { text: string; className: string } {
  const tx = view.transaction;
  const inflow =
    tx.kind === 'income' ||
    tx.transfer?.direction === 'in' ||
    tx.investment?.direction === 'redemption';
  const neutral = tx.kind === 'transfer' || tx.kind === 'investment';
  return {
    text: inflow
      ? formatMoney(tx.amount, { signDisplay: 'always' })
      : formatMoney(tx.amount.negate()),
    className: cn(
      'font-semibold whitespace-nowrap tabular-nums',
      tx.status === 'cancelled' && 'text-muted-foreground line-through',
      tx.status !== 'cancelled' && !neutral && inflow && 'text-success',
    ),
  };
}

function StatusBadge({ view }: { view: TransactionView }) {
  const { kind, status } = view.transaction;
  const variant =
    status === 'paid'
      ? 'success'
      : status === 'cancelled'
        ? 'outline'
        : view.overdue
          ? 'destructive'
          : 'warning';
  return <Badge variant={variant}>{statusLabel(kind, status, view.overdue)}</Badge>;
}

function SeriesBadges({ transaction }: { transaction: Transaction }) {
  return (
    <>
      {transaction.installment && (
        <Badge variant="secondary">
          {transaction.installment.number}/{transaction.installment.total}
        </Badge>
      )}
      {transaction.recurrenceId && (
        <Badge variant="secondary" title="Lançamento recorrente">
          <Repeat aria-hidden="true" />
          <span className="sr-only">Recorrente</span>
        </Badge>
      )}
    </>
  );
}

function ActionsMenu({
  view,
  onAction,
}: {
  view: TransactionView;
  onAction: TransactionListProps['onAction'];
}) {
  const tx = view.transaction;
  const managed = isManaged(tx);
  const item = (
    action: TransactionAction,
    label: string,
    Icon: typeof Eye,
    destructive = false,
  ) => (
    <DropdownMenuItem
      variant={destructive ? 'destructive' : 'default'}
      onSelect={() => {
        onAction(action, view);
      }}
    >
      <Icon aria-hidden="true" />
      {label}
    </DropdownMenuItem>
  );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Ações de ${tx.description}`}>
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {item('details', 'Ver detalhes', Eye)}
        {!managed && (
          <>
            {tx.status !== 'cancelled' && item('edit', 'Editar', Pencil)}
            {tx.kind !== 'transfer' && item('duplicate', 'Duplicar', Copy)}
            {tx.status === 'pending' &&
              item(
                'pay',
                tx.kind === 'income' ? 'Marcar como recebido' : 'Marcar como pago',
                CheckCircle2,
              )}
            {tx.status === 'paid' && item('unpay', 'Desfazer pagamento', RotateCcw)}
            {tx.status === 'cancelled'
              ? item('restore', 'Reativar', RotateCcw)
              : item('cancel', 'Cancelar', Ban)}
            <DropdownMenuSeparator />
            {item('delete', 'Excluir', Trash2, true)}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function subtitle(view: TransactionView): string {
  const tx = view.transaction;
  const parts = [
    KIND_LABELS[tx.kind],
    view.categoryName,
    tx.transfer
      ? `${view.accountName} ${tx.transfer.direction === 'out' ? '→' : '←'} ${view.counterpartAccountName ?? 'outra conta'}`
      : view.accountName,
  ];
  return parts.filter(Boolean).join(' · ');
}

/** Tabela no desktop e cartões empilhados no celular — mesmas ações nas duas. */
export function TransactionList({ items, onAction }: TransactionListProps) {
  return (
    <>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Conta</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Ações</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((view) => {
              const tx = view.transaction;
              const amount = signedAmount(view);
              return (
                <TableRow key={tx.id}>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {formatDateBR(tx.competenceDate)}
                  </TableCell>
                  <TableCell className="max-w-72">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="truncate text-left font-medium hover:underline focus-visible:underline focus-visible:outline-none"
                        onClick={() => {
                          onAction('details', view);
                        }}
                      >
                        {tx.description}
                      </button>
                      <SeriesBadges transaction={tx} />
                    </div>
                    <span className="text-xs text-muted-foreground">{KIND_LABELS[tx.kind]}</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {view.categoryName ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {tx.transfer
                      ? `${view.accountName} ${tx.transfer.direction === 'out' ? '→' : '←'} ${view.counterpartAccountName ?? ''}`
                      : view.accountName}
                  </TableCell>
                  <TableCell>
                    <StatusBadge view={view} />
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={amount.className}>{amount.text}</span>
                  </TableCell>
                  <TableCell>
                    <ActionsMenu view={view} onAction={onAction} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <ul className="flex flex-col divide-y divide-border md:hidden">
        {items.map((view) => {
          const tx = view.transaction;
          const amount = signedAmount(view);
          return (
            <li key={tx.id} className="flex items-start gap-2 py-3">
              <button
                type="button"
                className="flex min-w-0 flex-1 flex-col items-start gap-1 text-left"
                onClick={() => {
                  onAction('details', view);
                }}
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="truncate font-medium">{tx.description}</span>
                  <span className={amount.className}>{amount.text}</span>
                </span>
                <span className="truncate text-xs text-muted-foreground">{subtitle(view)}</span>
                <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  {formatDateBR(tx.competenceDate)}
                  <StatusBadge view={view} />
                  <SeriesBadges transaction={tx} />
                </span>
              </button>
              <ActionsMenu view={view} onAction={onAction} />
            </li>
          );
        })}
      </ul>
    </>
  );
}
