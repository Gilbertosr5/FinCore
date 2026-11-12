import { useState } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { isIsoDate } from '@/lib/dates';
import { getErrorMessage } from '@/lib/errors';
import { formatMoney } from '@/lib/money';

import type { ChangeScope } from '../../application/entry-commands';
import type { Transaction } from '../../domain/entities/transaction';
import { useTransactionsServices } from '../context/transactions-context';
import {
  useCancelTransaction,
  useDeleteTransaction,
  useMarkAsPaid,
} from '../hooks/use-transactions';

export type ConfirmableAction = 'pay' | 'cancel' | 'delete';

interface TransactionActionDialogsProps {
  action: ConfirmableAction | null;
  transaction: Transaction | null;
  onClose: () => void;
}

function ScopeChoice({
  transaction,
  scope,
  onChange,
}: {
  transaction: Transaction;
  scope: ChangeScope;
  onChange: (scope: ChangeScope) => void;
}) {
  if (!transaction.installment && !transaction.recurrenceId) return null;
  const following = transaction.installment
    ? 'Esta e as próximas parcelas pendentes'
    : 'Esta e as próximas ocorrências (encerra a recorrência)';
  return (
    <RadioGroup
      aria-label="Alcance"
      value={scope}
      onValueChange={(value) => {
        onChange(value === 'following' ? 'following' : 'single');
      }}
      className="gap-2"
    >
      <Label htmlFor="action-scope-single" className="flex items-center gap-2 font-normal">
        <RadioGroupItem id="action-scope-single" value="single" />
        Somente este lançamento
      </Label>
      <Label htmlFor="action-scope-following" className="flex items-center gap-2 font-normal">
        <RadioGroupItem id="action-scope-following" value="following" />
        {following}
      </Label>
    </RadioGroup>
  );
}

/** Confirmações de pagamento, cancelamento e exclusão (com alcance em séries). */
export function TransactionActionDialogs({
  action,
  transaction,
  onClose,
}: TransactionActionDialogsProps) {
  const { today } = useTransactionsServices();
  const markAsPaid = useMarkAsPaid();
  const cancel = useCancelTransaction();
  const remove = useDeleteTransaction();
  const [scope, setScope] = useState<ChangeScope>('single');
  const [paidDate, setPaidDate] = useState<string>(today());
  const [dateError, setDateError] = useState<string | null>(null);

  if (!transaction || !action) return null;

  const close = () => {
    setScope('single');
    setPaidDate(today());
    setDateError(null);
    onClose();
  };
  const onError = (error: unknown) => {
    toast.error(getErrorMessage(error));
  };
  const amount = formatMoney(transaction.amount);
  const isTransfer = transaction.kind === 'transfer';

  if (action === 'pay') {
    const income = transaction.kind === 'income';
    return (
      <ConfirmDialog
        open
        onOpenChange={(open) => {
          if (!open) close();
        }}
        title={
          income
            ? 'Marcar como recebido'
            : isTransfer
              ? 'Efetivar transferência'
              : 'Marcar como pago'
        }
        description={`${transaction.description} — ${amount}`}
        confirmLabel="Confirmar"
        pending={markAsPaid.isPending}
        onConfirm={() => {
          if (!isIsoDate(paidDate) || paidDate > today()) {
            setDateError('Informe uma data válida, até hoje.');
            return;
          }
          markAsPaid.mutate(
            { id: transaction.id, paidDate },
            {
              onSuccess: () => {
                toast.success(income ? 'Recebimento registrado.' : 'Pagamento registrado.');
                close();
              },
              onError,
            },
          );
        }}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="paid-date">{income ? 'Data do recebimento' : 'Data do pagamento'}</Label>
          <Input
            id="paid-date"
            type="date"
            max={today()}
            value={paidDate}
            aria-invalid={Boolean(dateError)}
            onChange={(event) => {
              setPaidDate(event.target.value);
              setDateError(null);
            }}
          />
          {dateError && <p className="text-xs font-medium text-destructive">{dateError}</p>}
        </div>
      </ConfirmDialog>
    );
  }

  const deleting = action === 'delete';
  const mutation = deleting ? remove : cancel;
  return (
    <ConfirmDialog
      open
      destructive
      onOpenChange={(open) => {
        if (!open) close();
      }}
      title={deleting ? 'Excluir lançamento?' : 'Cancelar lançamento?'}
      description={
        deleting
          ? `"${transaction.description}" (${amount}) será excluído definitivamente${isTransfer ? ', incluindo as duas pernas da transferência' : ''}. Esta ação não pode ser desfeita.`
          : `"${transaction.description}" (${amount}) continuará no histórico, mas deixará de afetar saldos e indicadores${isTransfer ? ' (as duas pernas da transferência)' : ''}.`
      }
      confirmLabel={deleting ? 'Excluir' : 'Cancelar lançamento'}
      pending={mutation.isPending}
      onConfirm={() => {
        mutation.mutate(
          { id: transaction.id, scope },
          {
            onSuccess: () => {
              toast.success(deleting ? 'Lançamento excluído.' : 'Lançamento cancelado.');
              close();
            },
            onError,
          },
        );
      }}
    >
      <ScopeChoice transaction={transaction} scope={scope} onChange={setScope} />
    </ConfirmDialog>
  );
}
