import {
  Ban,
  CalendarRange,
  MoreHorizontal,
  Pencil,
  ShoppingBag,
  Undo2,
  Wallet,
} from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDateBR, formatMonthLong, formatMonthShort } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';

import type { FutureMonth, PaymentView, PurchaseView } from '../../application/card-queries';
import type { CardPurchase } from '../../domain/entities/credit-card';

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Parcelas já lançadas em faturas posteriores à aberta, mês a mês. */
export function FutureInstallmentsCard({ months }: { months: readonly FutureMonth[] }) {
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>Parcelas futuras</CardTitle>
      </CardHeader>
      <CardContent>
        {months.length === 0 ? (
          <EmptyState
            icon={CalendarRange}
            title="Sem parcelas futuras"
            description="Compras parceladas aparecem aqui nas próximas faturas."
            className="py-6"
          />
        ) : (
          <ul className="divide-y divide-border">
            {months.map((item) => (
              <li key={item.month} className="flex justify-between gap-3 py-2 text-sm">
                <span>
                  {capitalize(formatMonthLong(item.month))}
                  <span className="text-xs text-muted-foreground">
                    {' '}
                    · {item.count} {item.count === 1 ? 'parcela' : 'parcelas'}
                  </span>
                </span>
                <span className="font-medium tabular-nums">{formatMoney(item.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

interface PurchasesCardProps {
  purchases: readonly PurchaseView[];
  /** Edição/cancelamento só em cartão ativo. */
  editable: boolean;
  onEdit: (purchase: CardPurchase) => void;
  onCancel: (purchase: CardPurchase) => void;
}

export function PurchasesCard({ purchases, editable, onEdit, onCancel }: PurchasesCardProps) {
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>Compras</CardTitle>
      </CardHeader>
      <CardContent>
        {purchases.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title="Nenhuma compra registrada"
            description="Registre compras avulsas ou parceladas neste cartão."
            className="py-6"
          />
        ) : (
          <ul aria-label="Compras do cartão" className="divide-y divide-border">
            {purchases.map(({ purchase, categoryName, futureCount, futureAmount }) => {
              const cancelled = purchase.status === 'cancelled';
              return (
                <li key={purchase.id} className="flex items-center gap-3 py-2 text-sm">
                  <div className={cn('flex min-w-0 flex-1 flex-col', cancelled && 'opacity-60')}>
                    <span className="flex flex-wrap items-center gap-2">
                      <span className={cn('truncate font-medium', cancelled && 'line-through')}>
                        {purchase.description}
                      </span>
                      {cancelled && <Badge variant="outline">Cancelada</Badge>}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {[
                        formatDateBR(purchase.purchaseDate),
                        categoryName,
                        purchase.installmentCount > 1 ? `${purchase.installmentCount}x` : 'À vista',
                        futureCount > 0
                          ? `${futureCount} futuras (${formatMoney(futureAmount)})`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </div>
                  <span className="shrink-0 font-medium tabular-nums">
                    {formatMoney(purchase.totalAmount)}
                  </span>
                  {editable && !cancelled ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Ações da compra ${purchase.description}`}
                        >
                          <MoreHorizontal aria-hidden="true" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() => {
                            onEdit(purchase);
                          }}
                        >
                          <Pencil aria-hidden="true" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => {
                            onCancel(purchase);
                          }}
                        >
                          <Ban aria-hidden="true" />
                          Cancelar compra
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <span className="size-9 shrink-0" aria-hidden="true" />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

interface PaymentsCardProps {
  payments: readonly PaymentView[];
  onReverse: (payment: PaymentView) => void;
}

/** Histórico de pagamentos de fatura (inclusive estornados). */
export function PaymentsCard({ payments, onReverse }: PaymentsCardProps) {
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>Histórico de pagamentos</CardTitle>
      </CardHeader>
      <CardContent>
        {payments.length === 0 ? (
          <EmptyState icon={Wallet} title="Nenhum pagamento registrado" className="py-6" />
        ) : (
          <ul aria-label="Pagamentos de fatura" className="divide-y divide-border">
            {payments.map((payment) => {
              const tx = payment.transaction;
              const reversed = tx.status === 'cancelled';
              return (
                <li key={tx.id} className="flex items-center gap-3 py-2 text-sm">
                  <div className={cn('flex min-w-0 flex-1 flex-col', reversed && 'opacity-60')}>
                    <span className="flex flex-wrap items-center gap-2 font-medium">
                      Fatura de{' '}
                      {tx.cardPayment ? formatMonthShort(tx.cardPayment.invoiceMonth) : '—'}
                      {reversed && <Badge variant="outline">Estornado</Badge>}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {tx.paidDate ? formatDateBR(tx.paidDate) : formatDateBR(tx.competenceDate)} ·{' '}
                      {payment.accountName}
                    </span>
                  </div>
                  <span
                    className={cn('shrink-0 font-medium tabular-nums', reversed && 'line-through')}
                  >
                    {formatMoney(tx.amount)}
                  </span>
                  {reversed ? (
                    <span className="size-9 shrink-0" aria-hidden="true" />
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Estornar pagamento de ${formatMoney(tx.amount)}`}
                      onClick={() => {
                        onReverse(payment);
                      }}
                    >
                      <Undo2 aria-hidden="true" />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
