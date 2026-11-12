import { zodResolver } from '@hookform/resolvers/zod';
import { CircleAlert } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MoneyInput } from '@/components/ui/money-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { asIsoDate, isIsoDate, type IsoDate } from '@/lib/dates';
import { getErrorMessage } from '@/lib/errors';
import { formatMoney, parseMoneyInput } from '@/lib/money';

import type { GoalView } from '../../application/goal-use-cases';
import type { GoalContribution } from '../../domain/entities/goal';
import { useAddContribution } from '../hooks/use-goals';

export interface ContributionTarget {
  view: GoalView;
  type: GoalContribution['type'];
}

const schema = z
  .object({
    amount: z
      .string()
      .trim()
      .min(1, 'Informe o valor.')
      .refine(
        (value) => parseMoneyInput(value)?.isPositive() === true,
        'Informe um valor maior que zero.',
      ),
    date: z.string().refine((value): boolean => isIsoDate(value), 'Informe a data.'),
    withTransfer: z.boolean(),
    counterpartAccountId: z.string(),
  })
  .refine((values) => !values.withTransfer || values.counterpartAccountId !== '', {
    message: 'Escolha a conta.',
    path: ['counterpartAccountId'],
  });

type Values = z.infer<typeof schema>;

interface ContributionDialogProps {
  target: ContributionTarget | null;
  /** Contas ativas (para a transferência opcional). */
  accounts: readonly { id: string; name: string }[];
  today: IsoDate;
  onClose: () => void;
}

export function ContributionDialog({ target, accounts, today, onClose }: ContributionDialogProps) {
  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {target && (
        <DialogContent>
          <ContributionForm target={target} accounts={accounts} today={today} onClose={onClose} />
        </DialogContent>
      )}
    </Dialog>
  );
}

function ContributionForm({
  target,
  accounts,
  today,
  onClose,
}: ContributionDialogProps & { target: ContributionTarget }) {
  const add = useAddContribution();
  const [error, setError] = useState<string | null>(null);
  const { view, type } = target;
  const goal = view.progress.goal;
  const deposit = type === 'deposit';
  const others = accounts.filter((account) => account.id !== goal.accountId);
  const canTransfer = goal.accountId !== null && others.length > 0;
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: '',
      date: today,
      withTransfer: false,
      counterpartAccountId: '',
    },
  });
  const withTransfer = useWatch({ control, name: 'withTransfer' });

  const onSubmit = handleSubmit((values) => {
    setError(null);
    const amount = parseMoneyInput(values.amount);
    if (!amount) return;
    add.mutate(
      {
        goalId: goal.id,
        type,
        amount,
        date: asIsoDate(values.date),
        counterpartAccountId: values.withTransfer ? values.counterpartAccountId : null,
      },
      {
        onSuccess: () => {
          toast.success(deposit ? 'Aporte registrado.' : 'Retirada registrada.');
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
        <DialogTitle>
          {deposit ? 'Aportar em' : 'Retirar de'} “{goal.name}”
        </DialogTitle>
        <DialogDescription>
          Acumulado: {formatMoney(view.progress.accumulated)} · faltam{' '}
          {formatMoney(view.progress.remaining)}. Aportes são destinação de dinheiro — nunca
          receita.
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
          <FormField label="Valor" error={errors.amount?.message}>
            {(fieldProps) => <MoneyInput {...fieldProps} {...register('amount')} />}
          </FormField>
          <FormField label="Data" error={errors.date?.message}>
            {(fieldProps) => (
              <Input
                {...fieldProps}
                type="date"
                min={goal.startDate}
                max={today}
                {...register('date')}
              />
            )}
          </FormField>
        </div>
        {canTransfer ? (
          <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
            <div className="flex items-start gap-2">
              <Controller
                control={control}
                name="withTransfer"
                render={({ field }) => (
                  <Checkbox
                    id="with-transfer"
                    checked={field.value}
                    onCheckedChange={(checked) => {
                      field.onChange(checked === true);
                    }}
                  />
                )}
              />
              <Label htmlFor="with-transfer" className="leading-snug font-normal">
                Registrar também a transferência {deposit ? 'para' : 'a partir de'}{' '}
                {view.accountName ?? 'a conta da meta'}
              </Label>
            </div>
            {withTransfer && (
              <FormField
                label={deposit ? 'Conta de origem' : 'Conta de destino'}
                error={errors.counterpartAccountId?.message}
              >
                {(fieldProps) => (
                  <Controller
                    control={control}
                    name="counterpartAccountId"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger {...fieldProps} onBlur={field.onBlur}>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {others.map((account) => (
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
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {goal.accountId === null
              ? 'Defina a conta da meta para registrar também a transferência entre contas.'
              : 'Registra apenas a destinação do dinheiro (sem movimentar contas).'}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={add.isPending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={add.isPending}>
            {add.isPending && <Spinner />}
            {deposit ? 'Registrar aporte' : 'Registrar retirada'}
          </Button>
        </div>
      </form>
    </>
  );
}
