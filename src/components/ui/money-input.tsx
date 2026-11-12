import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

import { Input } from './input';

/**
 * Campo de valor em reais. Aceita o formato brasileiro ("1.234,56") — a
 * conversão para `Money` é feita por `parseMoneyInput` no schema do formulário,
 * nunca por `parseFloat`.
 */
export function MoneyInput({ className, ...props }: Omit<ComponentProps<'input'>, 'type'>) {
  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground"
      >
        R$
      </span>
      <Input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0,00"
        className={cn('pl-9 tabular-nums', className)}
        {...props}
      />
    </div>
  );
}
