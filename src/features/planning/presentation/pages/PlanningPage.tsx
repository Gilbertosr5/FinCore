import { CloudOff, Info } from 'lucide-react';

import { StatusScreen } from '@/components/feedback/StatusScreen';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getErrorMessage } from '@/lib/errors';

import { AnnualPlanSection } from '../components/AnnualPlanSection';
import { ProjectionSection } from '../components/ProjectionSection';
import { SavingsSimulator } from '../components/SavingsSimulator';
import { usePlanningSnapshot } from '../hooks/use-planning';

/** Planejamento: projeção de saldo com cenários, plano anual/mensal e simulações. */
export function PlanningPage() {
  const snapshot = usePlanningSnapshot();

  if (snapshot.isError) {
    return (
      <StatusScreen
        tone="destructive"
        icon={CloudOff}
        title="Não foi possível carregar o planejamento"
        description={getErrorMessage(snapshot.error)}
        actions={
          <Button
            onClick={() => {
              void snapshot.refetch();
            }}
          >
            Tentar novamente
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Alert variant="info">
        <Info aria-hidden="true" />
        <AlertTitle>Projeções são estimativas</AlertTitle>
        <AlertDescription>
          Calculadas a partir dos lançamentos, recorrências, parcelas e da média dos seus gastos
          variáveis. Nada aqui é gravado: altere valores e prazos à vontade.
        </AlertDescription>
      </Alert>
      {snapshot.data ? (
        <>
          <ProjectionSection snapshot={snapshot.data} />
          <AnnualPlanSection snapshot={snapshot.data} />
        </>
      ) : (
        <>
          <Skeleton className="h-[36rem] rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </>
      )}
      <SavingsSimulator />
    </div>
  );
}
