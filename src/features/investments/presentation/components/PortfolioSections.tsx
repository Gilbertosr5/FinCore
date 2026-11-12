import { CloudOff, LineChart } from 'lucide-react';
import { Link } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { assetPath } from '@/constants/routes';
import { formatDateBR, formatMonthLong, formatMonthShort } from '@/lib/dates';
import { formatMoney, formatPercent, Money } from '@/lib/money';
import { cn } from '@/lib/utils';

import { formatQuantity } from './format-quantity';
import { ValueSourceBadge } from './value-source';
import type { PositionView } from '../../application/investment-use-cases';
import { ASSET_CLASS_LABELS, type AssetClass } from '../../domain/entities/investment';
import { MARKET_INDICATOR_LABELS } from '../../domain/entities/market-indicator';
import type { IncomePoint } from '../../domain/services/portfolio-analytics';
import { useMarketIndicators } from '../hooks/use-investments';

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Resultado com sinal e cor + texto (nunca só cor). */
export function SignedMoney({ value, percent }: { value: Money; percent?: number | null }) {
  const negative = value.isNegative();
  return (
    <span className={cn('tabular-nums', negative ? 'text-destructive' : 'text-success')}>
      {value.isPositive() ? '+' : ''}
      {formatMoney(value)}
      {percent !== undefined && percent !== null && (
        <span className="text-xs">
          {' '}
          ({percent > 0 ? '+' : ''}
          {formatPercent(percent)})
        </span>
      )}
    </span>
  );
}

