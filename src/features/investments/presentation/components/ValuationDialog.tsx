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
import { Label } from '@/components/ui/label';
import { MoneyInput } from '@/components/ui/money-input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Spinner } from '@/components/ui/spinner';
import { asIsoDate, isIsoDate, type IsoDate } from '@/lib/dates';
import { getErrorMessage } from '@/lib/errors';
import { parseMoneyInput, type Money } from '@/lib/money';

import { useRecordValuation } from '../hooks/use-investments';

export interface ValuationTarget {
  assetId: string;
  assetName: string;
  date: IsoDate;
  /** Valor sugerido (ex.: última avaliação ajustada pela movimentação). */
  value: Money | null;
  /** Motivo exibido quando o diálogo é aberto como sugestão. */
  reason?: string;
}

const schema = z.object({
  value: z
    .string()
    .trim()
    .min(1, 'Informe o valor atual.')
    .refine((value) => {
      const money = parseMoneyInput(value);
      return money !== null && !money.isNegative();
    }, 'Informe um valor igual ou maior que zero.'),
  date: z.string().refine((value): boolean => isIsoDate(value), 'Informe a data.'),
  source: z.enum(['manual', 'estimate']),
});

type Values = z.infer<typeof schema>;

/** Atualiza o valor atual da posição (manual ou estimado — nunca cotação). */
export function ValuationDialog({
  target,
  today,
  onClose,
}: {
  target: ValuationTarget | null;
  today: IsoDate;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {target && (
        <DialogContent>
          <ValuationForm target={target} today={today} onClose={onClose} />
        </DialogContent>
      )}
    </Dialog>
  );
}

function ValuationForm({
  target,
  today,
  onClose,
}: {
  target: ValuationTarget;
  today: IsoDate;
  onClose: () => void;
}) {
  const record = useRecordValuation();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      value: target.value ? target.value.toDecimal().toFixed(2).replace('.', ',') : '',
      date: target.date,
      source: 'manual',
    },
  });

  const onSubmit = handleSubmit((values) => {
    setError(null);
    const value = parseMoneyInput(values.value);
    if (!value) return;
    record.mutate(
      { assetId: target.assetId, date: asIsoDate(values.date), value, source: values.source },
      {
        onSuccess: () => {
          toast.success('Valor atual atualizado.');
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
        <DialogTitle>Atualizar valor atual — {target.assetName}</DialogTitle>
        <DialogDescription>
          {target.reason ??
            'Informe o valor total da posição na data. Uma nova avaliação na mesma data substitui a anterior.'}
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
          <FormField label="Valor total da posição" error={errors.value?.message}>
            {(fieldProps) => <MoneyInput {...fieldProps} {...register('value')} />}
          </FormField>
          <FormField label="Data da avaliação" error={errors.date?.message}>
            {(fieldProps) => (
              <Input {...fieldProps} type="date" max={today} {...register('date')} />
            )}
          </FormField>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Origem do valor</legend>
          <Controller
            control={control}
            name="source"
            render={({ field }) => (
              <RadioGroup value={field.value} onValueChange={field.onChange} className="gap-2">
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="source-manual" value="manual" />
                  <Label htmlFor="source-manual" className="font-normal">
                    Informado (extrato, corretora)
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="source-estimate" value="estimate" />
                  <Label htmlFor="source-estimate" className="font-normal">
                    Estimativa (exibido como estimativa)
                  </Label>
                </div>
              </RadioGroup>
            )}
          />
        </fieldset>
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={record.isPending}>
            {target.reason ? 'Agora não' : 'Cancelar'}
          </Button>
          <Button type="submit" disabled={record.isPending}>
            {record.isPending && <Spinner />}
            Salvar valor
          </Button>
        </div>
      </form>
    </>
  );
}
