import {
  CloudOff,
  FileDown,
  FileSpreadsheet,
  Gauge,
  Landmark,
  PiggyBank,
  Scale,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';

import { StatCard } from '@/components/data-display/StatCard';
import { TrendChart } from '@/components/data-display/TrendChart';
import { StatusScreen } from '@/components/feedback/StatusScreen';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import {
  parsePeriodParams,
  PeriodFilter,
  periodToParams,
  resolvePeriod,
  type PeriodSelection,
} from '@/features/dashboard';
import { asMonthKey, formatDateBR } from '@/lib/dates';
import { getErrorMessage } from '@/lib/errors';
import { downloadBlob, safeFileName } from '@/lib/export/download';
import { formatMoney, formatPercent } from '@/lib/money';

import type { ReportFilters } from '../../domain/report-data';
import {
  buildReport,
  computeIndicators,
  REPORT_INFO,
  REPORT_KINDS,
  type ReportKind,
} from '../../domain/reports';
import { ReportTableView } from '../components/ReportTableView';
import { useReportsServices } from '../context/reports-context';
import { reportToCsv, reportToPdf } from '../export/report-export';
import { useReportSnapshot } from '../hooks/use-reports';

const ALL_ACCOUNTS = '__all__';
const KIND_BY_SLUG = new Map(REPORT_KINDS.map((kind) => [REPORT_INFO[kind].slug, kind]));
const percentText = (value: number | null) => (value === null ? '—' : formatPercent(value));

/** Relatórios: filtros na URL, indicadores, tabela e exportação CSV/PDF fiéis à tela. */
export function ReportsPage() {
  const { isDemoData } = useReportsServices();
  const snapshot = useReportSnapshot();
  const [params, setParams] = useSearchParams();
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null);

  const kind: ReportKind = KIND_BY_SLUG.get(params.get('relatorio') ?? '') ?? 'summary';
  const selection = useMemo(() => parsePeriodParams(params), [params]);
  const accountParam = params.get('conta');

  const updateParams = (next: Record<string, string | null>) => {
    const merged = new URLSearchParams(params);
    for (const [key, value] of Object.entries(next)) {
      if (value === null) merged.delete(key);
      else merged.set(key, value);
    }
    setParams(merged, { replace: true });
  };
  const changePeriod = (next: PeriodSelection) => {
    const merged = new URLSearchParams(params);
    for (const key of ['periodo', 'de', 'ate']) merged.delete(key);
    for (const [key, value] of Object.entries(periodToParams(next))) merged.set(key, value);
    setParams(merged, { replace: true });
  };

  const data = snapshot.data;
  const range = data ? resolvePeriod(selection, data.today) : undefined;
  const accountId =
    data && accountParam && data.data.accounts.some((item) => item.id === accountParam)
      ? accountParam
      : null;
  const start = range?.start;
  const end = range?.end;
  const filters = useMemo<ReportFilters | null>(
    () => (start && end ? { start, end, accountId } : null),
    [start, end, accountId],
  );

  const table = useMemo(
    () => (data && filters ? buildReport(kind, data.data, filters, data.today) : null),
    [data, kind, filters],
  );
  const indicators = useMemo(
    () => (data && filters ? computeIndicators(data.data, filters, data.today) : null),
    [data, filters],
  );

  if (snapshot.isError) {
    return (
      <StatusScreen
        tone="destructive"
        icon={CloudOff}
        title="Não foi possível carregar os relatórios"
        description={getErrorMessage(snapshot.error)}
        actions={
          <Button
            onClick={() => {
              void snapshot.refetch();
            }}
          >
            Tentar novamente
          </Button>
        }
      />
    );
  }

  const info = REPORT_INFO[kind];
  const accountName = accountId
    ? (data?.data.accounts.find((item) => item.id === accountId)?.name ?? '')
    : 'Todas as contas';
  const periodText = filters ? `${formatDateBR(filters.start)} a ${formatDateBR(filters.end)}` : '';
  const fileBase = filters
    ? safeFileName('fincore', info.slug, filters.start, 'a', filters.end)
    : 'fincore';

  const exportCsv = () => {
    if (!table) return;
    setExporting('csv');
    try {
      downloadBlob(
        new Blob([reportToCsv(table)], { type: 'text/csv;charset=utf-8' }),
        `${fileBase}.csv`,
      );
      toast.success('CSV gerado.');
    } finally {
      setExporting(null);
    }
  };

  const exportPdf = async () => {
    if (!table || !data) return;
    setExporting('pdf');
    try {
      const { createTablePdf } = await import('@/lib/export/pdf');
      const blob = await createTablePdf(
        reportToPdf(table, {
          title: info.title,
          meta: [
            `Período: ${periodText} · Conta: ${accountName}`,
            `Gerado em ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date())}${isDemoData ? ' · DADOS DE DEMONSTRAÇÃO' : ''}`,
          ],
        }),
      );
      downloadBlob(blob, `${fileBase}.pdf`);
      toast.success('PDF gerado.');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setExporting(null);
    }
  };

  const chartPoints =
    table && (kind === 'net_worth' || kind === 'investments')
      ? table.rows.flatMap((row) => {
          const value = row.cells[kind === 'net_worth' ? 'netWorth' : 'value'];
          const reference = kind === 'investments' ? row.cells.invested : undefined;
          return value?.kind === 'money'
            ? [
                {
                  month: asMonthKey(row.id),
                  value: value.value,
                  reference: reference?.kind === 'money' ? reference.value : undefined,
                },
              ]
            : [];
        })
      : [];

  return (
    <div className="flex flex-col gap-6">
      <Card className="gap-4">
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="report-kind">Relatório</Label>
              <Select
                value={kind}
                onValueChange={(value) => {
                  updateParams({ relatorio: REPORT_INFO[value as ReportKind].slug });
                }}
              >
                <SelectTrigger id="report-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_KINDS.map((item) => (
                    <SelectItem key={item} value={item}>
                      {REPORT_INFO[item].title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="report-account">Conta</Label>
              <Select
                value={accountId ?? ALL_ACCOUNTS}
                disabled={!data}
                onValueChange={(value) => {
                  updateParams({ conta: value === ALL_ACCOUNTS ? null : value });
                }}
              >
                <SelectTrigger id="report-account">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_ACCOUNTS}>Todas as contas</SelectItem>
                  {(data?.data.accounts ?? []).map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                      {account.archived ? ' (arquivada)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <PeriodFilter selection={selection} range={range} onChange={changePeriod} />
        </CardContent>
      </Card>

      <section
        aria-label="Indicadores do período"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {indicators ? (
          <>
            <StatCard
              label="Taxa de poupança"
              value={percentText(indicators.savingsRate)}
              icon={PiggyBank}
              tone={indicators.result.isNegative() ? 'negative' : 'positive'}
              hint={`Resultado ${formatMoney(indicators.result)}`}
            />
            <StatCard
              label="Comprometimento da renda"
              value={percentText(indicators.commitmentRate)}
              icon={Gauge}
              hint={`Despesas fixas ${formatMoney(indicators.fixedExpenses)}`}
            />
            <StatCard
              label="Média mensal de despesas"
              value={formatMoney(indicators.averageMonthlyExpenses)}
              icon={Scale}
              hint={`Variáveis ${formatMoney(indicators.variableExpenses)} no período`}
            />
            <StatCard
              label="Patrimônio líquido"
              value={formatMoney(indicators.netWorth)}
              icon={Landmark}
              hint={`Investido ${formatMoney(indicators.invested)} em ${formatDateBR(indicators.asOf)}`}
            />
          </>
        ) : (
          Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-28 rounded-xl" />
          ))
        )}
      </section>

      {chartPoints.length > 1 && (
        <TrendChart
          title={info.title}
          description={periodText}
          valueLabel={kind === 'net_worth' ? 'Patrimônio líquido' : 'Valor da carteira'}
          referenceLabel={kind === 'investments' ? 'Aplicado líquido' : undefined}
          points={chartPoints}
        />
      )}

      <Card className="gap-4">
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <CardTitle>{info.title}</CardTitle>
            <CardDescription>
              {info.description}
              {periodText && ` · ${periodText} · ${accountName}`}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={!table || exporting !== null} onClick={exportCsv}>
              {exporting === 'csv' ? <Spinner /> : <FileSpreadsheet aria-hidden="true" />}
              Exportar CSV
            </Button>
            <Button
              variant="outline"
              disabled={!table || exporting !== null}
              onClick={() => {
                void exportPdf();
              }}
            >
              {exporting === 'pdf' ? <Spinner /> : <FileDown aria-hidden="true" />}
              Exportar PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {table ? (
            <>
              <ReportTableView table={table} caption={`${info.title} — ${periodText}`} />
              {table.notes.length > 0 && (
                <ul className="flex list-disc flex-col gap-1 pl-5 text-xs text-muted-foreground">
                  {table.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <Skeleton className="h-64 w-full" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
