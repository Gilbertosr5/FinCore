import {
  Ban,
  CalendarRange,
  ChevronRight,
  CloudOff,
  CreditCard as CreditCardIcon,
  Lock,
  LockOpen,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  ShoppingBag,
  Trash2,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';

import { StatCard } from '@/components/data-display/StatCard';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { StatusScreen } from '@/components/feedback/StatusScreen';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { ROUTES } from '@/constants/routes';
import { HistoryTimeline } from '@/features/history';
import { formatMonthShort, isMonthKey } from '@/lib/dates';
import { getErrorMessage } from '@/lib/errors';
import { formatMoney, formatPercent } from '@/lib/money';

import type { CardDetails, PaymentView } from '../../application/card-queries';
import {
  CARD_BRAND_LABELS,
  type CardPurchase,
  type CardStatus,
} from '../../domain/entities/credit-card';
import type { Invoice } from '../../domain/services/invoices';
import { CardStatusBadge } from '../components/card-badges';
import {
  FutureInstallmentsCard,
  PaymentsCard,
  PurchasesCard,
} from '../components/CardActivityLists';
import { CardFormDialog } from '../components/CardFormDialog';
import { InvoicePanel } from '../components/InvoicePanel';
import { PayInvoiceDialog } from '../components/PayInvoiceDialog';
import { PurchaseFormDialog, type PurchaseFormTarget } from '../components/PurchaseFormDialog';
import { useCreditCardsServices } from '../context/credit-cards-context';
import {
  useCancelPurchase,
  useCardDetails,
  useDeleteCard,
  useReversePayment,
  useSetCardStatus,
} from '../hooks/use-credit-cards';

/** Fatura exibida ao abrir: a mais antiga com saldo a pagar; senão, a aberta. */
function defaultInvoice(details: CardDetails): Invoice | undefined {
  const due = details.overview.pendingInvoices[0];
  return (
    (due && details.invoices.find((invoice) => invoice.month === due.month)) ??
    details.invoices.find((invoice) => invoice.month === details.openMonth)
  );
}

type Confirmation =
  | { type: 'cancel-purchase'; purchase: CardPurchase }
  | { type: 'reverse-payment'; payment: PaymentView }
  | { type: 'cancel-card' }
  | { type: 'delete-card' };

export function CreditCardDetailsPage() {
  const { cardId = '' } = useParams();
  const navigate = useNavigate();
  const { today } = useCreditCardsServices();
  const details = useCardDetails(cardId);
  const [params, setParams] = useSearchParams();
  const [editingCard, setEditingCard] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState<PurchaseFormTarget | null>(null);
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const setStatus = useSetCardStatus();
  const deleteCard = useDeleteCard();
  const cancelPurchase = useCancelPurchase();
  const reversePayment = useReversePayment();

  const data = details.data;
  const card = data?.overview.card;

  const requested = params.get('fatura') ?? '';
  const selected =
    (data && isMonthKey(requested)
      ? data.invoices.find((invoice) => invoice.month === requested)
      : undefined) ?? (data ? defaultInvoice(data) : undefined);

  const changeStatus = (status: CardStatus, message: string) => {
    if (!card) return;
    setStatus.mutate(
      { id: card.id, status },
      {
        onSuccess: () => {
          toast.success(message);
          setConfirmation(null);
        },
        onError: (error) => {
          toast.error(getErrorMessage(error));
        },
      },
    );
  };

  const confirm = () => {
    if (!confirmation || !card) return;
    const onError = (error: unknown) => {
      toast.error(getErrorMessage(error));
    };
    switch (confirmation.type) {
      case 'cancel-purchase':
        cancelPurchase.mutate(confirmation.purchase.id, {
          onSuccess: () => {
            toast.success('Compra cancelada. O limite foi liberado.');
            setConfirmation(null);
          },
          onError,
        });
        return;
      case 'reverse-payment':
        reversePayment.mutate(confirmation.payment.transaction.id, {
          onSuccess: () => {
            toast.success('Pagamento estornado.');
            setConfirmation(null);
          },
          onError,
        });
        return;
      case 'cancel-card':
        changeStatus('cancelled', 'Cartão cancelado.');
        return;
      case 'delete-card':
        deleteCard.mutate(card.id, {
          onSuccess: () => {
            toast.success('Cartão excluído.');
            setConfirmation(null);
            void navigate(ROUTES.creditCards, { replace: true });
          },
          onError,
        });
        return;
    }
  };

  const confirmTexts: Record<Confirmation['type'], { title: string; label: string; text: string }> =
    {
      'cancel-purchase': {
        title: 'Cancelar compra?',
        label: 'Cancelar compra',
        text: 'Todas as parcelas saem das faturas e o limite é liberado. A compra continua no histórico.',
      },
      'reverse-payment': {
        title: 'Estornar pagamento?',
        label: 'Estornar',
        text: 'O valor volta para a conta e a fatura passa a ter saldo em aberto novamente.',
      },
      'cancel-card': {
        title: 'Cancelar cartão?',
        label: 'Cancelar cartão',
        text: 'O cartão deixa de aceitar compras e sai dos totais de limite. Faturas em aberto continuam pagáveis.',
      },
      'delete-card': {
        title: 'Excluir cartão?',
        label: 'Excluir',
        text: 'O cartão será removido definitivamente. Só é possível excluir cartões sem compras e pagamentos.',
      },
    };

  const pendingConfirm =
    setStatus.isPending ||
    deleteCard.isPending ||
    cancelPurchase.isPending ||
    reversePayment.isPending;

  return (
    <div className="flex flex-col gap-6">
      <nav
        aria-label="Trilha de navegação"
        className="flex items-center gap-1 text-sm text-muted-foreground"
      >
        <Link to={ROUTES.creditCards} className="hover:text-foreground hover:underline">
          Cartões
        </Link>
        <ChevronRight aria-hidden="true" className="size-4" />
        <span aria-current="page" className="font-medium text-foreground">
          {card?.name ?? 'Detalhes'}
        </span>
      </nav>

      {details.isError ? (
        <StatusScreen
          tone="destructive"
          icon={CloudOff}
          title="Não foi possível carregar o cartão"
          description={getErrorMessage(details.error)}
          actions={
            <Button asChild variant="outline">
              <Link to={ROUTES.creditCards}>Voltar aos cartões</Link>
            </Button>
          }
        />
      ) : !data || !card || !selected ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-28 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-96 rounded-xl" />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h2 className="flex flex-wrap items-center gap-2 text-xl font-semibold tracking-tight">
                {card.name}
                <CardStatusBadge status={card.status} />
              </h2>
              <p className="text-sm text-muted-foreground">
                {[card.institution, CARD_BRAND_LABELS[card.brand]].filter(Boolean).join(' · ')} ·
                fecha dia {card.closingDay}, vence dia {card.dueDay} · paga com{' '}
                {data.overview.paymentAccountName ?? 'conta removida'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {card.status === 'active' && (
                <Button
                  onClick={() => {
                    setPurchaseForm({ type: 'create', cardId: card.id });
                  }}
                >
                  <ShoppingBag aria-hidden="true" />
                  Nova compra
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Ações do cartão">
                    <MoreHorizontal aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={() => {
                      setEditingCard(true);
                    }}
                  >
                    <Pencil aria-hidden="true" />
                    Editar cartão
                  </DropdownMenuItem>
                  {card.status === 'active' && (
                    <DropdownMenuItem
                      onSelect={() => {
                        changeStatus('blocked', 'Cartão bloqueado.');
                      }}
                    >
                      <Lock aria-hidden="true" />
                      Bloquear
                    </DropdownMenuItem>
                  )}
                  {card.status !== 'active' && (
                    <DropdownMenuItem
                      onSelect={() => {
                        changeStatus('active', 'Cartão reativado.');
                      }}
                    >
                      {card.status === 'blocked' ? (
                        <LockOpen aria-hidden="true" />
                      ) : (
                        <RotateCcw aria-hidden="true" />
                      )}
                      {card.status === 'blocked' ? 'Desbloquear' : 'Reativar'}
                    </DropdownMenuItem>
                  )}
                  {card.status !== 'cancelled' && (
                    <DropdownMenuItem
                      onSelect={() => {
                        setConfirmation({ type: 'cancel-card' });
                      }}
                    >
                      <Ban aria-hidden="true" />
                      Cancelar cartão
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => {
                      setConfirmation({ type: 'delete-card' });
                    }}
                  >
                    <Trash2 aria-hidden="true" />
                    Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <section aria-label="Limite do cartão" className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Limite disponível"
              value={formatMoney(data.overview.usage.available)}
              icon={Wallet}
              tone={data.overview.usage.available.isNegative() ? 'negative' : 'default'}
              hint={`de ${formatMoney(card.limit)}`}
            />
            <StatCard
              label="Limite utilizado"
              value={formatMoney(data.overview.usage.used)}
              icon={CreditCardIcon}
              hint={`${formatPercent(Math.round(data.overview.usage.percentUsed ?? 0))} do limite, incluindo parcelas futuras`}
            />
            <StatCard
              label="Parcelas futuras"
              value={formatMoney(data.overview.futureInstallments)}
              icon={CalendarRange}
              hint={`Após a fatura de ${formatMonthShort(data.openMonth)}`}
            />
          </section>

          <InvoicePanel
            invoices={data.invoices}
            selected={selected}
            canPay={data.paymentAccounts.length > 0}
            onSelect={(invoice) => {
              setParams({ fatura: invoice.month }, { replace: true });
            }}
            onPay={(invoice) => {
              // Mantém a fatura em foco após o pagamento (ela deixa de ser a "padrão").
              setParams({ fatura: invoice.month }, { replace: true });
              setPaying(invoice);
            }}
          />

          <div className="grid gap-6 xl:grid-cols-2">
            <PurchasesCard
              purchases={data.purchases}
              editable={card.status === 'active'}
              onEdit={(purchase) => {
                setPurchaseForm({ type: 'edit', purchase });
              }}
              onCancel={(purchase) => {
                setConfirmation({ type: 'cancel-purchase', purchase });
              }}
            />
            <div className="flex flex-col gap-6">
              <FutureInstallmentsCard months={data.futureByMonth} />
              <PaymentsCard
                payments={data.payments}
                onReverse={(payment) => {
                  setConfirmation({ type: 'reverse-payment', payment });
                }}
              />
            </div>
          </div>

          <Card className="gap-4">
            <CardHeader>
              <CardTitle>Histórico de alterações</CardTitle>
            </CardHeader>
            <CardContent>
              <HistoryTimeline entityType="credit_card" entityId={card.id} />
            </CardContent>
          </Card>

          <CardFormDialog
            target={editingCard ? card : null}
            onClose={() => {
              setEditingCard(false);
            }}
          />
          <PurchaseFormDialog
            target={purchaseForm}
            cards={[card]}
            today={today()}
            onClose={() => {
              setPurchaseForm(null);
            }}
          />
          <PayInvoiceDialog
            card={card}
            invoice={paying}
            accounts={data.paymentAccounts}
            today={today()}
            onClose={() => {
              setPaying(null);
            }}
          />
        </>
      )}

      <ConfirmDialog
        open={confirmation !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmation(null);
        }}
        title={confirmation ? confirmTexts[confirmation.type].title : ''}
        description={confirmation ? confirmTexts[confirmation.type].text : ''}
        confirmLabel={confirmation ? confirmTexts[confirmation.type].label : ''}
        destructive
        pending={pendingConfirm}
        onConfirm={confirm}
      />
    </div>
  );
}
