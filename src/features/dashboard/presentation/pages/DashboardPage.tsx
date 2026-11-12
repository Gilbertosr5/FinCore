import { CloudOff, FlaskConical, RefreshCw } from 'lucide-react';

import { TrendChart } from '@/components/data-display/TrendChart';
import { StatusScreen } from '@/components/feedback/StatusScreen';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { getErrorMessage } from '@/lib/errors';

import { AlertsPanel } from '../components/AlertsPanel';
import { BudgetsPanel } from '../components/BudgetsPanel';
import { DonutChart } from '../components/charts/DonutChart';
import { IncomeExpenseChart } from '../components/charts/IncomeExpenseChart';
import { DashboardSkeleton } from '../components/DashboardSkeleton';
import { GoalsPanel } from '../components/GoalsPanel';
import { KpiGrid } from '../components/KpiGrid';
import { PeriodFilter } from '../components/PeriodFilter';
import { RecentActivity } from '../components/RecentActivity';
import { UpcomingBillsPanel, UpcomingInvoicesPanel } from '../components/UpcomingPanels';
import { useDashboardServices } from '../context/dashboard-context';
import { useDashboardOverview } from '../hooks/use-dashboard-overview';
import { usePeriodSelection } from '../hooks/use-period-selection';

export function DashboardPage() {
  const [selection, setSelection] = usePeriodSelection();
  const { isDemoData } = useDashboardServices();
  const { data, error, isPending, isError, isPlaceholderData, isFetching, refetch } =
    useDashboardOverview(selection);

  const header = (
    <div className="flex flex-col gap-3">
      <PeriodFilter selection={selection} range={data?.range} onChange={setSelection} />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {isDemoData && (
          <span className="flex items-center gap-1.5">
            <FlaskConical aria-hidden="true" className="size-3.5" />
            Dados de demonstração, armazenados apenas neste navegador.
          </span>
        )}
        {isFetching && !isPending && (
          <span role="status" className="flex items-center gap-1.5">
            <Spinner className="size-3.5" />
            Atualizando…
          </span>
        )}
      </div>
    </div>
  );

  if (isPending) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <DashboardSkeleton />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <StatusScreen
          tone="destructive"
          icon={CloudOff}
          title="Não foi possível carregar o dashboard"
          description={getErrorMessage(error)}
          actions={
            <Button
              onClick={() => {
                void refetch();
              }}
            >
              <RefreshCw aria-hidden="true" />
              Tentar novamente
            </Button>
          }
        />
      </div>
    );
  }

  const overview = data;
  return (
    <div
      className="flex flex-col gap-6 transition-opacity data-[stale=true]:opacity-60"
      data-stale={isPlaceholderData}
      aria-busy={isPlaceholderData}
    >
      {header}
      <AlertsPanel alerts={overview.alerts} />
      <KpiGrid overview={overview} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <IncomeExpenseChart monthly={overview.monthly} />
        </div>
        <DonutChart
          title="Despesas por categoria"
          description="No período selecionado, incluindo compras no cartão."
          slices={overview.expensesByCategory}
          emptyTitle="Nenhuma despesa no período"
          totalLabel="Total"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TrendChart
          title="Evolução do patrimônio"
          description="Contas + investimentos − dívidas de cartão, no fim de cada mês."
          valueLabel="Patrimônio líquido"
          points={overview.monthly.map((point) => ({ month: point.month, value: point.netWorth }))}
        />
        <TrendChart
          title="Evolução mensal do saldo"
          description="Soma dos saldos das contas no fim de cada mês."
          valueLabel="Saldo em contas"
          points={overview.monthly.map((point) => ({
            month: point.month,
            value: point.accountsBalance,
          }))}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <DonutChart
          title="Distribuição patrimonial"
          description="Composição dos ativos hoje."
          slices={overview.allocation}
          emptyTitle="Sem patrimônio registrado"
          totalLabel="Ativos"
        />
        <div className="min-w-0 lg:col-span-2">
          <TrendChart
            title="Evolução dos investimentos"
            description="Valor da carteira comparado ao valor aplicado."
            valueLabel="Valor da carteira"
            referenceLabel="Aplicado líquido"
            points={overview.monthly.map((point) => ({
              month: point.month,
              value: point.investmentsValue,
              reference: point.investmentsNetInvested,
            }))}
            footer={
              overview.portfolio.hasEstimatedValues
                ? 'Parte da carteira usa valores informados manualmente ou estimados — não representa cotação de mercado nem rentabilidade garantida.'
                : 'Valores informados manualmente.'
            }
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <RecentActivity items={overview.recentActivity} />
        </div>
        <UpcomingBillsPanel bills={overview.upcomingBills} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <UpcomingInvoicesPanel invoices={overview.upcomingInvoices} />
        <BudgetsPanel budgets={overview.budgets} />
        <GoalsPanel goals={overview.goals} />
      </div>
    </div>
  );
}
