import { CalendarRange } from 'lucide-react';
import { useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatDateBR, isIsoDate } from '@/lib/dates';
import { cn } from '@/lib/utils';

import {
  PERIOD_PRESET_LABELS,
  validateCustomRange,
  type DateRange,
  type PeriodPreset,
  type PeriodSelection,
} from '../../domain/period';

const PRESETS: PeriodPreset[] = [
  'current_month',
  'last_30_days',
  'last_90_days',
  'current_year',
  'custom',
];

interface PeriodFilterProps {
  selection: PeriodSelection;
  range: DateRange | undefined;
  onChange: (selection: PeriodSelection) => void;
}

export function PeriodFilter({ selection, range, onChange }: PeriodFilterProps) {
  const [customOpen, setCustomOpen] = useState(selection.preset === 'custom');
  const [start, setStart] = useState(range?.start ?? '');
  const [end, setEnd] = useState(range?.end ?? '');
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();

  const activePreset = customOpen ? 'custom' : selection.preset;

  const applyCustom = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    if (!isIsoDate(start) || !isIsoDate(end)) {
      setError('Informe as duas datas.');
      return;
    }
    const custom = { start, end };
    const validation = validateCustomRange(custom);
    setError(validation);
    if (!validation) onChange({ preset: 'custom', range: custom });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div
          role="group"
          aria-label="Período"
          className="-mx-1 flex max-w-full gap-1 overflow-x-auto rounded-lg bg-muted p-1"
        >
          {PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              aria-pressed={activePreset === preset}
              className={cn(
                'h-8 shrink-0 rounded-md px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                activePreset === preset && 'bg-card text-foreground shadow-sm',
              )}
              onClick={() => {
                if (preset === 'custom') {
                  setCustomOpen(true);
                  if (range) {
                    setStart(range.start);
                    setEnd(range.end);
                  }
                  return;
                }
                setCustomOpen(false);
                setError(null);
                onChange({ preset });
              }}
            >
              {PERIOD_PRESET_LABELS[preset]}
            </button>
          ))}
        </div>
        {range && (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarRange aria-hidden="true" className="size-4" />
            <span>
              {formatDateBR(range.start)} a {formatDateBR(range.end)}
            </span>
          </p>
        )}
      </div>

      {customOpen && (
        <form
          noValidate
          onSubmit={applyCustom}
          aria-label="Período personalizado"
          className="flex flex-wrap items-end gap-3"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="period-start">Data inicial</Label>
            <Input
              id="period-start"
              type="date"
              className="w-44"
              value={start}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
              onChange={(event) => {
                setStart(event.target.value);
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="period-end">Data final</Label>
            <Input
              id="period-end"
              type="date"
              className="w-44"
              value={end}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
              onChange={(event) => {
                setEnd(event.target.value);
              }}
            />
          </div>
          <Button type="submit">Aplicar</Button>
          {error && (
            <p id={errorId} role="alert" className="w-full text-xs font-medium text-destructive">
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
