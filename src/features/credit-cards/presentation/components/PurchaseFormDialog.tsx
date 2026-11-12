import { zodResolver } from '@hookform/resolvers/zod';
import { CircleAlert } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
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
import { DESCRIPTION_MAX_LENGTH, useCategories } from '@/features/transactions';
import { asIsoDate, formatMonthLong, isIsoDate, type IsoDate } from '@/lib/dates';
import { getErrorMessage } from '@/lib/errors';
import { formatMoney, parseMoneyInput } from '@/lib/money';

import {
  dateField,
  integerField,
  moneyToInput,
  positiveMoneyField,
  requireMoney,
} from './form-helpers';
import type { PurchaseInput } from '../../application/purchase-commands';
import type { CardPurchase, CreditCard } from '../../domain/entities/credit-card';
import { MAX_CARD_INSTALLMENTS } from '../../domain/rules/card-rules';
import { getInvoiceMonthForPurchase } from '../../domain/services/invoice-schedule';
import { useRegisterPurchase, useUpdatePurchase } from '../hooks/use-credit-cards';

export type PurchaseFormTarget =
  { type: 'create'; cardId?: string } | { type: 'edit'; purchase: CardPurchase };

const purchaseFormSchema = z.object({
  cardId: z.string().min(1, 'Escolha o cartão.'),
  description: z
    .string()
    .trim()
    .min(1, 'Informe a descrição.')
    .max(DESCRIPTION_MAX_LENGTH, `Use no máximo ${DESCRIPTION_MAX_LENGTH} caracteres.`),
  totalAmount: positiveMoneyField,
  purchaseDate: dateField('Informe a data da compra.'),
  categoryId: z.string().min(1, 'Escolha a categoria.'),
  installmentCount: integerField(
    1,
    MAX_CARD_INSTALLMENTS,
    `Informe de 1 a ${MAX_CARD_INSTALLMENTS} parcelas.`,
  ),
});

type PurchaseFormValues = z.infer<typeof purchaseFormSchema>;

function toInput(values: PurchaseFormValues): PurchaseInput {
  return {
    cardId: values.cardId,
    description: values.description,
    categoryId: values.categoryId,
    totalAmount: requireMoney(values.totalAmount),
    purchaseDate: asIsoDate(values.purchaseDate),
    installmentCount: Number(values.installmentCount),
  };
}

/** Prévia das parcelas e da primeira fatura (somente informativa). */
function describeInstallments(
  card: CreditCard | undefined,
  amountText: string,
  dateText: string,
  countText: string,
): string | null {
  const amount = parseMoneyInput(amountText);
  const count = Number(countText);
  if (!card || !amount?.isPositive() || !isIsoDate(dateText)) return null;
  if (!Number.isInteger(count) || count < 1 || count > MAX_CARD_INSTALLMENTS) return null;
  const first = formatMonthLong(getInvoiceMonthForPurchase(card, dateText));
  if (count === 1) return `À vista na fatura de ${first}.`;
  const [installment = amount] = amount.allocate(count);
  return `${count}x de ${formatMoney(installment)} a partir da fatura de ${first}.`;
}

interface PurchaseFormDialogProps {
  target: PurchaseFormTarget | null;
  /** Cartões disponíveis (somente ativos aceitam compras). */
  cards: readonly CreditCard[];
  today: IsoDate;
  onClose: () => void;
}

export function PurchaseFormDialog({ target, cards, today, onClose }: PurchaseFormDialogProps) {
  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {target && (
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <PurchaseForm target={target} cards={cards} today={today} onClose={onClose} />
        </DialogContent>
      )}
    </Dialog>
  );
}

function PurchaseForm({
  target,
  cards,
  today,
  onClose,
}: {
  target: PurchaseFormTarget;
  cards: readonly CreditCard[];
  today: IsoDate;
  onClose: () => void;
}) {
  const editing = target.type === 'edit';
  const register$ = useRegisterPurchase();
  const update = useUpdatePurchase();
  const categories = useCategories();
  const [error, setError] = useState<string | null>(null);
  const activeCards = cards.filter((card) => card.status === 'active');
  const defaultCardId =
    target.type === 'edit'
      ? target.purchase.cardId
      : (target.cardId ?? (activeCards.length === 1 ? (activeCards[0]?.id ?? '') : ''));

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<PurchaseFormValues>({
    resolver: zodResolver(purchaseFormSchema),
    defaultValues:
      target.type === 'edit'
        ? {
            cardId: target.purchase.cardId,
            description: target.purchase.description,
            totalAmount: moneyToInput(target.purchase.totalAmount),
            purchaseDate: target.purchase.purchaseDate,
            categoryId: target.purchase.categoryId ?? '',
            installmentCount: String(target.purchase.installmentCount),
          }
        : {
            cardId: defaultCardId,
            description: '',
            totalAmount: '',
            purchaseDate: today,
            categoryId: '',
            installmentCount: '1',
          },
  });

  const [cardId, amountText, dateText, countText] = useWatch({
    control,
    name: ['cardId', 'totalAmount', 'purchaseDate', 'installmentCount'],
  });
  const selectedCard = cards.find((card) => card.id === cardId);
  const preview = describeInstallments(selectedCard, amountText, dateText, countText);

  const expenseCategories = (categories.data ?? []).filter((item) => item.kind === 'expense');
  const selectableCards = editing ? cards.filter((card) => card.id === defaultCardId) : activeCards;

  const onSubmit = handleSubmit((values) => {
    setError(null);
    const input = toInput(values);
    const options = {
      onSuccess: () => {
        toast.success(editing ? 'Compra atualizada.' : 'Compra registrada.');
        onClose();
      },
      onError: (cause: unknown) => {
        setError(getErrorMessage(cause));
      },
    };
    if (target.type === 'edit') update.mutate({ id: target.purchase.id, input }, options);
    else register$.mutate(input, options);
  });

  const pending = register$.isPending || update.isPending;

  return (
    <>
      <DialogHeader>
        <DialogTitle>{editing ? 'Editar compra' : 'Nova compra no cartão'}</DialogTitle>
        <DialogDescription>
          A compra compromete o limite e entra nas faturas; o saldo da conta só muda ao pagar a
          fatura.
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
          <FormField label="Cartão" error={errors.cardId?.message}>
            {(fieldProps) => (
              <Controller
                control={control}
                name="cardId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={editing}>
                    <SelectTrigger {...fieldProps} onBlur={field.onBlur}>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectableCards.map((card) => (
                        <SelectItem key={card.id} value={card.id}>
                          {card.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </FormField>
          <FormField label="Descrição" error={errors.description?.message}>
            {(fieldProps) => (
              <Input {...fieldProps} {...register('description')} autoComplete="off" />
            )}
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Valor total" error={errors.totalAmount?.message}>
              {(fieldProps) => <MoneyInput {...fieldProps} {...register('totalAmount')} />}
            </FormField>
            <FormField label="Data da compra" error={errors.purchaseDate?.message}>
              {(fieldProps) => (
                <Input {...fieldProps} type="date" max={today} {...register('purchaseDate')} />
              )}
            </FormField>
          </div>
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
            <FormField label="Parcelas" error={errors.installmentCount?.message}>
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  type="number"
                  min={1}
                  max={MAX_CARD_INSTALLMENTS}
                  {...register('installmentCount')}
                />
              )}
            </FormField>
          </div>
          {preview && (
            <p role="status" className="rounded-md bg-muted px-3 py-2 text-sm">
              {preview}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={onClose} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner />}
              {editing ? 'Salvar' : 'Registrar compra'}
            </Button>
          </div>
        </form>
      )}
    </>
  );
}
