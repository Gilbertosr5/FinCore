/**
 * Cores e estilos de gráficos, sempre via tokens CSS (src/styles/globals.css).
 * A paleta categórica tem ordem fixa e validada para daltonismo; a cor de uma
 * série é definida pela entidade (colorIndex), nunca pela posição no ranking.
 */

export const PALETTE_SIZE = 8;

export function seriesColor(colorIndex: number | null): string {
  if (colorIndex === null) return 'var(--muted-foreground)';
  return `var(--chart-${(colorIndex % PALETTE_SIZE) + 1})`;
}

export const CHART_AXIS_TICK = { fill: 'var(--chart-axis)', fontSize: 12 } as const;
export const CHART_GRID_STROKE = 'var(--chart-grid)';
export const CHART_HEIGHT = 260;
