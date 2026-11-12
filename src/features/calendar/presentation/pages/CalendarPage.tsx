import { BellRing, ChevronLeft, ChevronRight, CloudOff } from 'lucide-react';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { MonthNavigator } from '@/components/data-display/MonthNavigator';
import { StatusScreen } from '@/components/feedback/StatusScreen';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  addDays,
  dayOfWeek,
  formatDateBR,
  getDateParts,
  isIsoDate,
  isMonthKey,
  monthEnd,
  monthStart,
  toMonthKey,
  type IsoDate,
} from '@/lib/dates';
import { getErrorMessage } from '@/lib/errors';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';

import {
  CALENDAR_EVENT_TYPE_LABELS,
  summarizeEvents,
  type CalendarEvent,
  type CalendarEventType,
} from '../../domain/calendar-events';
import { buildMonthGrid, buildWeek, WEEKDAY_LONG, WEEKDAY_SHORT } from '../../domain/calendar-grid';
import { EVENT_ICONS, EVENT_TONES } from '../components/event-style';
import { EventList } from '../components/EventList';
import { useCalendarServices } from '../context/calendar-context';
import { useCalendarEvents } from '../hooks/use-calendar';

const TYPES = Object.keys(CALENDAR_EVENT_TYPE_LABELS) as CalendarEventType[];
const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

