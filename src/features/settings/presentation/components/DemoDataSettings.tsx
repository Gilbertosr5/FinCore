import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DatabaseBackup } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { formatDateBR, isIsoDate } from '@/lib/dates';
import { getErrorMessage } from '@/lib/errors';

import type { DemoDataManager } from '../context/demo-data-context';

const demoInfoKey = ['settings', 'demo-data-info'] as const;

/** Restauração do ambiente de demonstração (somente com dados locais). */
export function DemoDataSettings({ manager }: { manager: DemoDataManager }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const info = useQuery({ queryKey: demoInfoKey, queryFn: () => manager.getInfo() });

  const reset = useMutation({
    mutationFn: () => manager.reset(),
    onSuccess: async () => {
      setOpen(false);
      // Todos os dados derivados (dashboard etc.) precisam ser recalculados.
      await queryClient.invalidateQueries();
      toast.success('Dados de demonstração restaurados.');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const referenceDate = info.data?.referenceDate;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm">
        <p className="font-medium">Dados de demonstração</p>
        <p className="text-muted-foreground">
          Gerados para 12 meses até{' '}
          {referenceDate && isIsoDate(referenceDate) ? formatDateBR(referenceDate) : '—'}. Restaurar
          recria todos os dados com a data de hoje.
        </p>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <Button
          variant="outline"
          onClick={() => {
            setOpen(true);
          }}
        >
          <DatabaseBackup aria-hidden="true" />
          Restaurar dados
        </Button>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restaurar dados de demonstração?</DialogTitle>
            <DialogDescription>
              Todos os dados locais de demonstração serão apagados e gerados novamente. Esta ação
              não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={reset.isPending}>
                Cancelar
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              disabled={reset.isPending}
              onClick={() => {
                reset.mutate();
              }}
            >
              {reset.isPending && <Spinner />}
              Restaurar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