/** Distribuição por classe (barras horizontais acessíveis). */
export function DistributionCard({
  byClass,
  total,
}: {
  byClass: readonly { assetClass: AssetClass; value: Money }[];
  total: Money;
}) {
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>Distribuição por classe</CardTitle>
        <CardDescription>Participação no valor atual da carteira.</CardDescription>
      </CardHeader>
      <CardContent>
        {byClass.length === 0 ? (
          <EmptyState icon={LineChart} title="Sem posições" className="py-6" />
        ) : (
          <ul className="flex flex-col gap-3">
            {byClass.map((item, index) => {
              const share = item.value.percentageOf(total)?.toNumber() ?? 0;
              return (
                <li key={item.assetClass} className="flex flex-col gap-1">
                  <div className="flex justify-between gap-2 text-sm">
                    <span>{ASSET_CLASS_LABELS[item.assetClass]}</span>
                    <span className="tabular-nums">
                      {formatMoney(item.value)}{' '}
                      <span className="text-muted-foreground">({formatPercent(share)})</span>
                    </span>
                  </div>
                  <div
                    aria-hidden="true"
                    className="h-2 w-full overflow-hidden rounded-full bg-muted"
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(share, 100)}%`,
                        backgroundColor: `var(--chart-${(index % 8) + 1})`,
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** Posições: tabela no desktop e cartões no celular. */
export function PositionsCard({ positions }: { positions: readonly PositionView[] }) {
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>Posições</CardTitle>
        <CardDescription>
          Custo pelo preço médio; resultado = valor atual − custo (não realizado).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {positions.length === 0 ? (
          <EmptyState
            icon={LineChart}
            title="Nenhuma posição"
            description="Cadastre um ativo e registre a primeira compra ou aporte."
            className="py-6"
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ativo</TableHead>
                    <TableHead className="text-right">Quantidade</TableHead>
                    <TableHead className="text-right">Preço médio</TableHead>
                    <TableHead className="text-right">Custo</TableHead>
                    <TableHead className="text-right">Valor atual</TableHead>
                    <TableHead className="text-right">Resultado</TableHead>
                    <TableHead className="text-right">Carteira</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {positions.map(({ position, share }) => (
                    <TableRow key={position.asset.id}>
                      <TableCell>
                        <Link
                          to={assetPath(position.asset.id)}
                          className="font-medium hover:underline"
                        >
                          {position.asset.ticker ?? position.asset.name}
                        </Link>
                        <span className="block text-xs text-muted-foreground">
                          {ASSET_CLASS_LABELS[position.asset.assetClass]}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {position.quantity ? formatQuantity(position.quantity) : '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {position.averagePrice ? formatMoney(position.averagePrice) : '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(position.costBasis)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="block tabular-nums">
                          {formatMoney(position.currentValue)}
                        </span>
                        <ValueSourceBadge position={position} />
                      </TableCell>
                      <TableCell className="text-right">
                        <SignedMoney value={position.unrealizedResult} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatPercent(share)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ul aria-label="Posições" className="flex flex-col divide-y divide-border md:hidden">
              {positions.map(({ position, share }) => (
                <li key={position.asset.id} className="flex flex-col gap-1 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <Link to={assetPath(position.asset.id)} className="font-medium hover:underline">
                      {position.asset.ticker ?? position.asset.name}
                    </Link>
                    <span className="font-semibold tabular-nums">
                      {formatMoney(position.currentValue)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>
                      {ASSET_CLASS_LABELS[position.asset.assetClass]} · {formatPercent(share)} da
                      carteira
                    </span>
                    <SignedMoney value={position.unrealizedResult} />
                  </div>
                  <ValueSourceBadge position={position} />
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** Proventos líquidos dos últimos 12 meses. */
export function IncomeCard({ points }: { points: readonly IncomePoint[] }) {
  const total = Money.sum(points.map((item) => item.amount));
  const max = points.reduce(
    (value, item) => (item.amount.greaterThan(value) ? item.amount : value),
    Money.zero(),
  );
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>Proventos (12 meses)</CardTitle>
        <CardDescription>Dividendos, juros e rendimentos líquidos de impostos.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <caption className="sr-only">Proventos por mês</caption>
          <TableHeader>
            <TableRow>
              <TableHead>Mês</TableHead>
              <TableHead className="w-1/2" aria-hidden="true" />
              <TableHead className="text-right">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {points.map((item) => {
              const width = max.isZero() ? 0 : (item.amount.percentageOf(max)?.toNumber() ?? 0);
              return (
                <TableRow key={item.month}>
                  <TableCell className="whitespace-nowrap">
                    <span aria-hidden="true">{capitalize(formatMonthShort(item.month))}</span>
                    <span className="sr-only">{formatMonthLong(item.month)}</span>
                  </TableCell>
                  <TableCell aria-hidden="true">
                    <div
                      className="h-2 rounded-full bg-primary/70"
                      style={{ width: `${Math.max(width, 0)}%` }}
                    />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(item.amount)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={2} className="font-semibold">
                Total
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {formatMoney(total)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </CardContent>
    </Card>
  );
}

/**
 * Indicadores de mercado: a integração ainda não existe. Exibe a
 * indisponibilidade de forma explícita — nunca valores inventados.
 */
export function MarketIndicatorsCard() {
  const market = useMarketIndicators();
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>Indicadores de mercado</CardTitle>
        <CardDescription>CDI, IPCA, Selic e Ibovespa para comparação.</CardDescription>
      </CardHeader>
      <CardContent>
        {market.isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : market.isError || !market.data.available ? (
          <EmptyState
            icon={CloudOff}
            title="Integração ainda não disponível"
            description="Os indicadores virão de uma fonte externa via backend (contrato documentado). Nenhum valor é estimado aqui."
            className="py-4"
          />
        ) : (
          <ul className="grid grid-cols-2 gap-3 text-sm">
            {market.data.quotes.map((quote) => (
              <li key={quote.code} className="flex flex-col rounded-lg bg-muted/50 p-3">
                <span className="text-xs text-muted-foreground">
                  {MARKET_INDICATOR_LABELS[quote.code]}
                </span>
                <span className="font-semibold tabular-nums">
                  {quote.unit === 'points'
                    ? quote.value
                    : `${quote.value.replace('.', ',')}%${quote.unit === 'percent_year' ? ' a.a.' : ' (12m)'}`}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDateBR(quote.date)} · {quote.source}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">Aviso</Badge>
          Informações apenas para acompanhamento — não são recomendação de investimento.
        </p>
      </CardContent>
    </Card>
  );
}
