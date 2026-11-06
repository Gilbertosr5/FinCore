import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  CHART_AXIS_TICK,
  CHART_GRID_STROKE,
  CHART_HEIGHT,
  seriesColor,
} from '@/components/data-display/chart-theme';
import { ChartCard, type ChartTable } from '@/components/data-display/ChartCard';
import { ChartLegend } from '@/components/data-display/ChartLegend';
import { ChartTooltipContent } from '@/components/data-display/ChartTooltip';
import type { MonthKey } from '@/lib/dates';
import type { Money } from '@/lib/money';
import { formatMoney } from '@/lib/money';

import { axisCurrency, displayMoney, monthLabel, monthTitle } from './chart-format';

export interface TrendPoint {
  month: MonthKey;
  value: Money;
  /** Série de referência opcional (ex.: valor aplicado), desenhada tracejada. */
  reference?: Money;
}

interface TrendChartProps {
  title: string;
  description?: string;
  valueLabel: string;
  referenceLabel?: string;
  points: TrendPoint[];
  footer?: string;
}

const VALUE_COLOR = seriesColor(0);
const REFERENCE_COLOR = 'var(--muted-foreground)';

/** Evolução mensal de uma métrica (área), com série de referência opcional. */
export function TrendChart({
  title,
  description,
  valueLabel,
  referenceLabel,
  points,
  footer,
}: TrendChartProps) {
  const gradientId = `trend-${title.replace(/\W+/g, '-')}`;
  const hasReference = referenceLabel !== undefined && points.some((p) => p.reference);
  const data = points.map((point) => ({
    month: point.month,
    label: monthLabel(point.month),
    value: point.value.toNumberForDisplay(),
    reference: point.reference?.toNumberForDisplay(),
  }));
  const first = points[0];
  const last = points.at(-1);

  const table: ChartTable = {
    caption: title,
    columns: [
      { key: 'month', label: 'Mês' },
      { key: 'value', label: valueLabel, align: 'right' },
      ...(hasReference
        ? [{ key: 'reference', label: referenceLabel, align: 'right' as const }]
        : []),
    ],
    rows: points.map((point) => ({
      id: point.month,
      cells: {
        month: monthTitle(point.month),
        value: formatMoney(point.value),
        reference: point.reference ? formatMoney(point.reference) : '—',
      },
    })),
  };

  return (
    <ChartCard
      title={title}
      description={description}
      footer={footer}
      summary={
        first && last
          ? `${valueLabel} passou de ${formatMoney(first.value)} em ${monthTitle(first.month)} para ${formatMoney(last.value)} em ${monthTitle(last.month)}.`
          : 'Sem dados.'
      }
      table={table}
    >
      {hasReference && (
        <ChartLegend
          className="mb-3"
          items={[
            { key: 'value', label: valueLabel, color: VALUE_COLOR },
            { key: 'reference', label: referenceLabel, color: REFERENCE_COLOR, dashed: true },
          ]}
        />
      )}
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <AreaChart data={data} margin={{ left: -8, right: 4, top: 4 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={VALUE_COLOR} stopOpacity={0.28} />
              <stop offset="100%" stopColor={VALUE_COLOR} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={CHART_GRID_STROKE} />
          <XAxis dataKey="label" tick={CHART_AXIS_TICK} tickLine={false} axisLine={false} />
          <YAxis
            tick={CHART_AXIS_TICK}
            tickFormatter={axisCurrency}
            tickLine={false}
            axisLine={false}
            width={72}
            domain={['auto', 'auto']}
          />
          <Tooltip
            cursor={{ stroke: 'var(--chart-axis)', strokeDasharray: '3 3' }}
            content={({ active, payload }) => {
              const row = payload[0]?.payload as (typeof data)[number] | undefined;
              if (!active || !row) return null;
              return (
                <ChartTooltipContent
                  title={monthTitle(row.month)}
                  rows={[
                    {
                      key: 'v',
                      label: valueLabel,
                      value: displayMoney(row.value),
                      color: VALUE_COLOR,
                    },
                    ...(hasReference && row.reference !== undefined
                      ? [
                          {
                            key: 'r',
                            label: referenceLabel,
                            value: displayMoney(row.reference),
                            color: REFERENCE_COLOR,
                            dashed: true,
                          },
                        ]
                      : []),
                  ]}
                />
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            name={valueLabel}
            stroke={VALUE_COLOR}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--card)' }}
          />
          {hasReference && (
            <Line
              type="monotone"
              dataKey="reference"
              name={referenceLabel}
              stroke={REFERENCE_COLOR}
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              activeDot={false}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
