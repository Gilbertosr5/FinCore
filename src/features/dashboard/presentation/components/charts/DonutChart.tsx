import { PieChart as PieIcon } from 'lucide-react';
import { Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import { seriesColor } from '@/components/data-display/chart-theme';
import { ChartCard } from '@/components/data-display/ChartCard';
import { ChartTooltipContent } from '@/components/data-display/ChartTooltip';
import { EmptyState } from '@/components/feedback/EmptyState';
import { formatMoney, formatPercent, Money } from '@/lib/money';

import type { CategorySlice } from '../../../domain/overview-types';

interface DonutChartProps {
  title: string;
  description?: string;
  slices: CategorySlice[];
  emptyTitle: string;
  totalLabel: string;
}

/** Composição de um total (participação por categoria/classe), com legenda de valores. */
export function DonutChart({
  title,
  description,
  slices,
  emptyTitle,
  totalLabel,
}: DonutChartProps) {
  const total = Money.sum(slices.map((slice) => slice.amount));
  const data = slices.map((slice) => ({
    key: slice.key,
    label: slice.label,
    value: slice.amount.toNumberForDisplay(),
    amount: slice.amount,
    share: slice.share,
    color: seriesColor(slice.colorIndex),
    // Recharts usa `fill` de cada item para colorir a fatia.
    fill: seriesColor(slice.colorIndex),
  }));

  return (
    <ChartCard
      title={title}
      description={description}
      empty={slices.length === 0 ? <EmptyState icon={PieIcon} title={emptyTitle} /> : undefined}
      summary={`${totalLabel}: ${formatMoney(total)}. ${slices
        .map((slice) => `${slice.label} ${formatPercent(slice.share)}`)
        .join('; ')}.`}
      table={{
        caption: title,
        columns: [
          { key: 'label', label: 'Item' },
          { key: 'amount', label: 'Valor', align: 'right' },
          { key: 'share', label: 'Participação', align: 'right' },
        ],
        rows: slices.map((slice) => ({
          id: slice.key,
          cells: {
            label: slice.label,
            amount: formatMoney(slice.amount),
            share: formatPercent(slice.share),
          },
        })),
      }}
    >
      <div className="@container">
        <div className="flex flex-col items-center gap-4 @md:flex-row">
          <div className="relative h-44 w-44 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="label"
                  innerRadius="64%"
                  outerRadius="100%"
                  paddingAngle={data.length > 1 ? 2 : 0}
                  stroke="var(--card)"
                  strokeWidth={2}
                  isAnimationActive={false}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    const row = payload[0]?.payload as (typeof data)[number] | undefined;
                    if (!active || !row) return null;
                    return (
                      <ChartTooltipContent
                        title={row.label}
                        rows={[
                          {
                            key: 'v',
                            label: formatPercent(row.share),
                            value: formatMoney(row.amount),
                            color: row.color,
                          },
                        ]}
                      />
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-[11px] text-muted-foreground">{totalLabel}</span>
              <span className="text-sm font-semibold tabular-nums">{formatMoney(total)}</span>
            </div>
          </div>
          <ul className="flex w-full min-w-0 flex-col gap-2 text-sm">
            {data.map((entry) => (
              <li key={entry.key} className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatPercent(entry.share)}
                </span>
                <span className="text-right font-medium whitespace-nowrap tabular-nums">
                  {formatMoney(entry.amount)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </ChartCard>
  );
}