function longDate(date: IsoDate): string {
  const { day, month } = getDateParts(date);
  const weekday = WEEKDAY_LONG[dayOfWeek(date)] ?? '';
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${day} de ${MONTHS[month - 1] ?? ''}`;
}

/** Calendário financeiro: eventos derivados dos módulos, visão mensal e semanal. */
export function CalendarPage() {
  const { today: getToday } = useCalendarServices();
  const today = getToday();
  const [params, setParams] = useSearchParams();

  const view = params.get('visao') === 'semana' ? 'week' : 'month';
  const dayParam = params.get('dia') ?? '';
  const monthParam = params.get('mes') ?? '';
  const selectedDay: IsoDate = isIsoDate(dayParam) ? dayParam : today;
  const month = isMonthKey(monthParam) ? monthParam : toMonthKey(selectedDay);
  const typesParam = params.get('tipos');
  const activeTypes = useMemo(
    () =>
      new Set<CalendarEventType>(
        typesParam === null
          ? TYPES
          : typesParam
              .split(',')
              .filter((item): item is CalendarEventType => (TYPES as string[]).includes(item)),
      ),
    [typesParam],
  );
  const showDone = params.get('realizados') === '1';

  const week = buildWeek(selectedDay);
  const range =
    view === 'week'
      ? { start: week[0] ?? selectedDay, end: week[6] ?? selectedDay }
      : { start: monthStart(month), end: monthEnd(month) };
  const query = useCalendarEvents(range);

  const update = (next: Record<string, string | null>) => {
    const merged = new URLSearchParams(params);
    for (const [key, value] of Object.entries(next)) {
      if (value === null) merged.delete(key);
      else merged.set(key, value);
    }
    setParams(merged, { replace: true });
  };

  const visible = useMemo(
    () =>
      (query.data ?? []).filter(
        (event) => activeTypes.has(event.type) && (showDone || event.status !== 'done'),
      ),
    [query.data, activeTypes, showDone],
  );
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of visible) map.set(event.date, [...(map.get(event.date) ?? []), event]);
    return map;
  }, [visible]);
  const totals = summarizeEvents(visible);

  const toggleType = (type: CalendarEventType, checked: boolean) => {
    const next = TYPES.filter((item) => (item === type ? checked : activeTypes.has(item)));
    update({ tipos: next.length === TYPES.length ? null : next.join(',') });
  };

  if (query.isError) {
    return (
      <StatusScreen
        tone="destructive"
        icon={CloudOff}
        title="Não foi possível carregar o calendário"
        description={getErrorMessage(query.error)}
        actions={
          <Button
            onClick={() => {
              void query.refetch();
            }}
          >
            Tentar novamente
          </Button>
        }
      />
    );
  }

  const dayEvents = byDay.get(selectedDay) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg border border-border p-0.5" role="group" aria-label="Visão">
          {(['month', 'week'] as const).map((item) => (
            <Button
              key={item}
              size="sm"
              variant={view === item ? 'secondary' : 'ghost'}
              aria-pressed={view === item}
              onClick={() => {
                update({ visao: item === 'week' ? 'semana' : null });
              }}
            >
              {item === 'month' ? 'Mês' : 'Semana'}
            </Button>
          ))}
        </div>
        {view === 'month' ? (
          <MonthNavigator
            month={month}
            currentMonth={toMonthKey(today)}
            onChange={(next) => {
              update({ mes: next, dia: monthStart(next) });
            }}
          />
        ) : (
          <div className="flex items-center gap-1" role="group" aria-label="Semana">
            <Button
              variant="outline"
              size="icon"
              aria-label="Semana anterior"
              onClick={() => {
                const next = addDays(selectedDay, -7);
                update({ dia: next, mes: toMonthKey(next) });
              }}
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <span aria-live="polite" className="min-w-44 text-center text-sm font-semibold">
              {formatDateBR(range.start)} a {formatDateBR(range.end)}
            </span>
            <Button
              variant="outline"
              size="icon"
              aria-label="Próxima semana"
              onClick={() => {
                const next = addDays(selectedDay, 7);
                update({ dia: next, mes: toMonthKey(next) });
              }}
            >
              <ChevronRight aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                update({ dia: today, mes: toMonthKey(today) });
              }}
            >
              Hoje
            </Button>
          </div>
        )}
      </div>

      <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <legend className="sr-only">Filtrar eventos</legend>
        {TYPES.map((type) => {
          const Icon = EVENT_ICONS[type];
          return (
            <div key={type} className="flex items-center gap-2">
              <Checkbox
                id={`type-${type}`}
                checked={activeTypes.has(type)}
                onCheckedChange={(checked) => {
                  toggleType(type, checked === true);
                }}
              />
              <Label htmlFor={`type-${type}`} className="flex items-center gap-1 font-normal">
                <Icon aria-hidden="true" className={cn('size-4', EVENT_TONES[type])} />
                {CALENDAR_EVENT_TYPE_LABELS[type]}
              </Label>
            </div>
          );
        })}
        <div className="flex items-center gap-2">
          <Checkbox
            id="show-done"
            checked={showDone}
            onCheckedChange={(checked) => {
              update({ realizados: checked === true ? '1' : null });
            }}
          />
          <Label htmlFor="show-done" className="font-normal">
            Mostrar realizados
          </Label>
        </div>
      </fieldset>

      <dl
        aria-label="Resumo do período"
        aria-busy={query.isFetching}
        className="grid grid-cols-3 gap-3 rounded-lg bg-muted/50 p-3 text-sm"
      >
        <div>
          <dt className="text-xs text-muted-foreground">A pagar</dt>
          <dd className="font-semibold tabular-nums">{formatMoney(totals.toPay)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">A receber</dt>
          <dd className="font-semibold tabular-nums">{formatMoney(totals.toReceive)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Vencidos</dt>
          <dd className={cn('font-semibold', totals.overdueCount > 0 && 'text-destructive')}>
            {totals.overdueCount}
          </dd>
        </div>
      </dl>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="gap-3 lg:col-span-2">
          <CardContent className="px-2 sm:px-6">
            {!query.data ? (
              <Skeleton className="h-96 w-full" />
            ) : view === 'month' ? (
              <MonthGrid
                month={month}
                today={today}
                selected={selectedDay}
                byDay={byDay}
                onSelect={(date) => {
                  update({ dia: date, mes: toMonthKey(date) });
                }}
              />
            ) : (
              <ol aria-label="Dias da semana" className="flex flex-col divide-y divide-border">
                {week.map((date) => (
                  <li key={date} className="py-3">
                    <button
                      type="button"
                      aria-pressed={date === selectedDay}
                      onClick={() => {
                        update({ dia: date });
                      }}
                      className={cn(
                        'mb-2 rounded-sm text-sm font-semibold outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring',
                        date === today && 'text-primary',
                      )}
                    >
                      {longDate(date)}
                      {date === today && ' (hoje)'}
                    </button>
                    <EventList events={byDay.get(date) ?? []} />
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="gap-3">
            <CardHeader>
              <h2 className="text-base font-semibold">{longDate(selectedDay)}</h2>
            </CardHeader>
            <CardContent>
              <section aria-label={`Eventos de ${formatDateBR(selectedDay)}`}>
                {query.data ? <EventList events={dayEvents} /> : <Skeleton className="h-24" />}
              </section>
            </CardContent>
          </Card>
          <Card className="gap-2">
            <CardContent className="flex gap-3 text-xs text-muted-foreground">
              <BellRing aria-hidden="true" className="size-4 shrink-0" />
              <p>
                Vencimentos próximos aparecem na central de notificações. Lembretes por e-mail ou
                push dependem do backend (contrato documentado) e ainda não são enviados.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MonthGrid({
  month,
  today,
  selected,
  byDay,
  onSelect,
}: {
  month: string;
  today: IsoDate;
  selected: IsoDate;
  byDay: Map<string, CalendarEvent[]>;
  onSelect: (date: IsoDate) => void;
}) {
  const weeks = isMonthKey(month) ? buildMonthGrid(month) : [];
  return (
    <div role="grid" aria-label="Calendário do mês" className="flex flex-col gap-1">
      <div role="row" className="grid grid-cols-7 gap-1">
        {WEEKDAY_SHORT.map((label, index) => (
          <div
            key={label}
            role="columnheader"
            aria-label={WEEKDAY_LONG[index]}
            className="py-1 text-center text-xs font-medium text-muted-foreground"
          >
            {label}
          </div>
        ))}
      </div>
      {weeks.map((days) => (
        <div key={days[0]} role="row" className="grid grid-cols-7 gap-1">
          {days.map((date) => {
            const events = byDay.get(date) ?? [];
            const inMonth = toMonthKey(date) === month;
            const overdue = events.filter((event) => event.status === 'overdue').length;
            const { day } = getDateParts(date);
            return (
              <div key={date} role="gridcell" aria-selected={date === selected}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(date);
                  }}
                  aria-label={`${longDate(date)}: ${events.length === 0 ? 'sem eventos' : `${events.length} ${events.length === 1 ? 'evento' : 'eventos'}`}${overdue > 0 ? `, ${overdue} vencido${overdue === 1 ? '' : 's'}` : ''}`}
                  className={cn(
                    'flex h-16 w-full flex-col items-start gap-0.5 overflow-hidden rounded-md border border-transparent p-1 text-left text-xs outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring sm:h-24',
                    !inMonth && 'opacity-40',
                    date === selected && 'border-primary bg-primary/10',
                  )}
                >
                  <span
                    className={cn(
                      'grid size-6 place-items-center rounded-full font-semibold',
                      date === today && 'bg-primary text-primary-foreground',
                    )}
                  >
                    {day}
                  </span>
                  <span className="flex flex-wrap gap-0.5 sm:hidden" aria-hidden="true">
                    {events.slice(0, 4).map((event) => (
                      <span
                        key={event.id}
                        className={cn('size-1.5 rounded-full bg-current', EVENT_TONES[event.type])}
                      />
                    ))}
                  </span>
                  <span className="hidden w-full flex-col gap-0.5 sm:flex" aria-hidden="true">
                    {events.slice(0, 2).map((event) => (
                      <span
                        key={event.id}
                        className={cn(
                          'truncate rounded-sm bg-muted px-1',
                          event.status === 'overdue' && 'bg-destructive/15 text-destructive',
                        )}
                      >
                        {event.title}
                      </span>
                    ))}
                    {events.length > 2 && (
                      <span className="text-muted-foreground">+{events.length - 2}</span>
                    )}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
