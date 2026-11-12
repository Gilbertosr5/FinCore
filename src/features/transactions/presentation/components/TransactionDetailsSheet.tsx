import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet';
import { HistoryTimeline } from '@/features/history';
import { formatDateBR } from '@/lib/dates';
import { formatMoney } from '@/lib/money';

import { KIND_LABELS, statusLabel } from './transaction-labels';
import type { TransactionView } from '../../application/list-transactions';

interface TransactionDetailsSheetProps {
  view: TransactionView | null;
  onClose: () => void;
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value ?? '—'}</dd>
    </div>
  );
}

/** Painel lateral com todos os dados do lançamento e o histórico de alterações. */
export function TransactionDetailsSheet({ view, onClose }: TransactionDetailsSheetProps) {
  const tx = view?.transaction;
  return (
    <Sheet
      open={view !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent side="right" className="w-full max-w-md overflow-y-auto bg-popover p-6">
        {tx && (
          <div className="flex flex-col gap-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <SheetTitle className="text-lg font-semibold">{tx.description}</SheetTitle>
                <SheetDescription className="text-sm text-muted-foreground">
                  {KIND_LABELS[tx.kind]} · {statusLabel(tx.kind, tx.status, view.overdue)}
                </SheetDescription>
              </div>
              <SheetClose asChild>
                <Button variant="ghost" size="icon" aria-label="Fechar detalhes">
                  <X aria-hidden="true" />
                </Button>
              </SheetClose>
            </div>
            <p className="text-3xl font-semibold tabular-nums">{formatMoney(tx.amount)}</p>
            <dl className="divide-y divide-border">
              <Row label="Conta" value={view.accountName} />
              {tx.transfer && (
                <Row
                  label={tx.transfer.direction === 'out' ? 'Destino' : 'Origem'}
                  value={view.counterpartAccountName}
                />
              )}
              <Row label="Categoria" value={view.categoryName} />
              <Row label="Competência" value={formatDateBR(tx.competenceDate)} />
              <Row label="Vencimento" value={tx.dueDate ? formatDateBR(tx.dueDate) : null} />
              <Row
                label={tx.kind === 'income' ? 'Recebido em' : 'Pago em'}
                value={tx.paidDate ? formatDateBR(tx.paidDate) : null}
              />
              {tx.installment && (
                <Row
                  label="Parcela"
                  value={`${tx.installment.number} de ${tx.installment.total}`}
                />
              )}
              {tx.recurrenceId && <Row label="Repetição" value="Lançamento recorrente" />}
              <Row label="Tags" value={tx.tags.length > 0 ? tx.tags.join(', ') : null} />
            </dl>
            {tx.notes && (
              <section className="flex flex-col gap-1">
                <h3 className="text-sm font-medium">Observações</h3>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">{tx.notes}</p>
              </section>
            )}
            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-medium">Histórico de alterações</h3>
              <HistoryTimeline entityType="transaction" entityId={tx.id} />
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
