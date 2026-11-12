import { Calculator, CalendarClock, Coins, PiggyBank } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';

import { StatCard } from '@/components/data-display/StatCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MoneyInput } from '@/components/ui/money-input';
import { formatMoney, Money, parseMoneyInput } from '@/lib/money';

import {
  MAX_SIMULATION_MONTHS,
  monthsToReach,
  requiredMonthlyContribution,
  simulateSavings,
} from '../../domain/savings-simulation';

function parseNumber(value: string): number | null {
  const number = Number(value.replace(',', '.'));
  return value.trim() !== '' && Number.isFinite(number) ? number : null;
}

function describeMonths(months: number): string {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts = [
    years > 0 ? `${years} ${years === 1 ? 'ano' : 'anos'}` : null,
    rest > 0 ? `${rest} ${rest === 1 ? 'mês' : 'meses'}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' e ') : 'imediatamente';
}

/** Simulação de economia e aportes com juros compostos (estimativa). */
export function SavingsSimulator() {
  const [initialText, setInitialText] = useState('0,00');
  const [monthlyText, setMonthlyText] = useState('500,00');
  const [rateText, setRateText] = useState('0,8');
  const [monthsText, setMonthsText] = useState('24');
  const [targetText, setTargetText] = useState('');

  const initial = initialText.trim() === '' ? Money.zero() : parseMoneyInput(initialText);
  const monthly = monthlyText.trim() === '' ? Money.zero() : parseMoneyInput(monthlyText);
  const rate = parseNumber(rateText);
  const months = parseNumber(monthsText);
  const target = targetText.trim() === '' ? null : parseMoneyInput(targetText);

  const errors = {
    initial: initial === null || initial.isNegative() ? 'Valor inválido.' : null,
    monthly: monthly === null || monthly.isNegative() ? 'Valor inválido.' : null,
    rate: rate === null || rate < 0 || rate > 20 ? 'Entre 0% e 20% ao mês.' : null,
    months:
      months === null || !Number.isInteger(months) || months < 1 || months > MAX_SIMULATION_MONTHS
        ? `De 1 a ${MAX_SIMULATION_MONTHS} meses.`
        : null,
    target: targetText.trim() !== '' && !target?.isPositive() ? 'Valor inválido.' : null,
  };
  const valid = Object.values(errors).every((error) => error === null);

  const result = (() => {
    if (!valid || !initial || !monthly || rate === null || months === null) return null;
    const simulation = simulateSavings({ initial, monthly, monthlyRatePercent: rate, months });
    const goal = target?.isPositive()
      ? {
          required: requiredMonthlyContribution({
            target,
            initial,
            monthlyRatePercent: rate,
            months,
          }),
          monthsNeeded: monthsToReach({ target, initial, monthly, monthlyRatePercent: rate }),
        }
      : null;
    return { simulation, goal };
  })();

  return (
    <Card className="gap-5">
      <CardHeader>
        <CardTitle>Simulação de economia e aportes</CardTitle>
        <CardDescription>
          Juros compostos mensais com aportes no fim de cada mês, sem impostos nem inflação. Os
          resultados são estimativas.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Valor inicial" error={errors.initial}>
            {(props) => (
              <MoneyInput
                {...props}
                value={initialText}
                onChange={(event) => {
                  setInitialText(event.target.value);
                }}
              />
            )}
          </Field>
          <Field label="Aporte mensal" error={errors.monthly}>
            {(props) => (
              <MoneyInput
                {...props}
                value={monthlyText}
                onChange={(event) => {
                  setMonthlyText(event.target.value);
                }}
              />
            )}
          </Field>
          <Field label="Rentabilidade (% ao mês)" error={errors.rate}>
            {(props) => (
              <Input
                {...props}
                inputMode="decimal"
                value={rateText}
                onChange={(event) => {
                  setRateText(event.target.value);
                }}
              />
            )}
          </Field>
          <Field label="Prazo (meses)" error={errors.months}>
            {(props) => (
              <Input
                {...props}
                type="number"
                min={1}
                max={MAX_SIMULATION_MONTHS}
                value={monthsText}
                onChange={(event) => {
                  setMonthsText(event.target.value);
                }}
              />
            )}
          </Field>
          <Field label="Objetivo (opcional)" error={errors.target}>
            {(props) => (
              <MoneyInput
                {...props}
                value={targetText}
                onChange={(event) => {
                  setTargetText(event.target.value);
                }}
              />
            )}
          </Field>
        </div>

        {result ? (
          <section
            aria-label="Resultado da simulação"
            aria-live="polite"
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            <StatCard
              label="Valor ao final"
              value={formatMoney(result.simulation.finalAmount)}
              icon={PiggyBank}
              hint="Estimativa"
            />
            <StatCard
              label="Total aportado"
              value={formatMoney(result.simulation.totalContributed)}
              icon={Coins}
            />
            <StatCard
              label="Rendimentos"
              value={formatMoney(result.simulation.earnings)}
              icon={Calculator}
              tone="positive"
            />
            {result.goal && (
              <StatCard
                label="Para atingir o objetivo"
                value={`${formatMoney(result.goal.required)}/mês`}
                icon={CalendarClock}
                hint={
                  result.goal.monthsNeeded === null
                    ? 'Com o aporte atual, não atinge em 50 anos.'
                    : `Com o aporte atual: ${describeMonths(result.goal.monthsNeeded)}.`
                }
              />
            )}
          </section>
        ) : (
          <p role="status" className="text-sm text-muted-foreground">
            Corrija os campos destacados para ver a simulação.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error: string | null;
  children: (props: {
    id: string;
    'aria-invalid': boolean;
    'aria-describedby': string | undefined;
  }) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children({
        id,
        'aria-invalid': error !== null,
        'aria-describedby': error ? `${id}-error` : undefined,
      })}
      {error && (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
