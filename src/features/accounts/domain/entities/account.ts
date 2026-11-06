import type { IsoDate } from '@/lib/dates';
import type { Money } from '@/lib/money';

export type AccountType =
  'checking' | 'savings' | 'cash' | 'digital_wallet' | 'investment' | 'other';

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: 'Conta corrente',
  savings: 'Poupança',
  cash: 'Dinheiro em espécie',
  digital_wallet: 'Carteira digital',
  investment: 'Conta de investimentos',
  other: 'Outras contas',
};

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  institution: string | null;
  /** Saldo na data `initialBalanceDate`; movimentações anteriores não são consideradas. */
  initialBalance: Money;
  initialBalanceDate: IsoDate;
  archived: boolean;
}
