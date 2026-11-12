import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { getErrorMessage } from '@/lib/errors';

import { CATEGORY_NAME_MAX_LENGTH } from '../../application/category-commands';
import type { Category, CategoryKind } from '../../domain/entities/category';
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
} from '../hooks/use-transactions';

const categoryFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Informe o nome.')
    .max(CATEGORY_NAME_MAX_LENGTH, `Use no máximo ${CATEGORY_NAME_MAX_LENGTH} caracteres.`),
  kind: z.enum(['income', 'expense']),
  nature: z.enum(['fixed', 'variable']),
});
type CategoryFormValues = z.infer<typeof categoryFormSchema>;

const KIND_TITLES: Record<CategoryKind, string> = { expense: 'Despesas', income: 'Receitas' };

/** Categorias de receita e despesa, incluindo as personalizadas. */
export function CategoriesManager() {
  const categories = useCategories();
  const remove = useDeleteCategory();
  const [editing, setEditing] = useState<Category | CategoryKind | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);

  if (categories.isPending) return <Skeleton className="h-40 w-full" />;
  if (categories.isError) {
    return <p className="text-sm text-destructive">{getErrorMessage(categories.error)}</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {(['expense', 'income'] as const).map((kind) => {
        const items = categories.data
          .filter((category) => category.kind === kind)
          .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
        return (
          <section key={kind} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">{KIND_TITLES[kind]}</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditing(kind);
                }}
              >
                <Plus aria-hidden="true" />
                Nova categoria
              </Button>
            </div>
            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
              {items.map((category) => (
                <li key={category.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="flex items-center gap-2 text-sm">
                    {category.name}
                    {kind === 'expense' && (
                      <Badge variant="secondary">
                        {category.nature === 'fixed' ? 'Fixa' : 'Variável'}
                      </Badge>
                    )}
                  </span>
                  <span className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Editar categoria ${category.name}`}
                      onClick={() => {
                        setEditing(category);
                      }}
                    >
                      <Pencil aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Excluir categoria ${category.name}`}
                      onClick={() => {
                        setDeleting(category);
                      }}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        {editing !== null && (
          <DialogContent>
            <CategoryForm
              target={editing}
              onClose={() => {
                setEditing(null);
              }}
            />
          </DialogContent>
        )}
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        destructive
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Excluir categoria?"
        description={`"${deleting?.name ?? ''}" será excluída. Categorias com lançamentos, compras ou orçamentos não podem ser excluídas.`}
        confirmLabel="Excluir"
        pending={remove.isPending}
        onConfirm={() => {
          if (!deleting) return;
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast.success('Categoria excluída.');
              setDeleting(null);
            },
            onError: (error) => {
              toast.error(getErrorMessage(error));
              setDeleting(null);
            },
          });
        }}
      />
    </div>
  );
}

function CategoryForm({
  target,
  onClose,
}: {
  target: Category | CategoryKind;
  onClose: () => void;
}) {
  const existing = typeof target === 'string' ? null : target;
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: existing
      ? { name: existing.name, kind: existing.kind, nature: existing.nature }
      : { name: '', kind: typeof target === 'string' ? target : 'expense', nature: 'variable' },
  });
  const pending = create.isPending || update.isPending;

  const onSubmit = handleSubmit((values) => {
    const options = {
      onSuccess: () => {
        toast.success(existing ? 'Categoria atualizada.' : 'Categoria criada.');
        onClose();
      },
      onError: (error: unknown) => {
        setError('name', { type: 'server', message: getErrorMessage(error) });
      },
    };
    if (existing) update.mutate({ id: existing.id, input: values }, options);
    else create.mutate(values, options);
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>{existing ? 'Editar categoria' : 'Nova categoria'}</DialogTitle>
        <DialogDescription>
          Despesas fixas (ex.: aluguel) e variáveis (ex.: lazer) aparecem separadas nos relatórios.
        </DialogDescription>
      </DialogHeader>
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <FormField label="Nome" error={errors.name?.message}>
          {(fieldProps) => <Input {...fieldProps} {...register('name')} autoComplete="off" />}
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Tipo" error={errors.kind?.message}>
            {(fieldProps) => (
              <Controller
                control={control}
                name="kind"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger {...fieldProps}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="expense">Despesa</SelectItem>
                      <SelectItem value="income">Receita</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </FormField>
          <FormField label="Natureza" error={errors.nature?.message}>
            {(fieldProps) => (
              <Controller
                control={control}
                name="nature"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger {...fieldProps}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="variable">Variável</SelectItem>
                      <SelectItem value="fixed">Fixa</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </FormField>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending && <Spinner />}
            Salvar
          </Button>
        </div>
      </form>
    </>
  );
}
