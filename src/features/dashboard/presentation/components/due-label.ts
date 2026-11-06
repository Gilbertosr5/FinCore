/** "vence hoje", "vence amanhã", "vence em 5 dias", "vencida há 2 dias". */
export function describeDue(daysUntilDue: number): string {
  if (daysUntilDue === 0) return 'Vence hoje';
  if (daysUntilDue === 1) return 'Vence amanhã';
  if (daysUntilDue > 1) return `Vence em ${daysUntilDue} dias`;
  const late = Math.abs(daysUntilDue);
  return `Vencida há ${late} ${late === 1 ? 'dia' : 'dias'}`;
}
