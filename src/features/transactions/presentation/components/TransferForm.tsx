import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
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
import { Textarea } from '@/components/ui/textarea';

import type { AccountOption } from './EntryForm';
import { transferFormSchema, type TransferFormValues } from '../schemas/transaction-form.schema';

interface TransferFormProps {
  defaultValues: TransferFormValues;
  accounts: AccountOption[];
  editing: boolean;
  pending: boolean;
  onSubmit: (values: TransferFormValues) => void;
  onCancel: () => void;
}

/** Transferência entre contas: gera saída e entrada; não é receita nem despesa. */
export function TransferForm({
  defaultValues,
  accounts,
  editing,
  pending,
  onSubmit,
  onCancel,
}: TransferFormProps) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<TransferFormValues>({
    resolver: zodResolver(transferFormSchema),
    defaultValues,
  });

  const accountSelect = (name: 'fromAccountId' | 'toAccountId') =>
    function AccountSelectField(fieldProps: {
      id: string;
      'aria-invalid': boolean;
      'aria-describedby': string | undefined;
    }) {
      return (
        <Controller
          control={control}
          name={name}
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
      );
    };

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={handleSubmit((values) => {
        onSubmit(values);
      })}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="De (origem)" error={errors.fromAccountId?.message}>
          {accountSelect('fromAccountId')}
        </FormField>
        <FormField label="Para (destino)" error={errors.toAccountId?.message}>
          {accountSelect('toAccountId')}
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Valor" error={errors.amount?.message}>
          {(fieldProps) => <MoneyInput {...fieldProps} {...register('amount')} />}
        </FormField>
        <FormField
          label="Data"
          error={errors.date?.message}
          description="Datas futuras ficam agendadas (pendentes)."
        >
          {(fieldProps) => <Input {...fieldProps} type="date" {...register('date')} />}
        </FormField>
      </div>
      <FormField label="Descrição (opcional)" error={errors.description?.message}>
        {(fieldProps) => (
          <Input
            {...fieldProps}
            {...register('description')}
            placeholder="Transferência entre contas"
          />
        )}
      </FormField>
      <FormField label="Observações (opcional)" error={errors.notes?.message}>
        {(fieldProps) => <Textarea {...fieldProps} rows={2} {...register('notes')} />}
      </FormField>
      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Spinner />}
          {editing ? 'Salvar alterações' : 'Transferir'}
        </Button>
      </div>
    </form>
  );
}
