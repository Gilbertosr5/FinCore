import type { AccountRepository } from '@/features/accounts/domain/repositories/account.repository';
import type { CreditCardRepository } from '@/features/credit-cards/domain/repositories/credit-card.repository';
import type { GoalRepository } from '@/features/goals/domain/repositories/goal.repository';
import type { TransactionRepository } from '@/features/transactions/domain/repositories/transaction.repository';
import type { IsoDate } from '@/lib/dates';

import {
  buildCalendarEvents,
  type CalendarData,
  type CalendarEvent,
  type CalendarRange,
} from '../domain/calendar-events';

export interface CalendarContext {
  accounts: AccountRepository;
  transactions: TransactionRepository;
  cards: CreditCardRepository;
  goals: GoalRepository;
  today: () => IsoDate;
  /** Garante as ocorrências de recorrências antes da leitura. */
  prepare?: () => Promise<unknown>;
}

/** Eventos do calendário no intervalo (derivados; nada é gravado). */
export class GetCalendarEventsUseCase {
  constructor(private readonly context: CalendarContext) {}

  async execute(range: CalendarRange): Promise<CalendarEvent[]> {
    await this.context.prepare?.();
    const [accounts, transactions, recurrences, cards, purchases, goals, contributions] =
      await Promise.all([
        this.context.accounts.findAll(),
        this.context.transactions.findAll(),
        this.context.transactions.findRecurrences(),
        this.context.cards.findAll(),
        this.context.cards.findPurchases(),
        this.context.goals.findAll(),
        this.context.goals.findContributions(),
      ]);
    const data: CalendarData = {
      accounts,
      transactions,
      recurrences,
      cards,
      purchases,
      goals,
      contributions,
    };
    return buildCalendarEvents(data, range, this.context.today());
  }
}
