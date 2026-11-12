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
import { useAccountSummaries } from '@/features/accounts';
import { getErrorMessage } from '@/lib/errors';

import { integerField, moneyToInput, positiveMoneyField, requireMoney } from './form-helpers';
import type { CardInput } from '../../application/card-commands';
import {
  CARD_BRAND_LABELS,
  type CardBrand,
  type CreditCard,
} from '../../domain/entities/credit-card';
import { CARD_INSTITUTION_MAX_LENGTH, CARD_NAME_MAX_LENGTH } from '../../domain/rules/card-rules';
import { useCreateCard, useUpdateCard } from '../hooks/use-credit-cards';

const BRANDS = Object.keys(CARD_BRAND_LABELS) as CardBrand[];

const cardFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Informe o nome do cartão.')
    .max(CARD_NAME_MAX_LENGTH, `Use no máximo ${CARD_NAME_MAX_LENGTH} caracteres.`),
  institution: z
    .string()
    .max(CARD_INSTITUTION_MAX_LENGTH, `Use no máximo ${CARD_INSTITUTION_MAX_LENGTH} caracteres.`),
  brand: z.enum(['visa', 'mastercard', 'elo', 'amex', 'hipercard', 'other']),
  limit: positiveMoneyField,
  closingDay: integerField(1, 31, 'Informe um dia entre 1 e 31.'),
  dueDay: integerField(1, 31, 'Informe um dia entre 1 e 31.'),
  paymentAccountId: z.string().min(1, 'Escolha a conta de pagamento.'),
});

type CardFormValues = z.infer<typeof cardFormSchema>;

function toInput(values: CardFormValues): CardInput {
  return {
    name: values.name,
    institution: values.institution,
    brand: values.brand,
    limit: requireMoney(values.limit),
    closingDay: Number(values.closingDay),
    dueDay: Number(values.dueDay),
    paymentAccountId: values.paymentAccountId,
  };
}

interface CardFormDialogProps {
  /** null = fechado; 'new' = criar; cartão = editar. */
  target: CreditCard | 'new' | null;
  onClose: () => void;
}

export function CardFormDialog({ target, onClose }: CardFormDialogProps) {
  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {target && (
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <CardForm target={target} onClose={onClose} />
        </DialogContent>
      )}
    </Dialog>
  );
}

function CardForm({ target, onClose }: { target: CreditCard | 'new'; onClose: () => void }) {
  const editing = target !== 'new';
  const create = useCreateCard();
  const update = useUpdateCard();
  const accounts = useAccountSummaries();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CardFormValues>({
    resolver: zodResolver(cardFormSchema),
    defaultValues: editing
      ? {
          name: target.name,
          institution: target.institution,
          brand: target.brand,
          limit: moneyToInput(target.limit),
          closingDay: String(target.closingDay),
          dueDay: String(target.dueDay),
          paymentAccountId: target.paymentAccountId,
        }
      : {
          name: '',
          institution: '',
          brand: 'mastercard',
          limit: '',
          closingDay: '',
          dueDay: '',
          paymentAccountId: '',
        },
  });

  // Contas ativas + a conta atual do cartão (mesmo se arquivada depois).
  const accountOptions = (accounts.data ?? [])
    .map((item) => item.account)
    .filter((account) => !account.archived || (editing && account.id === target.paymentAccountId));

  const onSubmit = handleSubmit((values) => {
    setError(null);
    const input = toInput(values);
    const options = {
      onSuccess: () => {
        toast.success(editing ? 'Cartão atualizado.' : 'Cartão cadastrado.');
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
        <DialogTitle>{editing ? 'Editar cartão' : 'Novo cartão'}</DialogTitle>
        <DialogDescription>
          Compras feitas a partir do dia de fechamento entram na fatura seguinte.
          {editing && ' Alterar os dias recalcula o calendário de todas as faturas.'}
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
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Nome do cartão" error={errors.name?.message}>
              {(fieldProps) => <Input {...fieldProps} {...register('name')} autoComplete="off" />}
            </FormField>
            <FormField label="Instituição (opcional)" error={errors.institution?.message}>
              {(fieldProps) => <Input {...fieldProps} {...register('institution')} />}
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Bandeira" error={errors.brand?.message}>
              {(fieldProps) => (
                <Controller
                  control={control}
                  name="brand"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger {...fieldProps} onBlur={field.onBlur}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BRANDS.map((brand) => (
                          <SelectItem key={brand} value={brand}>
                            {CARD_BRAND_LABELS[brand]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
            </FormField>
            <FormField label="Limite total" error={errors.limit?.message}>
              {(fieldProps) => <MoneyInput {...fieldProps} {...register('limit')} />}
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Dia de fechamento" error={errors.closingDay?.message}>
              {(fieldProps) => (
                <Input {...fieldProps} type="number" min={1} max={31} {...register('closingDay')} />
              )}
            </FormField>
            <FormField label="Dia de vencimento" error={errors.dueDay?.message}>
              {(fieldProps) => (
                <Input {...fieldProps} type="number" min={1} max={31} {...register('dueDay')} />
              )}
            </FormField>
          </div>
          <FormField
            label="Conta de pagamento"
            error={errors.paymentAccountId?.message}
            description="Conta sugerida ao pagar a fatura."
          >
            {(fieldProps) => (
              <Controller
                control={control}
                name="paymentAccountId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger {...fieldProps} onBlur={field.onBlur}>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {accountOptions.map((account) => (
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
            <Button variant="outline" onClick={onClose} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner />}
              {editing ? 'Salvar' : 'Cadastrar cartão'}
            </Button>
          </div>
        </form>
      )}
    </>
  );
}
