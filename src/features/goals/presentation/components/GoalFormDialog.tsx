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
import { Textarea } from '@/components/ui/textarea';
import { useAccountSummaries } from '@/features/accounts';
import { asIsoDate, isIsoDate, type IsoDate } from '@/lib/dates';
import { getErrorMessage } from '@/lib/errors';
import { parseMoneyInput } from '@/lib/money';

import {
  GOAL_DESCRIPTION_MAX_LENGTH,
  GOAL_NAME_MAX_LENGTH,
  type GoalInput,
} from '../../application/goal-use-cases';
import {
  GOAL_CATEGORY_LABELS,
  GOAL_PRIORITY_LABELS,
  type Goal,
  type GoalCategory,
  type GoalPriority,
} from '../../domain/entities/goal';
import { useCreateGoal, useUpdateGoal } from '../hooks/use-goals';

const CATEGORIES = Object.keys(GOAL_CATEGORY_LABELS) as GoalCategory[];
const PRIORITIES: readonly GoalPriority[] = ['high', 'medium', 'low'];
/** Valor do select para "sem conta vinculada". */
const NO_ACCOUNT = '__none__';

const goalFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Informe o nome da meta.')
      .max(GOAL_NAME_MAX_LENGTH, `Use no máximo ${GOAL_NAME_MAX_LENGTH} caracteres.`),
    description: z
      .string()
      .max(GOAL_DESCRIPTION_MAX_LENGTH, `Use no máximo ${GOAL_DESCRIPTION_MAX_LENGTH} caracteres.`),
    category: z.enum([
      'emergency_fund',
      'vehicle',
      'travel',
      'property',
      'equipment',
      'financial_independence',
      'other',
    ]),
    targetAmount: z
      .string()
      .trim()
      .min(1, 'Informe o valor desejado.')
      .refine(
        (value) => parseMoneyInput(value)?.isPositive() === true,
        'Informe um valor maior que zero.',
      ),
    startDate: z.string().refine((value): boolean => isIsoDate(value), 'Informe a data inicial.'),
    targetDate: z
      .string()
      .refine((value): boolean => value === '' || isIsoDate(value), 'Data inválida.'),
    priority: z.enum(['low', 'medium', 'high']),
    accountId: z.string(),
  })
  .refine((values) => values.targetDate === '' || values.targetDate > values.startDate, {
    message: 'A data final deve ser posterior à inicial.',
    path: ['targetDate'],
  });

type GoalFormValues = z.infer<typeof goalFormSchema>;

function toInput(values: GoalFormValues): GoalInput {
  const targetAmount = parseMoneyInput(values.targetAmount);
  if (!targetAmount) throw new Error('Valor inválido após validação.');
  return {
    name: values.name,
    description: values.description,
    category: values.category,
    targetAmount,
    startDate: asIsoDate(values.startDate),
    targetDate: values.targetDate === '' ? null : asIsoDate(values.targetDate),
    priority: values.priority,
    accountId: values.accountId === NO_ACCOUNT ? null : values.accountId,
  };
}

interface GoalFormDialogProps {
  target: Goal | 'new' | null;
  today: IsoDate;
  onClose: () => void;
}

export function GoalFormDialog({ target, today, onClose }: GoalFormDialogProps) {
  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {target && (
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <GoalForm target={target} today={today} onClose={onClose} />
        </DialogContent>
      )}
    </Dialog>
  );
}

function GoalForm({
  target,
  today,
  onClose,
}: Required<GoalFormDialogProps> & { target: Goal | 'new' }) {
  const editing = target !== 'new';
  const create = useCreateGoal();
  const update = useUpdateGoal();
  const accounts = useAccountSummaries();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<GoalFormValues>({
    resolver: zodResolver(goalFormSchema),
    defaultValues: editing
      ? {
          name: target.name,
          description: target.description ?? '',
          category: target.category,
          targetAmount: target.targetAmount.toDecimal().toFixed(2).replace('.', ','),
          startDate: target.startDate,
          targetDate: target.targetDate ?? '',
          priority: target.priority,
          accountId: target.accountId ?? NO_ACCOUNT,
        }
      : {
          name: '',
          description: '',
          category: 'other',
          targetAmount: '',
          startDate: today,
          targetDate: '',
          priority: 'medium',
          accountId: NO_ACCOUNT,
        },
  });

  const accountOptions = (accounts.data ?? [])
    .map((item) => item.account)
    .filter((account) => !account.archived || (editing && account.id === target.accountId));

  const onSubmit = handleSubmit((values) => {
    setError(null);
    const input = toInput(values);
    const options = {
      onSuccess: () => {
        toast.success(editing ? 'Meta atualizada.' : 'Meta criada.');
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

  const select = (
    name: 'category' | 'priority' | 'accountId',
    options: readonly { value: string; label: string }[],
    fieldProps: object,
  ) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Select value={field.value} onValueChange={field.onChange}>
          <SelectTrigger {...fieldProps} onBlur={field.onBlur}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    />
  );

  return (
    <>
      <DialogHeader>
        <DialogTitle>{editing ? 'Editar meta' : 'Nova meta'}</DialogTitle>
        <DialogDescription>
          O progresso é calculado pelos aportes e retiradas. Aportes nunca contam como receita.
        </DialogDescription>
      </DialogHeader>
      {error && (
        <Alert variant="destructive">
          <CircleAlert aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {accounts.isPending ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : (
        <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
          <FormField label="Nome" error={errors.name?.message}>
            {(fieldProps) => <Input {...fieldProps} {...register('name')} autoComplete="off" />}
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Tipo de meta" error={errors.category?.message}>
              {(fieldProps) =>
                select(
                  'category',
                  CATEGORIES.map((value) => ({ value, label: GOAL_CATEGORY_LABELS[value] })),
                  fieldProps,
                )
              }
            </FormField>
            <FormField label="Valor desejado" error={errors.targetAmount?.message}>
              {(fieldProps) => <MoneyInput {...fieldProps} {...register('targetAmount')} />}
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Data inicial" error={errors.startDate?.message}>
              {(fieldProps) => <Input {...fieldProps} type="date" {...register('startDate')} />}
            </FormField>
            <FormField label="Data final (opcional)" error={errors.targetDate?.message}>
              {(fieldProps) => <Input {...fieldProps} type="date" {...register('targetDate')} />}
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Prioridade" error={errors.priority?.message}>
              {(fieldProps) =>
                select(
                  'priority',
                  PRIORITIES.map((value) => ({ value, label: GOAL_PRIORITY_LABELS[value] })),
                  fieldProps,
                )
              }
            </FormField>
            <FormField
              label="Conta da meta (opcional)"
              error={errors.accountId?.message}
              description="Onde o dinheiro fica guardado."
            >
              {(fieldProps) =>
                select(
                  'accountId',
                  [
                    { value: NO_ACCOUNT, label: 'Nenhuma' },
                    ...accountOptions.map((account) => ({
                      value: account.id,
                      label: account.name,
                    })),
                  ],
                  fieldProps,
                )
              }
            </FormField>
          </div>
          <FormField label="Descrição (opcional)" error={errors.description?.message}>
            {(fieldProps) => <Textarea {...fieldProps} rows={2} {...register('description')} />}
          </FormField>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={onClose} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner />}
              {editing ? 'Salvar' : 'Criar meta'}
            </Button>
          </div>
        </form>
      )}
    </>
  );
}
