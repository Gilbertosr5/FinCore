import { createContext, useContext } from 'react';

/** Exportação de todos os dados do usuário (JSON), fornecida pela composição. */
export interface DataExporter {
  /** Conteúdo JSON (texto) e quantidade de registros exportados. */
  exportAll(): Promise<{ json: string; records: number }>;
}

export const DataExportContext = createContext<DataExporter | null>(null);

export function useDataExporter(): DataExporter | null {
  return useContext(DataExportContext);
}
