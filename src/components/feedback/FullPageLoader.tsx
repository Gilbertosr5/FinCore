import { Spinner } from '@/components/ui/spinner';

export function FullPageLoader({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background text-sm text-muted-foreground"
    >
      <Spinner className="size-6 text-primary" />
      <span>{label}</span>
    </div>
  );
}
