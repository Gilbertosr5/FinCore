import { CalendarCheck, CreditCard } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { Badge } from '@/components/ui/badge';
import { INVOICE_STATUS_LABELS, type InvoiceStatus } from '@/features/credit-cards';
import { formatDateBR, formatMonthLong } from '@/lib/dates';
import { formatMoney } from '@/lib/money';

import { describeDue } from './due-label';
import { PanelCard } from './PanelCard';
import type { UpcomingBill, UpcomingInvoice } from '../../domain/overview-types';

const MAX_ITEMS = 6;

function dueVariant(daysUntilDue: number) {
  if (daysUntilDue < 0) return 'destructive' as const;
  if (daysUntilDue <= 3) return 'warning' as const;
  return 'secondary' as const;
}

export function UpcomingBillsPanel({ bills }: { bills: UpcomingBill[] }) {
  const visible = bills.slice(0, MAX_ITEMS);
  return (
    <PanelCard
      title="Próximas contas a vencer"
      description="Vencidas e com vencimento em até 30 dias."
    >
      {visible.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title="Nenhuma conta pendente"
          description="Tudo em dia."
        />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {visible.map(({ transaction, accountName, daysUntilDue }) => (
            <li key={transaction.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="truncate text-sm font-medium">{transaction.description}</span>
                <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant={dueVariant(daysUntilDue)}>{describeDue(daysUntilDue)}</Badge>
                  {transaction.dueDate && formatDateBR(transaction.dueDate)} · {accountName}
                </span>
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums">
                {formatMoney(transaction.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {bills.length > MAX_ITEMS && (
        <p className="mt-2 text-xs text-muted-foreground">
          +{bills.length - MAX_ITEMS} outras contas.
        </p>
      )}
    </PanelCard>
  );
}

const INVOICE_VARIANT: Record<InvoiceStatus, 'destructive' | 'warning' | 'secondary' | 'default'> =
  {
    overdue: 'destructive',
    closed: 'warning',
    partially_paid: 'warning',
    open: 'default',
    future: 'secondary',
    paid: 'secondary',
  };

export function UpcomingInvoicesPanel({ invoices }: { invoices: UpcomingInvoice[] }) {
  return (
    <PanelCard title="Próximas faturas" description="Faturas com saldo em aberto por cartão.">
      {invoices.length === 0 ? (
        <EmptyState icon={CreditCard} title="Nenhuma fatura em aberto" />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {invoices.slice(0, MAX_ITEMS).map(({ invoice, cardName, daysUntilDue }) => (
            <li
              key={`${invoice.cardId}-${invoice.month}`}
              className="flex items-center justify-between gap-3 py-2.5"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <span className="truncate text-sm font-medium">
                  {cardName} · {formatMonthLong(invoice.month)}
                </span>
                <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant={INVOICE_VARIANT[invoice.status]}>
                    {INVOICE_STATUS_LABELS[invoice.status]}
                  </Badge>
                  {invoice.status === 'open'
                    ? `Fecha em ${formatDateBR(invoice.closingDate)}`
                    : describeDue(daysUntilDue)}
                  {' · '}vence {formatDateBR(invoice.dueDate)}
                </span>
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums">
                {formatMoney(invoice.outstanding)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </PanelCard>
  );
}
