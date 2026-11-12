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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { getErrorMessage } from '@/lib/errors';

import {
  ASSET_NAME_MAX_LENGTH,
  TICKER_MAX_LENGTH,
  type AssetInput,
} from '../../application/investment-use-cases';
import { ASSET_CLASS_LABELS, type Asset, type AssetClass } from '../../domain/entities/investment';
import { useCreateAsset, useUpdateAsset } from '../hooks/use-investments';

const CLASSES = Object.keys(ASSET_CLASS_LABELS) as AssetClass[];

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Informe o nome do ativo.')
    .max(ASSET_NAME_MAX_LENGTH, `Use no máximo ${ASSET_NAME_MAX_LENGTH} caracteres.`),
  ticker: z
    .string()
    .trim()
    .max(TICKER_MAX_LENGTH, `Use no máximo ${TICKER_MAX_LENGTH} caracteres.`),
  assetClass: z.enum([
    'fixed_income',
    'treasury',
    'cdb',
    'lci',
    'lca',
    'stocks',
    'reits',
    'etf',
    'funds',
    'crypto',
    'other',
  ]),
  institution: z.string().max(60, 'Use no máximo 60 caracteres.'),
  notes: z.string().max(200, 'Use no máximo 200 caracteres.'),
});

type Values = z.infer<typeof schema>;

interface AssetFormDialogProps {
  target: Asset | 'new' | null;
  onClose: () => void;
  /** Após criar (ex.: abrir o ativo para registrar a primeira compra). */
  onCreated?: (asset: Asset) => void;
}

export function AssetFormDialog({ target, onClose, onCreated }: AssetFormDialogProps) {
  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {target && (
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <AssetForm target={target} onClose={onClose} onCreated={onCreated} />
        </DialogContent>
      )}
    </Dialog>
  );
}

function AssetForm({
  target,
  onClose,
  onCreated,
}: {
  target: Asset | 'new';
  onClose: () => void;
  onCreated?: (asset: Asset) => void;
}) {
  const editing = target !== 'new';
  const create = useCreateAsset();
  const update = useUpdateAsset();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: editing
      ? {
          name: target.name,
          ticker: target.ticker ?? '',
          assetClass: target.assetClass,
          institution: target.institution,
          notes: target.notes ?? '',
        }
      : { name: '', ticker: '', assetClass: 'stocks', institution: '', notes: '' },
  });

  const onSubmit = handleSubmit((values) => {
    setError(null);
    const input: AssetInput = {
      name: values.name,
      ticker: values.ticker === '' ? null : values.ticker,
      assetClass: values.assetClass,
      institution: values.institution,
      notes: values.notes === '' ? null : values.notes,
    };
    const onError = (cause: unknown) => {
      setError(getErrorMessage(cause));
    };
    if (editing) {
      update.mutate(
        { id: target.id, input },
        {
          onSuccess: () => {
            toast.success('Ativo atualizado.');
            onClose();
          },
          onError,
        },
      );
    } else {
      create.mutate(input, {
        onSuccess: (asset) => {
          toast.success('Ativo cadastrado. Registre a primeira compra ou aporte.');
          onClose();
          onCreated?.(asset);
        },
        onError,
      });
    }
  });

  const pending = create.isPending || update.isPending;

  return (
    <>
      <DialogHeader>
        <DialogTitle>{editing ? 'Editar ativo' : 'Novo ativo'}</DialogTitle>
        <DialogDescription>
          Quantidade, preço médio e valores vêm das movimentações e avaliações registradas.
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
          <FormField label="Tipo" error={errors.assetClass?.message}>
            {(fieldProps) => (
              <Controller
                control={control}
                name="assetClass"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger {...fieldProps} onBlur={field.onBlur}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CLASSES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {ASSET_CLASS_LABELS[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </FormField>
          <FormField label="Código / ticker (opcional)" error={errors.ticker?.message}>
            {(fieldProps) => (
              <Input
                {...fieldProps}
                {...register('ticker')}
                autoComplete="off"
                className="uppercase"
              />
            )}
          </FormField>
        </div>
        <FormField label="Instituição / corretora" error={errors.institution?.message}>
          {(fieldProps) => <Input {...fieldProps} {...register('institution')} />}
        </FormField>
        <FormField label="Observações (opcional)" error={errors.notes?.message}>
          {(fieldProps) => <Textarea {...fieldProps} rows={2} {...register('notes')} />}
        </FormField>
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending && <Spinner />}
            {editing ? 'Salvar' : 'Cadastrar ativo'}
          </Button>
        </div>
      </form>
    </>
  );
}
