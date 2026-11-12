import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import type { IsoDate } from '@/lib/dates';
import { getErrorMessage } from '@/lib/errors';
import { formatMoney } from '@/lib/money';

import { ContributionDialog } from './ContributionDialog';
import type { GoalAction } from './GoalCard';
import { GoalFormDialog } from './GoalFormDialog';
import type { GoalView } from '../../application/goal-use-cases';
import { useDeleteGoal, useSetGoalStatus } from '../hooks/use-goals';

export interface PendingGoalAction {
  view: GoalView;
  action: GoalAction;
}

interface GoalActionDialogsProps {
  /** null = nenhuma ação; 'new' = criar meta. */
  pending: PendingGoalAction | 'new' | null;
  accounts: readonly { id: string; name: string }[];
  today: IsoDate;
  onClose: () => void;
  /** Após excluir (ex.: voltar à lista na tela de detalhes). */
  onDeleted?: () => void;
}

/** Diálogos das ações de meta: formulário, aporte/retirada e confirmações. */
export function GoalActionDialogs({
  pending,
  accounts,
  today,
  onClose,
  onDeleted,
}: GoalActionDialogsProps) {
  const setStatus = useSetGoalStatus();
  const remove = useDeleteGoal();
  const action = pending === 'new' || pending === null ? null : pending.action;
  const view = pending === 'new' || pending === null ? null : pending.view;
  const goal = view?.progress.goal;

  const confirmation = (() => {
    if (!view || !goal || !action) return null;
    if (action.type === 'delete') {
      return {
        title: 'Excluir meta?',
        text: 'A meta será removida definitivamente. Só é possível excluir metas sem aportes; caso contrário, cancele-a.',
        label: 'Excluir',
        destructive: true,
      };
    }
    if (action.type !== 'status') return null;
    if (action.status === 'completed') {
      return {
        title: 'Concluir meta?',
        text: view.progress.remaining.isPositive()
          ? `Ainda faltam ${formatMoney(view.progress.remaining)}. A meta será marcada como concluída mesmo assim; os aportes ficam no histórico.`
          : 'A meta foi atingida e será marcada como concluída.',
        label: 'Concluir',
        destructive: false,
      };
    }
    if (action.status === 'cancelled') {
      return {
        title: 'Cancelar meta?',
        text: 'A meta deixa de receber aportes e sai dos totais. Os aportes já feitos ficam no histórico; você pode reativá-la depois.',
        label: 'Cancelar meta',
        destructive: true,
      };
    }
    return {
      title: 'Reativar meta?',
      text: 'A meta volta a receber aportes e a contar nos totais.',
      label: 'Reativar',
      destructive: false,
    };
  })();

  const confirm = () => {
    if (!goal || !action) return;
    const onError = (error: unknown) => {
      toast.error(getErrorMessage(error));
    };
    if (action.type === 'delete') {
      remove.mutate(goal.id, {
        onSuccess: () => {
          toast.success('Meta excluída.');
          onClose();
          onDeleted?.();
        },
        onError,
      });
    } else if (action.type === 'status') {
      setStatus.mutate(
        { id: goal.id, status: action.status },
        {
          onSuccess: () => {
            toast.success(
              action.status === 'completed'
                ? 'Meta concluída.'
                : action.status === 'cancelled'
                  ? 'Meta cancelada.'
                  : 'Meta reativada.',
            );
            onClose();
          },
          onError,
        },
      );
    }
  };

  return (
    <>
      <GoalFormDialog
        target={pending === 'new' ? 'new' : action?.type === 'edit' && goal ? goal : null}
        today={today}
        onClose={onClose}
      />
      <ContributionDialog
        target={view && action?.type === 'contribute' ? { view, type: action.kind } : null}
        accounts={accounts}
        today={today}
        onClose={onClose}
      />
      <ConfirmDialog
        open={confirmation !== null}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        title={confirmation?.title ?? ''}
        description={confirmation?.text ?? ''}
        confirmLabel={confirmation?.label ?? ''}
        destructive={confirmation?.destructive}
        pending={setStatus.isPending || remove.isPending}
        onConfirm={confirm}
      />
    </>
  );
}
