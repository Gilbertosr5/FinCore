import { ServerCrash } from 'lucide-react';

import { StatusScreen } from './StatusScreen';

interface BootstrapErrorProps {
  error: unknown;
}

/**
 * Exibida quando a aplicação não consegue inicializar (ex.: variáveis de
 * ambiente inválidas). Detalhes técnicos só aparecem em desenvolvimento.
 */
export function BootstrapError({ error }: BootstrapErrorProps) {
  const details = import.meta.env.DEV && error instanceof Error ? error.message : null;
  return (
    <StatusScreen
      fullScreen
      tone="destructive"
      icon={ServerCrash}
      title="Não foi possível iniciar o FinCore"
      description={
        <>
          <p>Ocorreu um problema na inicialização da aplicação.</p>
          {details && (
            <pre className="mt-4 overflow-x-auto rounded-lg border border-border bg-muted p-3 text-left text-xs whitespace-pre-wrap">
              {details}
            </pre>
          )}
        </>
      }
    />
  );
}
