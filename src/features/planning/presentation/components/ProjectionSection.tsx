import { CalendarRange, CircleAlert, CircleCheck, TrendingDown, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';

import { StatCard } from '@/components/data-display/StatCard';
import { TrendChart } from '@/components/data-display/TrendChart';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MoneyInput } from '@/components/ui/money-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  addMonthsToKey,
  formatMonthLong,
  isMonthKey,
  toMonthKey,
  type MonthKey,
} from '@/lib/dates';
import { formatMoney, parseMoneyInput } from '@/lib/money';
import { cn } from '@/lib/utils';

import type { PlanningSnapshot } from '../../application/load-planning-data';
import {
  buildBalanceProjection,
  SCENARIO_LABELS,
  SCENARIO_PRESETS,
  type PlannedPurchase,
  type ScenarioAdjustments,
  type ScenarioKey,
} from '../../domain/balance-projection';

const HORIZONS = [6, 12, 24] as const;
const SCENARIOS: readonly ScenarioKey[] = ['base', 'optimistic', 'conservative', 'custom'];
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Percentual digitado ("-10", "5,5") → número entre -100 e 200; null se inválido. */
function parsePercent(value: string): number | null {
  const number = Number(value.replace(',', '.'));
  return value.trim() !== '' && Number.isFinite(number) && number >= -100 && number <= 200
    ? number
    : null;
}

