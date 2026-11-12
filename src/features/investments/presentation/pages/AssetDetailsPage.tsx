import {
  ChevronRight,
  CloudOff,
  Coins,
  Hash,
  Landmark,
  Pencil,
  Plus,
  RefreshCcw,
  Trash2,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';

import { StatCard } from '@/components/data-display/StatCard';
import { TrendChart } from '@/components/data-display/TrendChart';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { EmptyState } from '@/components/feedback/EmptyState';
import { StatusScreen } from '@/components/feedback/StatusScreen';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ROUTES } from '@/constants/routes';
import { HistoryTimeline } from '@/features/history';
import { formatDateBR, formatMonthLong, toMonthKey } from '@/lib/dates';
import { getErrorMessage } from '@/lib/errors';
import { formatMoney, formatPercent } from '@/lib/money';

import {
  ASSET_CLASS_LABELS,
  MOVEMENT_TYPE_LABELS,
  VALUATION_SOURCE_LABELS,
  type AssetValuation,
  type InvestmentMovement,
} from '../../domain/entities/investment';
import { AssetFormDialog } from '../components/AssetFormDialog';
import { formatQuantity } from '../components/format-quantity';
import { MovementDialog } from '../components/MovementDialog';
import { SignedMoney } from '../components/PortfolioSections';
import { ValuationDialog, type ValuationTarget } from '../components/ValuationDialog';
import { ValueSourceBadge } from '../components/value-source';
import { useInvestmentsServices } from '../context/investments-context';
import {
  useAssetDetails,
  useDeleteAsset,
  useRemoveMovement,
  useRemoveValuation,
} from '../hooks/use-investments';

type Removal =
  | { type: 'movement'; movement: InvestmentMovement }
  | { type: 'valuation'; valuation: AssetValuation }
  | { type: 'asset' };

const OUTFLOW = new Set(['sell', 'redemption', 'fee', 'tax']);

