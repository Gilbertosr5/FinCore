import { CircleAlert } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAccountSummaries } from '@/features/accounts';
import { getErrorMessage } from '@/lib/errors';

import { EntryForm } from './EntryForm';
import { TransferForm } from './TransferForm';
import type { Transaction } from '../../domain/entities/transaction';
import { useTransactionsServices } from '../context/transactions-context';
import {
  useCategories,
  useCreateEntry,
  useCreateTransfer,
  useUpdateEntry,
  useUpdateTransfer,
} from '../hooks/use-transactions';
import {
  emptyEntryValues,
  entryValuesFrom,
  toEntryInput,
  toRepetition,
  toTransferInput,
  type TransferFormValues,
} from '../schemas/transaction-form.schema';

export type TransactionFormMode =
  | { type: 'create'; kind: 'expense' | 'income' | 'transfer'; accountId?: string }
  | { type: 'edit'; transaction: Transaction }
  | { type: 'duplicate'; transaction: Transaction };

interface TransactionFormDialogProps {
  mode: TransactionFormMode | null;
  onClose: () => void;
}

const TITLES = {
  expense: 'Nova despesa',
  income: 'Nova receita',
  transfer: 'Nova transferência',
};

/** Diálogo único para criar, editar e duplicar lançamentos e transferências. */
export function TransactionFormDialog({ mode, onClose }: TransactionFormDialogProps) {
  return (
    <Dialog
      open={mode !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {mode && (
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
          <FormBody mode={mode} onClose={onClose} />
        </DialogContent>
      )}
    </Dialog>
  );
}

function FormBody({ mode, onClose }: { mode: TransactionFormMode; onClose: () => void }) {
  const { today } = useTransactionsServices();
  const accounts = useAccountSummaries();
  const categories = useCategories();
  const createEntry = useCreateEntry();
  const updateEntry = useUpdateEntry();
  const createTransfer = useCreateTransfer();
  const updateTransfer = useUpdateTransfer();
  const [error, setError] = useState<string | null>(null);

  const transaction = mode.type === 'create' ? null : mode.transaction;
  const isTransfer =
    mode.type === 'create' ? mode.kind === 'transfer' : transaction?.kind === 'transfer';
  const editing = mode.type === 'edit';

  // Contas arquivadas não aparecem, exceto a do próprio lançamento em edição.
  const accountOptions = (accounts.data ?? [])
    .filter(
      (item) =>
        !item.account.archived ||
        (editing &&
          (item.account.id === transaction?.accountId ||
            item.account.id === transaction?.transfer?.counterpartAccountId)),
    )
    .map((item) => ({ id: item.account.id, name: item.account.name }));

  const title = editing
    ? isTransfer
      ? 'Editar transferência'
      : 'Editar lançamento'
    : mode.type === 'duplicate'
      ? 'Duplicar lançamento'
      : TITLES[mode.kind];

  const done = (message: string) => {
    toast.success(message);
    onClose();
  };
  const fail = (cause: unknown) => {
    setError(getErrorMessage(cause));
  };

  const body = (() => {
    if (accounts.isPending || categories.isPending) {
      return <p className="text-sm text-muted-foreground">Carregando…</p>;
    }
    if (isTransfer) {
      const legOut = transaction?.transfer?.direction === 'out' ? transaction : null;
      const defaults: TransferFormValues = transaction
        ? {
            fromAccountId: legOut
              ? transaction.accountId
              : (transaction.transfer?.counterpartAccountId ?? ''),
            toAccountId: legOut
              ? (transaction.transfer?.counterpartAccountId ?? '')
              : transaction.accountId,
            amount: transaction.amount.toString().replace('.', ','),
            date: editing ? transaction.competenceDate : today(),
            description: transaction.description,
            notes: transaction.notes ?? '',
          }
        : {
            fromAccountId: mode.type === 'create' ? (mode.accountId ?? '') : '',
            toAccountId: '',
            amount: '',
            date: today(),
            description: '',
            notes: '',
          };
      return (
        <TransferForm
          defaultValues={defaults}
          accounts={accountOptions}
          editing={editing}
          pending={createTransfer.isPending || updateTransfer.isPending}
          onCancel={onClose}
          onSubmit={(values) => {
            setError(null);
            const input = toTransferInput(values);
            if (editing && transaction?.transfer) {
              updateTransfer.mutate(
                { transferId: transaction.transfer.id, input },
                {
                  onSuccess: () => {
                    done('Transferência atualizada.');
                  },
                  onError: fail,
                },
              );
            } else {
              createTransfer.mutate(input, {
                onSuccess: () => {
                  done('Transferência registrada.');
                },
                onError: fail,
              });
            }
          }}
        />
      );
    }

    const defaults = transaction
      ? entryValuesFrom(transaction, today(), editing ? 'edit' : 'duplicate')
      : emptyEntryValues(
          mode.type === 'create' && mode.kind === 'income' ? 'income' : 'expense',
          today(),
          mode.type === 'create' ? mode.accountId : undefined,
        );
    return (
      <EntryForm
        defaultValues={defaults}
        accounts={accountOptions}
        categories={categories.data ?? []}
        editing={editing}
        isSeries={Boolean(transaction?.installment ?? transaction?.recurrenceId)}
        pending={createEntry.isPending || updateEntry.isPending}
        onCancel={onClose}
        onSubmit={(values, scope) => {
          setError(null);
          const input = toEntryInput(values);
          if (editing && transaction) {
            updateEntry.mutate(
              { id: transaction.id, input, scope },
              {
                onSuccess: () => {
                  done('Lançamento atualizado.');
                },
                onError: fail,
              },
            );
          } else {
            createEntry.mutate(
              { input, repetition: toRepetition(values) },
              {
                onSuccess: (ids) => {
                  done(
                    ids.length > 1 ? `${ids.length} lançamentos criados.` : 'Lançamento criado.',
                  );
                },
                onError: fail,
              },
            );
          }
        }}
      />
    );
  })();

  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          {isTransfer
            ? 'Movimenta dinheiro entre suas contas sem afetar receitas e despesas.'
            : 'Campos obrigatórios: descrição, valor, data, conta e categoria.'}
        </DialogDescription>
      </DialogHeader>
      {error && (
        <Alert variant="destructive">
          <CircleAlert aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {body}
    </>
  );
}
