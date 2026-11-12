import {
  ArrowDownCircle,
  ArrowLeftRight,
  ArrowUpCircle,
  CreditCard,
  Goal,
  type LucideIcon,
} from 'lucide-react';

import type { CalendarEventType } from '../../domain/calendar-events';

export const EVENT_ICONS: Record<CalendarEventType, LucideIcon> = {
  payable: ArrowUpCircle,
  receivable: ArrowDownCircle,
  transfer: ArrowLeftRight,
  invoice: CreditCard,
  goal: Goal,
};

/** Cor por tipo (sempre acompanhada de ícone e texto). */
export const EVENT_TONES: Record<CalendarEventType, string> = {
  payable: 'text-destructive',
  receivable: 'text-success',
  transfer: 'text-muted-foreground',
  invoice: 'text-warning',
  goal: 'text-primary',
};
