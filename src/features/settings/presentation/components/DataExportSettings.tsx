import { FileJson } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { getErrorMessage } from '@/lib/errors';
import { downloadBlob } from '@/lib/export/download';

import type { DataExporter } from '../context/data-export-context';

/** Baixa um arquivo JSON com todos os dados financeiros (backup/portabilidade). */
export function DataExportSettings({ exporter, today }: { exporter: DataExporter; today: string }) {
  const [pending, setPending] = useState(false);

  const run = async () => {
    setPending(true);
    try {
      const { json, records } = await exporter.exportAll();
      downloadBlob(new Blob([json], { type: 'application/json' }), `fincore-dados-${today}.json`);
      toast.success(`Exportação concluída: ${records.toLocaleString('pt-BR')} registros.`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        Arquivo JSON com contas, lançamentos, recorrências, cartões, orçamentos, metas e
        investimentos, no formato da API. Gerado no seu navegador — nada é enviado. Não inclui
        senhas nem o histórico de alterações.
      </p>
      <Button
        variant="outline"
        disabled={pending}
        onClick={() => {
          void run();
        }}
      >
        {pending ? <Spinner /> : <FileJson aria-hidden="true" />}
        Exportar meus dados
      </Button>
    </div>
  );
}