export function ProjectionSection({ snapshot }: { snapshot: PlanningSnapshot }) {
  const currentMonth = toMonthKey(snapshot.today);
  const [months, setMonths] = useState<(typeof HORIZONS)[number]>(12);
  const [scenarioKey, setScenarioKey] = useState<ScenarioKey>('base');
  const [incomeText, setIncomeText] = useState('0');
  const [expenseText, setExpenseText] = useState('0');
  const [withPurchase, setWithPurchase] = useState(false);
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [purchaseMonth, setPurchaseMonth] = useState<string>(addMonthsToKey(currentMonth, 1));
  const [purchaseInstallments, setPurchaseInstallments] = useState('1');

  const customIncome = parsePercent(incomeText);
  const customExpense = parsePercent(expenseText);
  const scenario = useMemo<ScenarioAdjustments>(
    () =>
      scenarioKey === 'custom'
        ? { incomeChangePercent: customIncome ?? 0, expenseChangePercent: customExpense ?? 0 }
        : SCENARIO_PRESETS[scenarioKey],
    [scenarioKey, customIncome, customExpense],
  );

  const { purchase, purchaseErrors } = useMemo(
    () =>
      parsePurchase(
        withPurchase,
        purchaseAmount,
        purchaseMonth,
        purchaseInstallments,
        currentMonth,
      ),
    [withPurchase, purchaseAmount, purchaseMonth, purchaseInstallments, currentMonth],
  );

  const projection = useMemo(
    () =>
      buildBalanceProjection(snapshot.data, snapshot.today, {
        months,
        scenario,
        purchases: purchase ? [purchase] : [],
      }),
    [snapshot, months, scenario, purchase],
  );
  const reference = useMemo(
    () =>
      buildBalanceProjection(snapshot.data, snapshot.today, {
        months,
        scenario: SCENARIO_PRESETS.base,
      }),
    [snapshot, months],
  );
  const comparisons = useMemo(
    () =>
      (['optimistic', 'base', 'conservative'] as const).map((key) => ({
        key,
        balance:
          buildBalanceProjection(snapshot.data, snapshot.today, {
            months,
            scenario: SCENARIO_PRESETS[key],
          }).months.at(-1)?.balance ?? null,
      })),
    [snapshot, months],
  );

  const last = projection.months.at(-1);
  const showReference = scenarioKey !== 'base' || purchase !== null;
  const lowestNegative = projection.lowest.balance.isNegative();

  return (
    <Card className="gap-5">
      <CardHeader>
        <CardTitle>Projeção de saldo</CardTitle>
        <CardDescription>
          Saldo das contas menos faturas já devidas, somando receitas e despesas agendadas,
          recorrências, parcelas do cartão e a média dos gastos variáveis. Altere o cenário ou
          simule uma grande compra para ver o impacto.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="projection-horizon">Horizonte</Label>
            <Select
              value={String(months)}
              onValueChange={(value) => {
                setMonths(Number(value) as (typeof HORIZONS)[number]);
              }}
            >
              <SelectTrigger id="projection-horizon">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HORIZONS.map((value) => (
                  <SelectItem key={value} value={String(value)}>
                    {value} meses
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="projection-scenario">Cenário</Label>
            <Select
              value={scenarioKey}
              onValueChange={(value) => {
                setScenarioKey(value as ScenarioKey);
              }}
            >
              <SelectTrigger id="projection-scenario">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCENARIOS.map((key) => (
                  <SelectItem key={key} value={key}>
                    {SCENARIO_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {scenarioKey === 'custom' ? (
            <>
              <PercentField
                id="custom-income"
                label="Variação das receitas (%)"
                value={incomeText}
                onChange={setIncomeText}
                invalid={customIncome === null}
              />
              <PercentField
                id="custom-expense"
                label="Variação dos gastos variáveis (%)"
                value={expenseText}
                onChange={setExpenseText}
                invalid={customExpense === null}
              />
            </>
          ) : (
            <p className="text-xs text-muted-foreground sm:col-span-2 lg:self-end">
              {scenarioKey === 'base'
                ? 'Mantém receitas e gastos como estão hoje.'
                : `Receitas ${signed(scenario.incomeChangePercent)} e gastos variáveis ${signed(scenario.expenseChangePercent)}. Compromissos fixos não mudam.`}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="simulate-purchase"
              checked={withPurchase}
              onCheckedChange={(checked) => {
                setWithPurchase(checked === true);
              }}
            />
            <Label htmlFor="simulate-purchase">Simular uma grande compra</Label>
          </div>
          {withPurchase && (
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="purchase-amount">Valor da compra</Label>
                <MoneyInput
                  id="purchase-amount"
                  value={purchaseAmount}
                  aria-invalid={purchaseErrors.amount !== null && purchaseAmount !== ''}
                  onChange={(event) => {
                    setPurchaseAmount(event.target.value);
                  }}
                />
                {purchaseAmount !== '' && purchaseErrors.amount && (
                  <p className="text-xs text-destructive">{purchaseErrors.amount}</p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="purchase-month">Mês da compra</Label>
                <Input
                  id="purchase-month"
                  type="month"
                  min={currentMonth}
                  value={purchaseMonth}
                  aria-invalid={purchaseErrors.month !== null}
                  onChange={(event) => {
                    setPurchaseMonth(event.target.value);
                  }}
                />
                {purchaseErrors.month && (
                  <p className="text-xs text-destructive">{purchaseErrors.month}</p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="purchase-installments">Parcelas</Label>
                <Input
                  id="purchase-installments"
                  type="number"
                  min={1}
                  max={48}
                  value={purchaseInstallments}
                  aria-invalid={purchaseErrors.installments !== null}
                  onChange={(event) => {
                    setPurchaseInstallments(event.target.value);
                  }}
                />
                {purchaseErrors.installments && (
                  <p className="text-xs text-destructive">{purchaseErrors.installments}</p>
                )}
              </div>
            </div>
          )}
          {purchase && (
            <Alert variant={lowestNegative ? 'destructive' : 'info'} role="status">
              {lowestNegative ? (
                <CircleAlert aria-hidden="true" />
              ) : (
                <CircleCheck aria-hidden="true" />
              )}
              <AlertTitle>
                {lowestNegative
                  ? `Com a compra, o saldo projetado fica negativo em ${formatMonthLong(projection.lowest.month)}`
                  : 'Com a compra, o saldo projetado continua positivo'}
              </AlertTitle>
              <AlertDescription>
                Menor saldo previsto: {formatMoney(projection.lowest.balance)} (
                {formatMonthLong(projection.lowest.month)}). Estimativa.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <section
          aria-label="Resumo da projeção"
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          <StatCard
            label="Ponto de partida"
            value={formatMoney(projection.startingBalance)}
            icon={Wallet}
            hint={`Contas ${formatMoney(projection.accountsBalance)} − faturas ${formatMoney(projection.cardLiability)}`}
          />
          <StatCard
            label={`Saldo projetado em ${last ? formatMonthLong(last.month) : '—'}`}
            value={last ? formatMoney(last.balance) : '—'}
            icon={CalendarRange}
            tone={last?.balance.isNegative() ? 'negative' : 'default'}
            hint="Estimativa"
          />
          <StatCard
            label="Menor saldo previsto"
            value={formatMoney(projection.lowest.balance)}
            icon={TrendingDown}
            tone={lowestNegative ? 'negative' : 'default'}
            hint={capitalize(formatMonthLong(projection.lowest.month))}
          />
          <Card className="gap-2 py-4">
            <p className="px-4 text-sm text-muted-foreground">Comparação de cenários</p>
            <ul className="flex flex-col gap-1 px-4 text-sm">
              {comparisons.map((item) => (
                <li key={item.key} className="flex justify-between gap-2">
                  <span>{SCENARIO_LABELS[item.key]}</span>
                  <span
                    className={cn(
                      'font-medium tabular-nums',
                      item.balance?.isNegative() && 'text-destructive',
                    )}
                  >
                    {item.balance ? formatMoney(item.balance) : '—'}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </section>

        <TrendChart
          title="Saldo projetado"
          description={`Cenário ${SCENARIO_LABELS[scenarioKey].toLowerCase()}${purchase ? ' com a compra simulada' : ''} — estimativa`}
          valueLabel="Saldo projetado"
          referenceLabel={showReference ? 'Cenário base sem compra' : undefined}
          points={projection.months.map((row, index) => ({
            month: row.month,
            value: row.balance,
            reference: showReference ? reference.months[index]?.balance : undefined,
          }))}
          footer={`Média de gastos variáveis: ${formatMoney(projection.averages.totalExpenses)}/mês e de receitas variáveis: ${formatMoney(projection.averages.totalIncome)}/mês (últimos ${projection.averages.months.length} meses completos).`}
        />

        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead className="text-right">Receitas</TableHead>
                <TableHead className="text-right">Despesas</TableHead>
                <TableHead className="text-right">Resultado</TableHead>
                <TableHead className="text-right">Saldo projetado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projection.months.map((row) => (
                <TableRow key={row.month}>
                  <TableCell className="whitespace-nowrap">
                    {capitalize(formatMonthLong(row.month))}
                    {row.current && (
                      <span className="block text-xs text-muted-foreground">restante do mês</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(row.income)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(row.expenses)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'text-right tabular-nums',
                      row.result.isNegative() && 'text-destructive',
                    )}
                  >
                    {formatMoney(row.result)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'text-right font-medium tabular-nums',
                      row.balance.isNegative() && 'text-destructive',
                    )}
                  >
                    {formatMoney(row.balance)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

interface PurchaseErrors {
  amount: string | null;
  month: string | null;
  installments: string | null;
}

/** Valida a grande compra simulada; só gera a compra quando todos os campos são válidos. */
function parsePurchase(
  enabled: boolean,
  amountText: string,
  month: string,
  installmentsText: string,
  currentMonth: MonthKey,
): { purchase: PlannedPurchase | null; purchaseErrors: PurchaseErrors } {
  const amount = parseMoneyInput(amountText);
  const installments = Number(installmentsText);
  const purchaseErrors: PurchaseErrors = {
    amount: amount?.isPositive() === true ? null : 'Informe um valor maior que zero.',
    month:
      isMonthKey(month) && month >= currentMonth ? null : 'Escolha o mês atual ou um mês futuro.',
    installments:
      Number.isInteger(installments) && installments >= 1 && installments <= 48
        ? null
        : 'De 1 a 48 parcelas.',
  };
  const valid =
    enabled &&
    amount !== null &&
    isMonthKey(month) &&
    Object.values(purchaseErrors).every((error) => error === null);
  return {
    purchase: valid ? { amount, month, installments } : null,
    purchaseErrors,
  };
}

const signed = (value: number) =>
  `${value > 0 ? '+' : value < 0 ? '−' : ''}${String(Math.abs(value)).replace('.', ',')}%`;

function PercentField({
  id,
  label,
  value,
  onChange,
  invalid,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode="decimal"
        value={value}
        aria-invalid={invalid}
        aria-describedby={invalid ? `${id}-error` : undefined}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
      {invalid && (
        <p id={`${id}-error`} className="text-xs text-destructive">
          Informe um percentual entre −100 e 200.
        </p>
      )}
    </div>
  );
}
