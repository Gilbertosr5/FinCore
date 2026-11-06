import { cn } from '@/lib/utils';

export type ProgressTone = 'primary' | 'success' | 'warning' | 'destructive';

interface ProgressBarProps {
  /** Percentual (pode exceder 100; a barra é limitada visualmente). */
  value: number;
  label: string;
  valueText: string;
  tone?: ProgressTone;
  className?: string;
}

const TONES: Record<ProgressTone, string> = {
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  destructive: 'bg-destructive',
};

/** Barra de progresso acessível (role="progressbar" com texto do valor). */
export function ProgressBar({
  value,
  label,
  valueText,
  tone = 'primary',
  className,
}: ProgressBarProps) {
  const clamped = Math.min(Math.max(value, 0), 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      aria-valuetext={valueText}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-muted', className)}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-500', TONES[tone])}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
