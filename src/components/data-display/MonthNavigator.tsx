import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { addMonthsToKey, formatMonthLong, type MonthKey } from '@/lib/dates';

/** "novembro de 2026" → "Novembro de 2026" (CSS capitalize afetaria o "de"). */
const capitalizeFirst = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

interface MonthNavigatorProps {
  month: MonthKey;
  currentMonth: MonthKey;
  onChange: (month: MonthKey) => void;
}

/** Navegação entre meses (◀ março de 2026 ▶) com atalho para o mês atual. */
export function MonthNavigator({ month, currentMonth, onChange }: MonthNavigatorProps) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Mês">
      <Button
        variant="outline"
        size="icon"
        aria-label="Mês anterior"
        onClick={() => {
          onChange(addMonthsToKey(month, -1));
        }}
      >
        <ChevronLeft aria-hidden="true" />
      </Button>
      <span aria-live="polite" className="min-w-40 text-center text-sm font-semibold tabular-nums">
        {capitalizeFirst(formatMonthLong(month))}
      </span>
      <Button
        variant="outline"
        size="icon"
        aria-label="Próximo mês"
        onClick={() => {
          onChange(addMonthsToKey(month, 1));
        }}
      >
        <ChevronRight aria-hidden="true" />
      </Button>
      {month !== currentMonth && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onChange(currentMonth);
          }}
        >
          Mês atual
        </Button>
      )}
    </div>
  );
}
