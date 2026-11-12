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
import { parseMoneyInput } from '@/lib/money';

import type { AssetDetails, RevaluationSuggestion } from '../../application/investment-use-cases';
import {
  MOVEMENT_TYPE_LABELS,
  QUANTITY_ASSET_CLASSES,
  type InvestmentMovementType,
} from '../../domain/entities/investment';
import { useRecordMovement } from '../hooks/use-investments';

const CAPITAL: ReadonlySet<InvestmentMovementType> = new Set([
  'buy',
  'sell',
  'contribution',
  'redemption',
]);
const INCOME: ReadonlySet<InvestmentMovementType> = new Set(['dividend', 'interest', 'income']);

const schema = z.object({
  type: z.enum([
    'contribution',
    'buy',
    'sell',
    'redemption',
    'dividend',
    'interest',
    'income',
    'fee',
    'tax',
  ]),
  date: z.string().refine((value): boolean => isIsoDate(value), 'Informe a data.'),
  amount: z
    .string()
    .trim()
    .min(1, 'Informe o valor.')
    .refine(
      (value) => parseMoneyInput(value)?.isPositive() === true,
      'Informe um valor maior que zero.',
    ),
  quantity: z.string(),
  withAccount: z.boolean(),
  accountId: z.string(),
  categoryId: z.string(),
});

type Values = z.infer<typeof schema>;

interface MovementDialogProps {
  open: boolean;
  details: AssetDetails;
  today: IsoDate;
  onClose: () => void;
  /** Movimentação anterior à última avaliação: pede para atualizar o valor atual. */
  onRevaluation: (suggestion: RevaluationSuggestion) => void;
}

export function MovementDialog({ open, ...props }: MovementDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) props.onClose();
      }}
    >
      {open && (
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <MovementForm {...props} />
        </DialogContent>
      )}
    </Dialog>
  );
}

function MovementForm({
  details,
  today,
  onClose,
  onRevaluation,
}: Omit<MovementDialogProps, 'open'>) {
  const record = useRecordMovement();
  const [error, setError] = useState<string | null>(null);
  const asset = details.position.asset;
  const usesQuantity = QUANTITY_ASSET_CLASSES.has(asset.assetClass);
  const defaultIncomeCategory =
    details.incomeCategories.find((item) => /rendiment|provent|dividend/i.test(item.name))?.id ??
    '';

  const {
    register,
    control,
    handleSubmit,
    setError: setFieldError,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: details.allowedTypes[0] ?? 'contribution',
      date: today,
      amount: '',
      quantity: '',
      withAccount: false,
      accountId: '',
      categoryId: defaultIncomeCategory,
    },
  });
  const [type, withAccount] = useWatch({ control, name: ['type', 'withAccount'] });
  const isCapital = CAPITAL.has(type);
  const needsQuantity = usesQuantity && isCapital;
  const accountAllowed = isCapital || INCOME.has(type);
  const isOut = type === 'sell' || type === 'redemption';

  const onSubmit = handleSubmit((values) => {
    setError(null);
    const amount = parseMoneyInput(values.amount);
    if (!amount) return;
    let invalid = false;
    if (needsQuantity && !/^\d+([.,]\d{1,8})?$/.test(values.quantity.trim())) {
      setFieldError('quantity', { message: 'Informe a quantidade (até 8 casas decimais).' });
      invalid = true;
    }
    const useAccount = accountAllowed && values.withAccount;
    if (useAccount && values.accountId === '') {
      setFieldError('accountId', { message: 'Escolha a conta.' });
      invalid = true;
    }
    if (useAccount && INCOME.has(values.type) && values.categoryId === '') {
      setFieldError('categoryId', { message: 'Escolha a categoria.' });
      invalid = true;
    }
    if (invalid) return;
    record.mutate(
      {
        assetId: asset.id,
        type: values.type,
        date: asIsoDate(values.date),
        amount,
        quantity: needsQuantity ? values.quantity.trim().replace(',', '.') : null,
        accountId: useAccount ? values.accountId : null,
        categoryId: useAccount && INCOME.has(values.type) ? values.categoryId : null,
      },
      {
        onSuccess: (result) => {
          toast.success(
            `Movimentação registrada: ${MOVEMENT_TYPE_LABELS[values.type].toLowerCase()}.`,
          );
          onClose();
          if (result.revaluation) onRevaluation(result.revaluation);
        },
        onError: (cause) => {
          setError(getErrorMessage(cause));
        },
      },
    );
  });

  const selectField = (
    name: 'type' | 'accountId' | 'categoryId',
    options: readonly { value: string; label: string }[],
    fieldProps: object,
    placeholder?: string,
  ) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Select value={field.value} onValueChange={field.onChange}>
          <SelectTrigger {...fieldProps} onBlur={field.onBlur}>
            <SelectValue placeholder={placeholder} />
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
        <DialogTitle>Nova movimentação — {asset.ticker ?? asset.name}</DialogTitle>
        <DialogDescription>
          Aplicações e resgates não são receita nem despesa; proventos recebidos em conta são
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
          <FormField label="Tipo de movimentação" error={errors.type?.message}>
            {(fieldProps) =>
              selectField(
                'type',
                details.allowedTypes.map((value) => ({
                  value,
                  label: MOVEMENT_TYPE_LABELS[value],
                })),
                fieldProps,
              )
            }
          </FormField>
          <FormField label="Data" error={errors.date?.message}>
            {(fieldProps) => (
              <Input {...fieldProps} type="date" max={today} {...register('date')} />
            )}
          </FormField>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Valor total"
            error={errors.amount?.message}
            description={isCapital ? 'Valor financeiro da operação.' : undefined}
          >
            {(fieldProps) => <MoneyInput {...fieldProps} {...register('amount')} />}
          </FormField>
          {needsQuantity && (
            <FormField label="Quantidade" error={errors.quantity?.message}>
              {(fieldProps) => (
                <Input {...fieldProps} inputMode="decimal" {...register('quantity')} />
              )}
            </FormField>
          )}
        </div>
        {accountAllowed ? (
          <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
            <div className="flex items-start gap-2">
              <Controller
                control={control}
                name="withAccount"
                render={({ field }) => (
                  <Checkbox
                    id="movement-with-account"
                    checked={field.value}
                    onCheckedChange={(checked) => {
                      field.onChange(checked === true);
                    }}
                  />
                )}
              />
              <Label htmlFor="movement-with-account" className="leading-snug font-normal">
                {INCOME.has(type)
                  ? 'Registrar o recebimento em uma conta (receita)'
                  : isOut
                    ? 'Creditar o valor em uma conta'
                    : 'Debitar o valor de uma conta'}
              </Label>
            </div>
            {withAccount && (
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Conta" error={errors.accountId?.message}>
                  {(fieldProps) =>
                    selectField(
                      'accountId',
                      details.accounts.map((item) => ({ value: item.id, label: item.name })),
                      fieldProps,
                      'Selecione',
                    )
                  }
                </FormField>
                {INCOME.has(type) && (
                  <FormField label="Categoria" error={errors.categoryId?.message}>
                    {(fieldProps) =>
                      selectField(
                        'categoryId',
                        details.incomeCategories.map((item) => ({
                          value: item.id,
                          label: item.name,
                        })),
                        fieldProps,
                        'Selecione',
                      )
                    }
                  </FormField>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Taxas e impostos são registrados só na carteira (normalmente já descontados pela
            corretora).
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={record.isPending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={record.isPending}>
            {record.isPending && <Spinner />}
            Registrar
          </Button>
        </div>
      </form>
    </>
  );
}
