import { zodResolver } from '@hookform/resolvers/zod';
import { CircleAlert } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { asIsoDate, formatDateBR, formatMonthLong, type IsoDate } from '@/lib/dates';
import { getErrorMessage } from '@/lib/errors';
import { formatMoney } from '@/lib/money';

import { dateField, moneyToInput, positiveMoneyField, requireMoney } from './form-helpers';
import type { CreditCard } from '../../domain/entities/credit-card';
import type { Invoice } from '../../domain/services/invoices';
import { usePayInvoice } from '../hooks/use-credit-cards';

const payFormSchema = z.object({
  amount: positiveMoneyField,
  accountId: z.string().min(1, 'Escolha a conta.'),
  paidDate: dateField('Informe a data do pagamento.'),
});

type PayFormValues = z.infer<typeof payFormSchema>;

interface PayInvoiceDialogProps {
  card: CreditCard;
  invoice: Invoice | null;
  accounts: readonly { id: string; name: string }[];
  today: IsoDate;
  onClose: () => void;
}

/** Pagamento total ou parcial: debita a conta escolhida sem gerar despesa (ADR 0007). */
export function PayInvoiceDialog({
  card,
  invoice,
  accounts,
  today,
  onClose,
}: PayInvoiceDialogProps) {
  return (
    <Dialog
      open={invoice !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {invoice && (
        <DialogContent>
          <PayInvoiceForm
            card={card}
            invoice={invoice}
            accounts={accounts}
            today={today}
            onClose={onClose}
          />
        </DialogContent>
      )}
    </Dialog>
  );
}

function PayInvoiceForm({
  card,
  invoice,
  accounts,
  today,
  onClose,
}: PayInvoiceDialogProps & { invoice: Invoice }) {
  const pay = usePayInvoice();
  const [error, setError] = useState<string | null>(null);
  const defaultAccount = accounts.some((item) => item.id === card.paymentAccountId)
    ? card.paymentAccountId
    : '';
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<PayFormValues>({
    resolver: zodResolver(payFormSchema),
    defaultValues: {
      amount: moneyToInput(invoice.outstanding),
      accountId: defaultAccount,
      paidDate: today,
    },
  });

  const onSubmit = handleSubmit((values) => {
    setError(null);
    const amount = requireMoney(values.amount);
    pay.mutate(
      {
        cardId: card.id,
        invoiceMonth: invoice.month,
        amount,
        accountId: values.accountId,
        paidDate: asIsoDate(values.paidDate),
      },
      {
        onSuccess: () => {
          toast.success(
            amount.lessThan(invoice.outstanding) ? 'Pagamento parcial registrado.' : 'Fatura paga.',
          );
          onClose();
        },
        onError: (cause) => {
          setError(getErrorMessage(cause));
        },
      },
    );
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>Pagar fatura de {formatMonthLong(invoice.month)}</DialogTitle>
        <DialogDescription>
          {card.name} · vence em {formatDateBR(invoice.dueDate)}. Em aberto:{' '}
          <strong className="text-foreground tabular-nums">
            {formatMoney(invoice.outstanding)}
          </strong>
          . O pagamento reduz o saldo da conta, mas não é contado como despesa.
        </DialogDescription>
      </DialogHeader>
      {error && (
        <Alert variant="destructive">
          <CircleAlert aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Valor do pagamento"
            error={errors.amount?.message}
            description="Pode ser parcial."
          >
            {(fieldProps) => <MoneyInput {...fieldProps} {...register('amount')} />}
          </FormField>
          <FormField label="Data do pagamento" error={errors.paidDate?.message}>
            {(fieldProps) => (
              <Input {...fieldProps} type="date" max={today} {...register('paidDate')} />
            )}
          </FormField>
        </div>
        <FormField label="Conta debitada" error={errors.accountId?.message}>
          {(fieldProps) => (
            <Controller
              control={control}
              name="accountId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger {...fieldProps} onBlur={field.onBlur}>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          )}
        </FormField>
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={pay.isPending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pay.isPending}>
            {pay.isPending && <Spinner />}
            Confirmar pagamento
          </Button>
        </div>
      </form>
    </>
  );
}
