import type { AxiosInstance } from 'axios';
import type { z } from 'zod';

import { parseRecords } from '@/lib/schemas/parse-records';

/**
 * GET de uma coleção da API validando cada item com o schema do recurso.
 * Paginação e filtros no servidor serão adicionados conforme o contrato de cada
 * módulo (Fase 4+).
 */
export async function fetchList<TSchema extends z.ZodType>(
  http: AxiosInstance,
  path: string,
  schema: TSchema,
): Promise<z.output<TSchema>[]> {
  const { data } = await http.get<unknown>(path);
  return parseRecords(schema, data, `GET ${path}`);
}
