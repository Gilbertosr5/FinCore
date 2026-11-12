/** Quantidade em formato brasileiro (até 8 casas). */
export function formatQuantity(value: string): string {
  const [integer = '0', decimals = ''] = value.split('.');
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const trimmed = decimals.replace(/0+$/, '');
  return trimmed ? `${grouped},${trimmed}` : grouped;
}
