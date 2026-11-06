import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Inbox } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { formatDateBR } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';

import { PanelCard } from './PanelCard';
import type { ActivityItem } from '../../domain/overview-types';

const FLOW = {
  in: { icon: ArrowDownLeft, className: 'bg-success/15 text-success' },
  out: { icon: ArrowUpRight, className: 'bg-destructive/15 text-destructive' },
  neutral: { icon: ArrowLeftRight, className: 'bg-muted text-muted-foreground' },
};

export function RecentActivity({ items }: { items: ActivityItem[] }) {
  return (
    <PanelCard
      title="Últimas movimentações"
      description="Contas e cartões, mais recentes primeiro."
    >
      {items.length === 0 ? (
        <EmptyState icon={Inbox} title="Nenhuma movimentação ainda" />
      ) : (
        <ul className="-mx-2 flex flex-col">
          {items.map((item) => {
            const flow = FLOW[item.flow];
            const Icon = flow.icon;
            const amount =
              item.flow === 'in'
                ? formatMoney(item.amount, { signDisplay: 'always' })
                : item.flow === 'out'
                  ? formatMoney(item.amount.negate())
                  : formatMoney(item.amount);
            return (
              <li key={item.id} className="flex items-center gap-3 rounded-lg px-2 py-2.5">
                <span
                  aria-hidden="true"
                  className={cn(
                    'grid size-9 shrink-0 place-items-center rounded-full',
                    flow.className,
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{item.description}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {[item.kindLabel, item.categoryLabel, item.sourceLabel, item.detail]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
                <div className="flex shrink-0 flex-col items-end">
                  <span
                    className={cn(
                      'text-sm font-semibold tabular-nums',
                      item.flow === 'in' && 'text-success',
                    )}
                  >
                    {amount}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatDateBR(item.date)}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </PanelCard>
  );
}
