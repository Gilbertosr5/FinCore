import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MoneyInput } from '@/components/ui/money-input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { parseMoneyInput, formatMoney } from '@/lib/money';

import type { ChangeScope } from '../../application/entry-commands';
import type { Category } from '../../domain/entities/category';
import { RECURRENCE_FREQUENCY_LABELS } from '../../domain/entities/recurrence';
import { entryFormSchema, type EntryFormValues } from '../schemas/transaction-form.schema';

export interface AccountOption {
  id: string;
  name: string;
}

interface EntryFormProps {
  defaultValues: EntryFormValues;
  accounts: AccountOption[];
  categories: Category[];
  /** Edição: oculta repetição e, em séries, pergunta o alcance. */
  editing: boolean;
  isSeries: boolean;
  pending: boolean;
  onSubmit: (values: EntryFormValues, scope: ChangeScope) => void;
  onCancel: () => void;
}

export function EntryForm({
  defaultValues,
  accounts,
  categories,
  editing,
  isSeries,
  pending,
  onSubmit,
  onCancel,
}: EntryFormProps) {
  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<EntryFormValues>({
    resolver: zodResolver(entryFormSchema),
    defaultValues,
  });
  const [kind, settled, repetition, amount, installmentCount] = useWatch({
    control,
    name: ['kind', 'settled', 'repetition', 'amount', 'installmentCount'],
  });
  const kindCategories = categories
    .filter((category) => category.kind === kind)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const [scope, setScope] = useState<ChangeScope>('single');

  const installmentPreview = (() => {
    const total = parseMoneyInput(amount);
    const count = Number(installmentCount);
    if (!total?.isPositive() || !Number.isInteger(count) || count < 2) return null;
    const [first] = total.allocate(count);
    return first ? `${count}x de aproximadamente ${formatMoney(first)}` : null;
  })();

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={handleSubmit((values) => {
        onSubmit(values, scope);
      })}
    >
      {!editing && (
        <Controller
          control={control}
          name="kind"
          render={({ field }) => (
            <RadioGroup
              aria-label="Tipo de lançamento"
              value={field.value}
              onValueChange={(value) => {
                field.onChange(value);
                // Categoria de receita não serve para despesa e vice-versa.
                if (getValues('categoryId')) setValue('categoryId', '');
              }}
              className="grid-cols-2"
            >
              {(['expense', 'income'] as const).map((option) => (
                <Label
                  key={option}
                  htmlFor={`kind-${option}`}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-3 font-normal has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
                >
                  <RadioGroupItem id={`kind-${option}`} value={option} />
                  {option === 'expense' ? 'Despesa' : 'Receita'}
                </Label>
              ))}
            </RadioGroup>
          )}
        />
      )}

      <FormField label="Descrição" error={errors.description?.message}>
        {(fieldProps) => <Input {...fieldProps} {...register('description')} autoComplete="off" />}
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label={repetition === 'installments' ? 'Valor total' : 'Valor'}
          error={errors.amount?.message}
          description={repetition === 'installments' ? installmentPreview : undefined}
        >
          {(fieldProps) => <MoneyInput {...fieldProps} {...register('amount')} />}
        </FormField>
        <FormField label="Data de competência" error={errors.competenceDate?.message}>
          {(fieldProps) => <Input {...fieldProps} type="date" {...register('competenceDate')} />}
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Conta" error={errors.accountId?.message}>
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
        <FormField label="Categoria" error={errors.categoryId?.message}>
          {(fieldProps) => (
            <Controller
              control={control}
              name="categoryId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger {...fieldProps} onBlur={field.onBlur}>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {kindCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          )}
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Vencimento"
          error={errors.dueDate?.message}
          description="Se vazio, igual à competência."
        >
          {(fieldProps) => <Input {...fieldProps} type="date" {...register('dueDate')} />}
        </FormField>
        <div className="flex flex-col gap-2">
          <div className="flex h-[22px] items-center gap-2">
            <Controller
              control={control}
              name="settled"
              render={({ field }) => (
                <Checkbox
                  id="entry-settled"
                  checked={field.value}
                  onCheckedChange={(checked) => {
                    field.onChange(checked === true);
                  }}
                />
              )}
            />
            <Label htmlFor="entry-settled">{kind === 'income' ? 'Já recebida' : 'Já paga'}</Label>
          </div>
          {settled && (
            <FormField
              label={kind === 'income' ? 'Data do recebimento' : 'Data do pagamento'}
              error={errors.paidDate?.message}
            >
              {(fieldProps) => <Input {...fieldProps} type="date" {...register('paidDate')} />}
            </FormField>
          )}
        </div>
      </div>

      {!editing && (
        <fieldset className="flex flex-col gap-3 rounded-lg border border-border p-3">
          <legend className="px-1 text-sm font-medium">Repetição</legend>
          <Controller
            control={control}
            name="repetition"
            render={({ field }) => (
              <RadioGroup
                aria-label="Repetição"
                value={field.value}
                onValueChange={field.onChange}
                className="grid-cols-1 gap-2 sm:grid-cols-3"
              >
                {(
                  [
                    ['none', 'Não repete'],
                    ['installments', 'Parcelado'],
                    ['recurring', 'Recorrente'],
                  ] as const
                ).map(([value, label]) => (
                  <Label
                    key={value}
                    htmlFor={`rep-${value}`}
                    className="flex items-center gap-2 font-normal"
                  >
                    <RadioGroupItem id={`rep-${value}`} value={value} />
                    {label}
                  </Label>
                ))}
              </RadioGroup>
            )}
          />
          {repetition === 'installments' && (
            <FormField label="Número de parcelas" error={errors.installmentCount?.message}>
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  type="number"
                  min={2}
                  max={120}
                  className="w-32"
                  {...register('installmentCount')}
                />
              )}
            </FormField>
          )}
          {repetition === 'recurring' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Frequência" error={errors.frequency?.message}>
                {(fieldProps) => (
                  <Controller
                    control={control}
                    name="frequency"
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={(value) => {
                          field.onChange(value);
                        }}
                      >
                        <SelectTrigger {...fieldProps}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(RECURRENCE_FREQUENCY_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                )}
              </FormField>
              <FormField
                label="Termina em (opcional)"
                error={errors.endDate?.message}
                description="Sem data final, repete indefinidamente."
              >
                {(fieldProps) => <Input {...fieldProps} type="date" {...register('endDate')} />}
              </FormField>
            </div>
          )}
        </fieldset>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Tags (opcional)"
          description="Separe por vírgulas."
          error={errors.tags?.message}
        >
          {(fieldProps) => (
            <Input {...fieldProps} {...register('tags')} placeholder="casa, viagem" />
          )}
        </FormField>
        <FormField label="Observações (opcional)" error={errors.notes?.message}>
          {(fieldProps) => (
            <Textarea {...fieldProps} rows={1} className="min-h-10" {...register('notes')} />
          )}
        </FormField>
      </div>

      {editing && isSeries && (
        <fieldset className="rounded-lg border border-border p-3">
          <legend className="px-1 text-sm font-medium">Aplicar alterações a</legend>
          <RadioGroup
            aria-label="Aplicar alterações a"
            value={scope}
            onValueChange={(value) => {
              setScope(value === 'following' ? 'following' : 'single');
            }}
            className="gap-2 sm:grid-cols-2"
          >
            <Label htmlFor="scope-single" className="flex items-center gap-2 font-normal">
              <RadioGroupItem id="scope-single" value="single" />
              Somente este lançamento
            </Label>
            <Label htmlFor="scope-following" className="flex items-center gap-2 font-normal">
              <RadioGroupItem id="scope-following" value="following" />
              Este e os próximos pendentes
            </Label>
          </RadioGroup>
        </fieldset>
      )}

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Spinner />}
          {editing ? 'Salvar alterações' : 'Adicionar'}
        </Button>
      </div>
    </form>
  );
}
