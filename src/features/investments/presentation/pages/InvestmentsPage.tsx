import { Coins, CloudOff, Landmark, Plus, TrendingUp, Wallet } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { StatCard } from '@/components/data-display/StatCard';
import { TrendChart } from '@/components/data-display/TrendChart';
import { StatusScreen } from '@/components/feedback/StatusScreen';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { assetPath } from '@/constants/routes';
import { getErrorMessage } from '@/lib/errors';
import { formatMoney, Money } from '@/lib/money';

import { ASSET_CLASS_LABELS } from '../../domain/entities/investment';
import { AssetFormDialog } from '../components/AssetFormDialog';
import {
  DistributionCard,
  IncomeCard,
  MarketIndicatorsCard,
  PositionsCard,
  SignedMoney,
} from '../components/PortfolioSections';
import { usePortfolio } from '../hooks/use-investments';

/** Carteira: valor atual, custo, retorno, proventos, distribuição e evolução. */
export function InvestmentsPage() {
  const navigate = useNavigate();
  const portfolio = usePortfolio();
  const [creating, setCreating] = useState(false);

  if (portfolio.isError) {
    return (
      <StatusScreen
        tone="destructive"
        icon={CloudOff}
        title="Não foi possível carregar a carteira"
        description={getErrorMessage(portfolio.error)}
        actions={
          <Button
            onClick={() => {
              void portfolio.refetch();
            }}
          >
            Tentar novamente
          </Button>
        }
      />
    );
  }

  const data = portfolio.data;
  const summary = data?.summary;
  const income12m = data ? Money.sum(data.incomeByMonth.map((item) => item.amount)) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Valores informados manualmente ou estimados — sem cotações automáticas e sem recomendações
          de investimento.
        </p>
        <Button
          onClick={() => {
            setCreating(true);
          }}
        >
          <Plus aria-hidden="true" />
          Novo ativo
        </Button>
      </div>

      <section aria-label="Resumo da carteira" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summary && income12m ? (
          <>
            <StatCard
              label="Valor atual"
              value={formatMoney(summary.currentValue)}
              icon={Wallet}
              badge={
                summary.hasEstimatedValues ? (
                  <Badge variant="warning">Inclui estimativas</Badge>
                ) : undefined
              }
            />
            <StatCard
              label="Custo das posições"
              value={formatMoney(summary.costBasis)}
              icon={Landmark}
              hint={`Aplicado líquido: ${formatMoney(summary.netInvested)}`}
            />
            <StatCard
              label="Retorno total"
              value={formatMoney(summary.totalReturn)}
              icon={TrendingUp}
              tone={summary.totalReturn.isNegative() ? 'negative' : 'positive'}
              hint={
                <span>
                  Não realizado <SignedMoney value={summary.unrealizedResult} /> · realizado{' '}
                  <SignedMoney value={summary.realizedResult} />
                </span>
              }
            />
            <StatCard
              label="Proventos (12 meses)"
              value={formatMoney(income12m)}
              icon={Coins}
              hint={`Desde o início: ${formatMoney(summary.incomeReceived)}`}
            />
          </>
        ) : (
          Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-28 rounded-xl" />
          ))
        )}
      </section>

      {data && summary ? (
        <>
          <TrendChart
            title="Evolução da carteira"
            description="Valor atual no fim de cada mês × valor aplicado líquido"
            valueLabel="Valor da carteira"
            referenceLabel="Valor aplicado"
            points={data.evolution.map((point) => ({
              month: point.month,
              value: point.value,
              reference: point.invested,
            }))}
            footer={
              summary.totalReturnPercent !== null
                ? `Retorno total simples sobre o aplicado: ${summary.totalReturnPercent.toFixed(2).replace('.', ',')}% (não é rentabilidade ponderada no tempo).`
                : undefined
            }
          />
          <PositionsCard positions={data.positions} />
          <div className="grid gap-6 xl:grid-cols-2">
            <DistributionCard byClass={summary.byClass} total={summary.currentValue} />
            <IncomeCard points={data.incomeByMonth} />
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <MarketIndicatorsCard />
            {data.inactiveAssets.length > 0 && (
              <Card className="gap-4">
                <CardHeader>
                  <CardTitle>Ativos sem posição</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="divide-y divide-border text-sm">
                    {data.inactiveAssets.map((asset) => (
                      <li key={asset.id} className="flex justify-between gap-2 py-2">
                        <Link to={assetPath(asset.id)} className="font-medium hover:underline">
                          {asset.ticker ?? asset.name}
                        </Link>
                        <span className="text-muted-foreground">
                          {ASSET_CLASS_LABELS[asset.assetClass]}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      ) : (
        <Skeleton className="h-96 rounded-xl" />
      )}

      <AssetFormDialog
        target={creating ? 'new' : null}
        onClose={() => {
          setCreating(false);
        }}
        onCreated={(asset) => {
          void navigate(`${assetPath(asset.id)}?nova=1`);
        }}
      />
    </div>
  );
}