export function AssetDetailsPage() {
  const { assetId = '' } = useParams();
  const navigate = useNavigate();
  const { today } = useInvestmentsServices();
  const details = useAssetDetails(assetId);
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState(false);
  const [valuation, setValuation] = useState<ValuationTarget | null>(null);
  const [removal, setRemoval] = useState<Removal | null>(null);
  const removeMovement = useRemoveMovement();
  const removeValuation = useRemoveValuation();
  const deleteAsset = useDeleteAsset();

  const data = details.data;
  const position = data?.position;
  const asset = position?.asset;
  const movementOpen = params.get('nova') === '1';
  const setMovementOpen = (open: boolean) => {
    setParams(open ? { nova: '1' } : {}, { replace: true });
  };

  const confirmRemoval = () => {
    if (!removal) return;
    const onError = (error: unknown) => {
      toast.error(getErrorMessage(error));
    };
    const done = (message: string) => () => {
      toast.success(message);
      setRemoval(null);
    };
    if (removal.type === 'movement') {
      removeMovement.mutate(removal.movement.id, {
        onSuccess: done('Movimentação excluída.'),
        onError,
      });
    } else if (removal.type === 'valuation') {
      removeValuation.mutate(removal.valuation.id, {
        onSuccess: done('Avaliação excluída.'),
        onError,
      });
    } else {
      deleteAsset.mutate(assetId, {
        onSuccess: () => {
          toast.success('Ativo excluído.');
          setRemoval(null);
          void navigate(ROUTES.investments, { replace: true });
        },
        onError,
      });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <nav
        aria-label="Trilha de navegação"
        className="flex items-center gap-1 text-sm text-muted-foreground"
      >
        <Link to={ROUTES.investments} className="hover:text-foreground hover:underline">
          Investimentos
        </Link>
        <ChevronRight aria-hidden="true" className="size-4" />
        <span aria-current="page" className="font-medium text-foreground">
          {asset ? (asset.ticker ?? asset.name) : 'Ativo'}
        </span>
      </nav>

      {details.isError ? (
        <StatusScreen
          tone="destructive"
          icon={CloudOff}
          title="Não foi possível carregar o ativo"
          description={getErrorMessage(details.error)}
          actions={
            <Button asChild variant="outline">
              <Link to={ROUTES.investments}>Voltar à carteira</Link>
            </Button>
          }
        />
      ) : !data || !position || !asset ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-28 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-80 rounded-xl" />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-semibold tracking-tight">
                {asset.name}
                {asset.ticker && (
                  <span className="ml-2 text-base text-muted-foreground">{asset.ticker}</span>
                )}
              </h2>
              <p className="text-sm text-muted-foreground">
                {[ASSET_CLASS_LABELS[asset.assetClass], asset.institution]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {asset.notes && <p className="text-sm">{asset.notes}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  setMovementOpen(true);
                }}
              >
                <Plus aria-hidden="true" />
                Nova movimentação
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setValuation({
                    assetId: asset.id,
                    assetName: asset.ticker ?? asset.name,
                    date: today(),
                    value: position.currentValue,
                  });
                }}
              >
                <RefreshCcw aria-hidden="true" />
                Atualizar valor
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label="Editar ativo"
                onClick={() => {
                  setEditing(true);
                }}
              >
                <Pencil aria-hidden="true" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label="Excluir ativo"
                onClick={() => {
                  setRemoval({ type: 'asset' });
                }}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
          </div>

          <section aria-label="Posição" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Valor atual"
              value={formatMoney(position.currentValue)}
              icon={Wallet}
              badge={<ValueSourceBadge position={position} />}
              hint={
                position.valuationDate
                  ? `Avaliado em ${formatDateBR(position.valuationDate)}`
                  : VALUATION_SOURCE_LABELS.cost
              }
            />
            <StatCard
              label="Custo da posição"
              value={formatMoney(position.costBasis)}
              icon={Landmark}
              hint={`Total aplicado: ${formatMoney(position.totalInvested)}`}
            />
            <StatCard
              label={position.quantity !== null ? 'Quantidade · preço médio' : 'Quantidade'}
              value={position.quantity !== null ? formatQuantity(position.quantity) : '—'}
              icon={Hash}
              hint={
                position.averagePrice
                  ? `Preço médio ${formatMoney(position.averagePrice)}`
                  : 'Ativo sem quantidade (renda fixa/fundo)'
              }
            />
            <StatCard
              label="Retorno total"
              value={formatMoney(position.totalReturn)}
              icon={TrendingUp}
              tone={position.totalReturn.isNegative() ? 'negative' : 'positive'}
              hint={
                position.totalReturnPercent !== null
                  ? `${formatPercent(position.totalReturnPercent)} sobre o aplicado (simples)`
                  : undefined
              }
            />
          </section>

          <Card className="gap-3">
            <CardContent>
              <dl className="grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-muted-foreground">Resultado não realizado</dt>
                  <dd>
                    <SignedMoney value={position.unrealizedResult} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Resultado realizado (vendas)</dt>
                  <dd>
                    <SignedMoney value={position.realizedResult} />
                  </dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Coins aria-hidden="true" className="size-3" /> Proventos líquidos
                  </dt>
                  <dd className="tabular-nums">{formatMoney(position.incomeReceived)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <TrendChart
            title="Evolução da posição"
            description="Valor no fim de cada mês × valor aplicado líquido"
            valueLabel="Valor da posição"
            referenceLabel="Valor aplicado"
            points={data.evolution.map((point) => ({
              month: point.month,
              value: point.value,
              reference: point.invested,
            }))}
          />

          <div className="grid gap-6 xl:grid-cols-2">
            <Card className="gap-4">
              <CardHeader>
                <CardTitle>Movimentações</CardTitle>
              </CardHeader>
              <CardContent>
                {data.movements.length === 0 ? (
                  <EmptyState
                    icon={TrendingUp}
                    title="Nenhuma movimentação"
                    description="Registre a primeira compra ou aporte."
                    className="py-6"
                  />
                ) : (
                  <ul aria-label="Movimentações do ativo" className="divide-y divide-border">
                    {data.movements.map((movement) => (
                      <li key={movement.id} className="flex items-center gap-3 py-2 text-sm">
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="flex flex-wrap items-center gap-2 font-medium">
                            {MOVEMENT_TYPE_LABELS[movement.type]}
                            {movement.transactionId && <Badge variant="secondary">com conta</Badge>}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDateBR(movement.date)}
                            {movement.quantity && ` · ${formatQuantity(movement.quantity)} un.`}
                          </span>
                        </div>
                        <span className="shrink-0 font-medium tabular-nums">
                          {OUTFLOW.has(movement.type) ? '−' : '+'}
                          {formatMoney(movement.amount)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Excluir ${MOVEMENT_TYPE_LABELS[movement.type].toLowerCase()} de ${formatDateBR(movement.date)}`}
                          onClick={() => {
                            setRemoval({ type: 'movement', movement });
                          }}
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
            <Card className="gap-4">
              <CardHeader>
                <CardTitle>Avaliações (valor atual)</CardTitle>
              </CardHeader>
              <CardContent>
                {data.valuations.length === 0 ? (
                  <EmptyState
                    icon={RefreshCcw}
                    title="Sem avaliações"
                    description="Sem avaliação, o valor atual exibido é o custo."
                    className="py-6"
                  />
                ) : (
                  <ul
                    aria-label="Avaliações do ativo"
                    className="max-h-96 divide-y divide-border overflow-y-auto"
                  >
                    {data.valuations.map((item) => (
                      <li key={item.id} className="flex items-center gap-3 py-2 text-sm">
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="font-medium">
                            {formatMonthLong(toMonthKey(item.date))}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDateBR(item.date)} · {VALUATION_SOURCE_LABELS[item.source]}
                          </span>
                        </div>
                        <span className="shrink-0 tabular-nums">{formatMoney(item.value)}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Excluir avaliação de ${formatDateBR(item.date)}`}
                          onClick={() => {
                            setRemoval({ type: 'valuation', valuation: item });
                          }}
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="gap-4">
            <CardHeader>
              <CardTitle>Histórico de alterações</CardTitle>
            </CardHeader>
            <CardContent>
              <HistoryTimeline entityType="asset" entityId={asset.id} />
            </CardContent>
          </Card>

          <MovementDialog
            open={movementOpen}
            details={data}
            today={today()}
            onClose={() => {
              setMovementOpen(false);
            }}
            onRevaluation={(suggestion) => {
              setValuation({
                assetId: suggestion.assetId,
                assetName: asset.ticker ?? asset.name,
                date: suggestion.date,
                value: suggestion.suggestedValue,
                reason: `A última avaliação (${formatDateBR(suggestion.date)}) não inclui esta movimentação. Confirme o valor atual — sugerimos o valor anterior ajustado pela operação.`,
              });
            }}
          />
          <ValuationDialog
            target={valuation}
            today={today()}
            onClose={() => {
              setValuation(null);
            }}
          />
          <AssetFormDialog
            target={editing ? asset : null}
            onClose={() => {
              setEditing(false);
            }}
          />
        </>
      )}

      <ConfirmDialog
        open={removal !== null}
        onOpenChange={(open) => {
          if (!open) setRemoval(null);
        }}
        title={
          removal?.type === 'asset'
            ? 'Excluir ativo?'
            : removal?.type === 'valuation'
              ? 'Excluir avaliação?'
              : 'Excluir movimentação?'
        }
        description={
          removal?.type === 'asset'
            ? 'Só é possível excluir ativos sem movimentações. As avaliações serão removidas junto.'
            : removal?.type === 'valuation'
              ? 'O valor atual passará a usar a avaliação anterior (ou o custo).'
              : removal?.type === 'movement' && removal.movement.transactionId
                ? 'A movimentação e o lançamento na conta registrado junto com ela serão excluídos.'
                : 'A movimentação será excluída e a posição recalculada.'
        }
        confirmLabel="Excluir"
        destructive
        pending={removeMovement.isPending || removeValuation.isPending || deleteAsset.isPending}
        onConfirm={confirmRemoval}
      />
    </div>
  );
}
