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
import { useCategories } from '@/features/transactions';
import { getErrorMessage } from '@/lib/errors';
import { parseMoneyInput } from '@/lib/money';

import {
  BUDGET_NAME_MAX_LENGTH,
  BUDGET_PERIOD_LABELS,
  DEFAULT_ALERT_THRESHOLD,
  type BudgetInput,
} from '../../application/budget-use-cases';
import type { Budget } from '../../domain/entities/budget';
import { useCreateBudget, useUpdateBudget } from '../hooks/use-budgets';

/** Valor do select para "todas as despesas" (orçamento geral). */
const ALL_EXPENSES = '__all__';

const budgetFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Informe o nome do orçamento.')
    .max(BUDGET_NAME_MAX_LENGTH, `Use no máximo ${BUDGET_NAME_MAX_LENGTH} caracteres.`),
  categoryId: z.string().min(1, 'Escolha a categoria.'),
  period: z.enum(['monthly', 'yearly']),
  amount: z
    .string()
    .trim()
    .min(1, 'Informe o limite.')
    .refine(
      (value) => parseMoneyInput(value)?.isPositive() === true,
      'Informe um valor maior que zero.',
    ),
  alertThresholdPercent: z.string().refine((value) => {
    const number = Number(value);
    return Number.isInteger(number) && number >= 1 && number <= 100;
  }, 'Informe um percentual entre 1 e 100.'),
});

type BudgetFormValues = z.infer<typeof budgetFormSchema>;

function toInput(values: BudgetFormValues): BudgetInput {
  const amount = parseMoneyInput(values.amount);
  if (!amount) throw new Error('Valor inválido após validação.');
  return {
    name: values.name,
    categoryId: values.categoryId === ALL_EXPENSES ? null : values.categoryId,
    period: values.period,
    amount,
    alertThresholdPercent: Number(values.alertThresholdPercent),
  };
}

interface BudgetFormDialogProps {
  target: Budget | 'new' | null;
  onClose: () => void;
}

export function BudgetFormDialog({ target, onClose }: BudgetFormDialogProps) {
  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {target && (
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <BudgetForm target={target} onClose={onClose} />
        </DialogContent>
      )}
    </Dialog>
  );
}

function BudgetForm({ target, onClose }: { target: Budget | 'new'; onClose: () => void }) {
  const editing = target !== 'new';
  const create = useCreateBudget();
  const update = useUpdateBudget();
  const categories = useCategories();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: editing
      ? {
          name: target.name,
          categoryId: target.categoryId ?? ALL_EXPENSES,
          period: target.period,
          amount: target.amount.toDecimal().toFixed(2).replace('.', ','),
          alertThresholdPercent: String(target.alertThresholdPercent),
        }
      : {
          name: '',
          categoryId: '',
          period: 'monthly',
          amount: '',
          alertThresholdPercent: String(DEFAULT_ALERT_THRESHOLD),
        },
  });

  const expenseCategories = (categories.data ?? []).filter((item) => item.kind === 'expense');

  const onSubmit = handleSubmit((values) => {
    setError(null);
    const input = toInput(values);
    const options = {
      onSuccess: () => {
        toast.success(editing ? 'Orçamento atualizado.' : 'Orçamento criado.');
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
        <DialogTitle>{editing ? 'Editar orçamento' : 'Novo orçamento'}</DialogTitle>
        <DialogDescription>
          O consumo considera despesas de contas e parcelas de cartão pela competência.
          Transferências e pagamentos de fatura não entram.
        </DialogDescription>
      </DialogHeader>
      {error && (
        <Alert variant="destructive">
          <CircleAlert aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {categories.isPending ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : (
        <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
          <FormField label="Nome" error={errors.name?.message}>
            {(fieldProps) => <Input {...fieldProps} {...register('name')} autoComplete="off" />}
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
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
                        <SelectItem value={ALL_EXPENSES}>Todas as despesas (geral)</SelectItem>
                        {expenseCategories.map((category) => (
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
            <FormField label="Período" error={errors.period?.message}>
              {(fieldProps) => (
                <Controller
                  control={control}
                  name="period"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger {...fieldProps} onBlur={field.onBlur}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">{BUDGET_PERIOD_LABELS.monthly}</SelectItem>
                        <SelectItem value="yearly">{BUDGET_PERIOD_LABELS.yearly}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Limite" error={errors.amount?.message}>
              {(fieldProps) => <MoneyInput {...fieldProps} {...register('amount')} />}
            </FormField>
            <FormField label="Alertar ao atingir (%)" error={errors.alertThresholdPercent?.message}>
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  type="number"
                  min={1}
                  max={100}
                  {...register('alertThresholdPercent')}
                />
              )}
            </FormField>
          </div>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={onClose} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner />}
              {editing ? 'Salvar' : 'Criar orçamento'}
            </Button>
          </div>
        </form>
      )}
    </>
  );
}
