import {
  ArrowDownCircle,
  ArrowUpCircle,
  CreditCard,
  Landmark,
  PiggyBank,
  Scale,
  TrendingUp,
  Wallet,
} from 'lucide-react';

import { StatCard, type StatTone } from '@/components/data-display/StatCard';
import { Badge } from '@/components/ui/badge';
import { formatMoney, formatPercent, Money } from '@/lib/money';

import type { DashboardOverview } from '../../domain/overview-types';

const toneOf = (value: Money): StatTone =>
  value.isNegative() ? 'negative' : value.isPositive() ? 'positive' : 'default';

export function KpiGrid({ overview }: { overview: DashboardOverview }) {
  const { totals, portfolio } = overview;
  const cardLimit = Money.sum(overview.cards.map((card) => card.limit));

  return (
    <section
      aria-label="Indicadores principais"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      <StatCard
        label="Patrimônio líquido"
        icon={Scale}
        value={formatMoney(overview.netWorth)}
        tone={overview.netWorth.isNegative() ? 'negative' : 'default'}
        hint="Contas + investimentos − faturas"
      />
      <StatCard
        label="Saldo em contas"
        icon={Landmark}
        value={formatMoney(overview.accountsBalance)}
        tone={overview.accountsBalance.isNegative() ? 'negative' : 'default'}
        hint={`${overview.accountBalances.length} contas ativas`}
      />
      <StatCard
        label="Receitas do período"
        icon={ArrowUpCircle}
        value={formatMoney(totals.income)}
        hint={
          totals.incomePending.isPositive()
            ? `${formatMoney(totals.incomePending)} a receber`
            : 'Todas recebidas'
        }
      />
      <StatCard
        label="Despesas do período"
        icon={ArrowDownCircle}
        value={formatMoney(totals.expenses)}
        hint={
          totals.expensesPending.isPositive()
            ? `${formatMoney(totals.expensesPending)} a pagar`
            : 'Inclui compras no cartão'
        }
      />
      <StatCard
        label="Resultado do período"
        icon={Wallet}
        value={formatMoney(totals.result, { signDisplay: 'exceptZero' })}
        tone={toneOf(totals.result)}
        hint="Receitas − despesas (competência)"
      />
      <StatCard
        label="Taxa de economia"
        icon={PiggyBank}
        value={totals.savingsRate === null ? '—' : formatPercent(totals.savingsRate)}
        tone={
          totals.savingsRate === null
            ? 'default'
            : totals.savingsRate < 0
              ? 'negative'
              : totals.savingsRate >= 20
                ? 'positive'
                : 'warning'
        }
        hint={totals.savingsRate === null ? 'Sem receitas no período' : 'Do total de receitas'}
      />
      <StatCard
        label="Total investido"
        icon={TrendingUp}
        value={formatMoney(portfolio.currentValue)}
        hint={`Aplicado líquido ${formatMoney(portfolio.netInvested)}`}
        badge={
          portfolio.hasEstimatedValues ? (
            <Badge variant="secondary" title="Parte da carteira usa valores estimados">
              Inclui estimativas
            </Badge>
          ) : undefined
        }
      />
      <StatCard
        label="Comprometido em faturas"
        icon={CreditCard}
        value={formatMoney(overview.cardCommitment)}
        hint={`Inclui parcelas futuras · limite total ${formatMoney(cardLimit)}`}
      />
    </section>
  );
}
