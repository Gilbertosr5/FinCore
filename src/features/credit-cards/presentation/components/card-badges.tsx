import { Badge } from '@/components/ui/badge';

import { CARD_STATUS_LABELS } from '../../application/card-commands';
import type { CardStatus } from '../../domain/entities/credit-card';
import { INVOICE_STATUS_LABELS, type InvoiceStatus } from '../../domain/services/invoices';

const INVOICE_VARIANT: Record<
  InvoiceStatus,
  'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline'
> = {
  future: 'outline',
  open: 'default',
  closed: 'warning',
  partially_paid: 'warning',
  paid: 'success',
  overdue: 'destructive',
};

/** Situação da fatura em texto (nunca só cor). */
export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return <Badge variant={INVOICE_VARIANT[status]}>{INVOICE_STATUS_LABELS[status]}</Badge>;
}

export function CardStatusBadge({ status }: { status: CardStatus }) {
  if (status === 'active') return null;
  return (
    <Badge variant={status === 'blocked' ? 'warning' : 'outline'}>
      {CARD_STATUS_LABELS[status]}
    </Badge>
  );
}
