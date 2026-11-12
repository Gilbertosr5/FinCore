import { Badge } from '@/components/ui/badge';

import type { Position } from '../../domain/services/portfolio';

const SHORT_LABELS = {
  manual: 'Manual',
  market_quote: 'Cotação',
  estimate: 'Estimativa',
  cost: 'Pelo custo',
} as const;

const DESCRIPTIONS = {
  manual: 'Valor informado manualmente',
  market_quote: 'Cotação externa',
  estimate: 'Valor estimado — não é cotação real',
  cost: 'Sem avaliação: exibindo o custo (não é rentabilidade real)',
} as const;

/**
 * Origem do valor atual em texto (nunca só cor). "Ajustado" indica aplicações ou
 * retiradas posteriores à última avaliação, somadas pelo custo.
 */
export function ValueSourceBadge({
  position,
}: {
  position: Pick<Position, 'valueSource' | 'adjustedSinceValuation'>;
}) {
  const source = position.valueSource;
  return (
    <span className="inline-flex flex-wrap gap-1">
      <Badge
        variant={source === 'manual' || source === 'market_quote' ? 'secondary' : 'warning'}
        title={DESCRIPTIONS[source]}
      >
        {SHORT_LABELS[source]}
        <span className="sr-only">: {DESCRIPTIONS[source]}</span>
      </Badge>
      {position.adjustedSinceValuation && (
        <Badge variant="warning" title="Movimentações após a última avaliação, somadas pelo custo">
          Ajustado
          <span className="sr-only">
            : movimentações após a última avaliação somadas pelo custo
          </span>
        </Badge>
      )}
    </span>
  );
}
