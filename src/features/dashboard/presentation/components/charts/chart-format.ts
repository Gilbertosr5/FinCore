import { formatMonthLong, formatMonthShort, type MonthKey } from '@/lib/dates';
import { formatCompactCurrency, formatMoney, Money } from '@/lib/money';

/** Eixo Y monetário compacto ("R$ 12 mil"). */
export const axisCurrency = (value: number) => formatCompactCurrency(value);

/**
 * Valores dos gráficos chegam como `number` (escala de exibição). Para textos de
 * tooltip/tabela reconvertemos em Money e usamos a formatação oficial.
 */
export const displayMoney = (value: number) => formatMoney(Money.of(value.toFixed(2)));

export const monthLabel = (month: MonthKey) => formatMonthShort(month);
export const monthTitle = (month: MonthKey) => formatMonthLong(month);
