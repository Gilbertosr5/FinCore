import { Receipt } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateBR, formatMonthLong, formatMonthShort } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';

import { InvoiceStatusBadge } from './card-badges';
import type { Invoice } from '../../domain/services/invoices';

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function isPayable(invoice: Invoice): boolean {
  return invoice.status !== 'future' && invoice.outstanding.isPositive();
}

interface InvoicePanelProps {
  invoices: readonly Invoice[];
  selected: Invoice;
  onSelect: (invoice: Invoice) => void;
  onPay: (invoice: Invoice) => void;
  /** Pagamentos só podem ser registrados com o cartão carregado e contas disponíveis. */
  canPay: boolean;
}

/** Lista de faturas (seleção) e detalhe da fatura escolhida com suas parcelas. */
export function InvoicePanel({ invoices, selected, onSelect, onPay, canPay }: InvoicePanelProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);
  // Centraliza a fatura escolhida dentro da própria lista (horizontal no celular,
  // vertical no desktop) sem rolar a página.
  useEffect(() => {
    const list = listRef.current;
    const item = selectedRef.current;
    if (!list || !item) return;
    list.scrollLeft = item.offsetLeft - (list.clientWidth - item.offsetWidth) / 2;
    list.scrollTop = item.offsetTop - (list.clientHeight - item.offsetHeight) / 2;
  }, [selected.month]);

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>Faturas</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 lg:flex-row">
        <nav aria-label="Faturas do cartão" className="lg:w-56 lg:shrink-0">
          <ul
            ref={listRef}
            className="relative -mx-1 flex gap-2 overflow-x-auto px-1 pb-2 lg:max-h-[28rem] lg:flex-col lg:overflow-x-visible lg:overflow-y-auto lg:pb-0"
          >
            {invoices.map((invoice) => {
              const active = invoice.month === selected.month;
              return (
                <li key={invoice.month} className="shrink-0">
                  <button
                    ref={active ? selectedRef : undefined}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      onSelect(invoice);
                    }}
                    className={cn(
                      'flex w-36 flex-col items-start gap-1 rounded-lg border border-border px-3 py-2 text-left text-sm outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring lg:w-full',
                      active && 'border-primary bg-primary/10',
                    )}
                  >
                    <span className="font-medium">
                      {capitalize(formatMonthShort(invoice.month))}
                    </span>
                    <span className="tabular-nums">{formatMoney(invoice.total)}</span>
                    <InvoiceStatusBadge status={invoice.status} />
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <section
          aria-label={`Fatura de ${formatMonthLong(selected.month)}`}
          className="flex min-w-0 flex-1 flex-col gap-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h2 className="flex flex-wrap items-center gap-2 text-base font-semibold">
                Fatura de {formatMonthLong(selected.month)}
                <InvoiceStatusBadge status={selected.status} />
              </h2>
              <p className="text-xs text-muted-foreground">
                Fecha em {formatDateBR(selected.closingDate)} · vence em{' '}
                {formatDateBR(selected.dueDate)}
              </p>
            </div>
            {isPayable(selected) && (
              <Button
                disabled={!canPay}
                onClick={() => {
                  onPay(selected);
                }}
              >
                Pagar fatura
              </Button>
            )}
          </div>
          <dl className="grid grid-cols-3 gap-3 rounded-lg bg-muted/50 p-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Total</dt>
              <dd className="font-semibold tabular-nums">{formatMoney(selected.total)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Pago</dt>
              <dd className="font-semibold tabular-nums">{formatMoney(selected.paid)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Em aberto</dt>
              <dd
                className={cn(
                  'font-semibold tabular-nums',
                  selected.status === 'overdue' && 'text-destructive',
                )}
              >
                {formatMoney(selected.outstanding)}
              </dd>
            </div>
          </dl>
          {selected.installments.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="Nenhuma compra nesta fatura"
              description={
                selected.status === 'open'
                  ? 'Compras feitas até o fechamento entram aqui.'
                  : undefined
              }
              className="py-6"
            />
          ) : (
            <ul aria-label="Lançamentos da fatura" className="divide-y divide-border">
              {selected.installments.map((item) => (
                <li
                  key={`${item.purchaseId}#${item.number}`}
                  className="flex items-center justify-between gap-3 py-2 text-sm"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{item.description}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDateBR(item.purchaseDate)}
                      {item.total > 1 && ` · parcela ${item.number} de ${item.total}`}
                    </span>
                  </div>
                  <span className="shrink-0 font-medium tabular-nums">
                    {formatMoney(item.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
