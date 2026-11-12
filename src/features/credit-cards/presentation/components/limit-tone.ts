import type { ProgressTone } from '@/components/data-display/ProgressBar';

/** Tom da barra de limite: atenção a partir de 80%, crítico a partir de 95%. */
export function limitTone(percent: number | null): ProgressTone {
  if (percent === null) return 'primary';
  if (percent >= 95) return 'destructive';
  if (percent >= 80) return 'warning';
  return 'primary';
}
