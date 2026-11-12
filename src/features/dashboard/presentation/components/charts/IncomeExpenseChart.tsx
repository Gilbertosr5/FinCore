import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import {
  axisCurrency,
  displayMoney,
  monthLabel,
  monthTitle,
} from '@/components/data-display/chart-format';
import {
  CHART_AXIS_TICK,
  CHART_GRID_STROKE,
  CHART_HEIGHT,
  seriesColor,
} from '@/components/data-display/chart-theme';
import { ChartCard } from '@/components/data-display/ChartCard';
import { ChartLegend } from '@/components/data-display/ChartLegend';
import { ChartTooltipContent } from '@/components/data-display/ChartTooltip';
import { formatMoney } from '@/lib/money';

import type { MonthlyPoint } from '../../../domain/overview-types';

const INCOME_COLOR = seriesColor(0);
const EXPENSE_COLOR = seriesColor(1);

export function IncomeExpenseChart({ monthly }: { monthly: MonthlyPoint[] }) {
  const data = monthly.map((point) => ({
    month: point.month,
    label: monthLabel(point.month),
    income: point.income.toNumberForDisplay(),
    expenses: point.expenses.toNumberForDisplay(),
  }));
  const last = monthly.at(-1);

  return (
    <ChartCard
      title="Receitas x despesas"
      description="Por mês de competência; transferências e pagamentos de fatura não entram."
      summary={
        last
          ? `${monthly.length} meses. Último mês: receitas ${formatMoney(last.income)}, despesas ${formatMoney(last.expenses)}.`
          : 'Sem dados.'
      }
      table={{
        caption: 'Receitas e despesas por mês',
        columns: [
          { key: 'month', label: 'Mês' },
          { key: 'income', label: 'Receitas', align: 'right' },
          { key: 'expenses', label: 'Despesas', align: 'right' },
          { key: 'result', label: 'Resultado', align: 'right' },
        ],
        rows: monthly.map((point) => ({
          id: point.month,
          cells: {
            month: monthTitle(point.month),
            income: formatMoney(point.income),
            expenses: formatMoney(point.expenses),
            result: formatMoney(point.result),
          },
        })),
      }}
    >
      <ChartLegend
        className="mb-3"
        items={[
          { key: 'income', label: 'Receitas', color: INCOME_COLOR },
          { key: 'expenses', label: 'Despesas', color: EXPENSE_COLOR },
        ]}
      />
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <BarChart data={data} barGap={2} barCategoryGap="24%" margin={{ left: -8, right: 4 }}>
          <CartesianGrid vertical={false} stroke={CHART_GRID_STROKE} />
          <XAxis dataKey="label" tick={CHART_AXIS_TICK} tickLine={false} axisLine={false} />
          <YAxis
            tick={CHART_AXIS_TICK}
            tickFormatter={axisCurrency}
            tickLine={false}
            axisLine={false}
            width={72}
          />
          <Tooltip
            cursor={{ fill: 'var(--accent)', opacity: 0.4 }}
            content={({ active, payload }) => {
              const row = payload[0]?.payload as (typeof data)[number] | undefined;
              if (!active || !row) return null;
              return (
                <ChartTooltipContent
                  title={monthTitle(row.month)}
                  rows={[
                    {
                      key: 'i',
                      label: 'Receitas',
                      value: displayMoney(row.income),
                      color: INCOME_COLOR,
                    },
                    {
                      key: 'e',
                      label: 'Despesas',
                      value: displayMoney(row.expenses),
                      color: EXPENSE_COLOR,
                    },
                  ]}
                />
              );
            }}
          />
          <Bar
            dataKey="income"
            name="Receitas"
            fill={INCOME_COLOR}
            radius={[4, 4, 0, 0]}
            maxBarSize={22}
          />
          <Bar
            dataKey="expenses"
            name="Despesas"
            fill={EXPENSE_COLOR}
            radius={[4, 4, 0, 0]}
            maxBarSize={22}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
