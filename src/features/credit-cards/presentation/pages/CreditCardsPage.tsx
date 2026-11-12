import {
  CalendarClock,
  CloudOff,
  CreditCard as CreditCardIcon,
  Plus,
  ShoppingBag,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { ProgressBar } from '@/components/data-display/ProgressBar';
import { StatCard } from '@/components/data-display/StatCard';
import { EmptyState } from '@/components/feedback/EmptyState';
import { StatusScreen } from '@/components/feedback/StatusScreen';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { creditCardPath } from '@/constants/routes';
import { formatDateBR, formatMonthShort } from '@/lib/dates';
import { getErrorMessage } from '@/lib/errors';
import { formatMoney, formatPercent } from '@/lib/money';
import { cn } from '@/lib/utils';

import type { CardOverview } from '../../application/card-queries';
import { CARD_BRAND_LABELS } from '../../domain/entities/credit-card';
import { CardStatusBadge, InvoiceStatusBadge } from '../components/card-badges';
import { CardFormDialog } from '../components/CardFormDialog';
import { limitTone } from '../components/limit-tone';
import { PurchaseFormDialog, type PurchaseFormTarget } from '../components/PurchaseFormDialog';
import { useCreditCardsServices } from '../context/credit-cards-context';
import { useCardsSummary } from '../hooks/use-credit-cards';

/** Cartões: limites, fatura aberta, faturas a pagar e atalhos para compras. */
export function CreditCardsPage() {
  const { today } = useCreditCardsServices();
  const summary = useCardsSummary();
  const [cardForm, setCardForm] = useState<'new' | null>(null);
  const [purchaseForm, setPurchaseForm] = useState<PurchaseFormTarget | null>(null);

  if (summary.isError) {
    return (
      <StatusScreen
        tone="destructive"
        icon={CloudOff}
        title="Não foi possível carregar os cartões"
        description={getErrorMessage(summary.error)}
        actions={
          <Button
            onClick={() => {
              void summary.refetch();
            }}
          >
            Tentar novamente
          </Button>
        }
      />
    );
  }

  const data = summary.data;
  const cards = data?.cards ?? [];
  const hasActive = cards.some((item) => item.card.status === 'active');

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Compras comprometem o limite; o saldo da conta só muda ao pagar a fatura.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={!hasActive}
            onClick={() => {
              setPurchaseForm({ type: 'create' });
            }}
          >
            <ShoppingBag aria-hidden="true" />
            Nova compra
          </Button>
          <Button
            onClick={() => {
              setCardForm('new');
            }}
          >
            <Plus aria-hidden="true" />
            Novo cartão
          </Button>
        </div>
      </div>

      <section aria-label="Resumo dos cartões" className="grid gap-4 sm:grid-cols-3">
        {data ? (
          <>
            <StatCard
              label="Limite disponível"
              value={formatMoney(data.totalAvailable)}
              icon={Wallet}
              hint={`de ${formatMoney(data.totalLimit)} no total`}
              tone={data.totalAvailable.isNegative() ? 'negative' : 'default'}
            />
            <StatCard
              label="Limite utilizado"
              value={formatMoney(data.totalUsed)}
              icon={CreditCardIcon}
              hint="Inclui parcelas futuras"
            />
            <StatCard
              label="Faturas a pagar"
              value={formatMoney(data.totalDue)}
              icon={CalendarClock}
              hint="Faturas fechadas com saldo em aberto"
              tone={data.totalDue.isPositive() ? 'warning' : 'default'}
            />
          </>
        ) : (
          Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-28 rounded-xl" />
          ))
        )}
      </section>

      {!data ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 2 }, (_, index) => (
            <Skeleton key={index} className="h-64 rounded-xl" />
          ))}
        </div>
      ) : cards.length === 0 ? (
        <Card>
          <EmptyState
            icon={CreditCardIcon}
            title="Nenhum cartão cadastrado"
            description="Cadastre um cartão para registrar compras e acompanhar as faturas."
            action={
              <Button
                size="sm"
                onClick={() => {
                  setCardForm('new');
                }}
              >
                Novo cartão
              </Button>
            }
          />
        </Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((overview) => (
            <li key={overview.card.id}>
              <CardSummaryItem overview={overview} />
            </li>
          ))}
        </ul>
      )}

      <CardFormDialog
        target={cardForm}
        onClose={() => {
          setCardForm(null);
        }}
      />
      <PurchaseFormDialog
        target={purchaseForm}
        cards={cards.map((item) => item.card)}
        today={today()}
        onClose={() => {
          setPurchaseForm(null);
        }}
      />
    </div>
  );
}

function CardSummaryItem({ overview }: { overview: CardOverview }) {
  const { card, usage, openInvoice, pendingInvoices } = overview;
  const percent = usage.percentUsed ?? 0;
  const nextDue = pendingInvoices[0];
  return (
    <Card className={cn('relative h-full gap-4', card.status === 'cancelled' && 'opacity-70')}>
      <CardHeader className="flex-row items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <CardTitle className="truncate">
            <Link
              to={creditCardPath(card.id)}
              className="outline-none after:absolute after:inset-0 hover:underline focus-visible:underline"
            >
              {card.name}
            </Link>
          </CardTitle>
          <p className="truncate text-xs text-muted-foreground">
            {[card.institution, CARD_BRAND_LABELS[card.brand]].filter(Boolean).join(' · ')} · fecha
            dia {card.closingDay}, vence dia {card.dueDay}
          </p>
        </div>
        <CardStatusBadge status={card.status} />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="text-muted-foreground">Disponível</span>
            <span
              className={cn(
                'text-lg font-semibold tabular-nums',
                usage.available.isNegative() && 'text-destructive',
              )}
            >
              {formatMoney(usage.available)}
            </span>
          </div>
          <ProgressBar
            value={percent}
            tone={limitTone(usage.percentUsed)}
            label={`Limite utilizado do ${card.name}`}
            valueText={`${formatPercent(Math.round(percent))} utilizado`}
          />
          <p className="text-xs text-muted-foreground tabular-nums">
            {formatMoney(usage.used)} utilizados de {formatMoney(card.limit)} (
            {formatPercent(Math.round(percent))})
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-3 text-xs">
          <div className="flex flex-col gap-1">
            <dt className="text-muted-foreground">
              Fatura aberta ({formatMonthShort(openInvoice.month)})
            </dt>
            <dd className="font-medium tabular-nums">{formatMoney(openInvoice.total)}</dd>
            <dd className="text-muted-foreground">fecha {formatDateBR(openInvoice.closingDate)}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-muted-foreground">A pagar</dt>
            {nextDue ? (
              <>
                <dd className="font-medium tabular-nums">{formatMoney(nextDue.outstanding)}</dd>
                <dd className="flex flex-wrap items-center gap-1">
                  <InvoiceStatusBadge status={nextDue.status} />
                  <span className="text-muted-foreground">
                    vence {formatDateBR(nextDue.dueDate)}
                  </span>
                </dd>
              </>
            ) : (
              <dd className="text-muted-foreground">Nenhuma fatura em aberto</dd>
            )}
          </div>
        </dl>
        {overview.futureInstallments.isPositive() && (
          <p className="text-xs text-muted-foreground">
            Parcelas futuras: {formatMoney(overview.futureInstallments)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
