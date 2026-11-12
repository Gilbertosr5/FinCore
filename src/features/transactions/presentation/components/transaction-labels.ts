import type { TransactionKind, TransactionStatus } from '../../domain/entities/transaction';

export const KIND_LABELS: Record<TransactionKind, string> = {
  income: 'Receita',
  expense: 'Despesa',
  transfer: 'Transferência',
  card_payment: 'Pagamento de fatura',
  investment: 'Investimento',
};

export const STATUS_LABELS: Record<TransactionStatus, string> = {
  pending: 'Pendente',
  paid: 'Liquidado',
  cancelled: 'Cancelado',
};

export const SORT_LABELS = {
  date_desc: 'Mais recentes',
  date_asc: 'Mais antigos',
  amount_desc: 'Maior valor',
  amount_asc: 'Menor valor',
} as const;

/** Rótulo de situação considerando o tipo: "Pago" × "Recebido". */
export function statusLabel(
  kind: TransactionKind,
  status: TransactionStatus,
  overdue: boolean,
): string {
  if (status === 'paid')
    return kind === 'income' ? 'Recebido' : kind === 'expense' ? 'Pago' : 'Efetivado';
  if (status === 'cancelled') return 'Cancelado';
  if (overdue) return 'Vencido';
  return kind === 'income' ? 'A receber' : kind === 'expense' ? 'A pagar' : 'Agendado';
}
