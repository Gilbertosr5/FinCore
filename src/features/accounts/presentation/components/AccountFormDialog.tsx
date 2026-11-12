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
import { asIsoDate, isIsoDate, type IsoDate } from '@/lib/dates';
import { getErrorMessage } from '@/lib/errors';
import { Money, parseMoneyInput } from '@/lib/money';

import { ACCOUNT_NAME_MAX_LENGTH, type AccountInput } from '../../application/account-use-cases';
import { ACCOUNT_TYPE_LABELS, type Account, type AccountType } from '../../domain/entities/account';
import { useCreateAccount, useUpdateAccount } from '../hooks/use-accounts';

const ACCOUNT_TYPES: readonly AccountType[] = [
  'checking',
  'savings',
  'cash',
  'digital_wallet',
  'investment',
  'other',
];

const accountFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Informe o nome da conta.')
    .max(ACCOUNT_NAME_MAX_LENGTH, `Use no máximo ${ACCOUNT_NAME_MAX_LENGTH} caracteres.`),
  type: z.enum(['checking', 'savings', 'cash', 'digital_wallet', 'investment', 'other']),
  institution: z.string().max(60),
  // Saldo inicial pode ser zero ou negativo (ex.: cheque especial).
  initialBalance: z
    .string()
    .refine(
      (value): boolean => value.trim() === '' || parseMoneyInput(value) !== null,
      'Valor inválido.',
    ),
  initialBalanceDate: z.string().refine((value): boolean => isIsoDate(value), 'Informe a data.'),
});

type AccountFormValues = z.infer<typeof accountFormSchema>;

function toInput(values: AccountFormValues): AccountInput {
  return {
    name: values.name,
    type: values.type,
    institution: values.institution,
    // Campo vazio = saldo inicial zero.
    initialBalance: parseMoneyInput(values.initialBalance) ?? Money.zero(),
    initialBalanceDate: asIsoDate(values.initialBalanceDate),
  };
}

interface AccountFormDialogProps {
  /** null = fechado; 'new' = criar; conta = editar. */
  target: Account | 'new' | null;
  today: IsoDate;
  onClose: () => void;
}

export function AccountFormDialog({ target, today, onClose }: AccountFormDialogProps) {
  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {target && (
        <DialogContent>
          <AccountForm target={target} today={today} onClose={onClose} />
        </DialogContent>
      )}
    </Dialog>
  );
}

function AccountForm({
  target,
  today,
  onClose,
}: {
  target: Account | 'new';
  today: IsoDate;
  onClose: () => void;
}) {
  const editing = target !== 'new';
  const create = useCreateAccount();
  const update = useUpdateAccount();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: editing
      ? {
          name: target.name,
          type: target.type,
          institution: target.institution ?? '',
          initialBalance: target.initialBalance.toString().replace('.', ','),
          initialBalanceDate: target.initialBalanceDate,
        }
      : {
          name: '',
          type: 'checking',
          institution: '',
          initialBalance: '',
          initialBalanceDate: today,
        },
  });

  const onSubmit = handleSubmit((values) => {
    setError(null);
    const input = toInput(values);
    const options = {
      onSuccess: () => {
        toast.success(editing ? 'Conta atualizada.' : 'Conta criada.');
        onClose();
      },
      onError: (cause: unknown) => {
        setError(getErrorMessage(cause));
      },
    };
    if (editing) update.mutate({ id: target.id, input }, options);
    else create.mutate(input, options);
  });

  const pending = create.isPending || update.isPending;

  return (
    <>
      <DialogHeader>
        <DialogTitle>{editing ? 'Editar conta' : 'Nova conta'}</DialogTitle>
        <DialogDescription>
          O saldo da conta é calculado a partir do saldo inicial e das movimentações liquidadas.
        </DialogDescription>
      </DialogHeader>
      {error && (
        <Alert variant="destructive">
          <CircleAlert aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <FormField label="Nome" error={errors.name?.message}>
          {(fieldProps) => <Input {...fieldProps} {...register('name')} autoComplete="off" />}
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Tipo" error={errors.type?.message}>
            {(fieldProps) => (
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger {...fieldProps} onBlur={field.onBlur}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACCOUNT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {ACCOUNT_TYPE_LABELS[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </FormField>
          <FormField label="Instituição (opcional)" error={errors.institution?.message}>
            {(fieldProps) => <Input {...fieldProps} {...register('institution')} />}
          </FormField>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Saldo inicial"
            error={errors.initialBalance?.message}
            description="Use “-” para saldo negativo."
          >
            {(fieldProps) => <MoneyInput {...fieldProps} {...register('initialBalance')} />}
          </FormField>
          <FormField label="Data do saldo inicial" error={errors.initialBalanceDate?.message}>
            {(fieldProps) => (
              <Input {...fieldProps} type="date" {...register('initialBalanceDate')} />
            )}
          </FormField>
        </div>
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending && <Spinner />}
            {editing ? 'Salvar' : 'Criar conta'}
          </Button>
        </div>
      </form>
    </>
  );
}
