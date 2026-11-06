import { z } from 'zod';

export class DataIntegrityError extends Error {
  constructor(source: string, cause: unknown) {
    super(`Dados inválidos recebidos de "${source}".`, { cause });
    this.name = 'DataIntegrityError';
  }
}

/**
 * Valida uma lista de registros (IndexedDB ou resposta da API). Registros fora
 * do contrato não entram na aplicação: a falha é explícita, nunca silenciosa.
 */
export function parseRecords<TSchema extends z.ZodType>(
  schema: TSchema,
  data: unknown,
  source: string,
): z.output<TSchema>[] {
  const result = z.array(schema).safeParse(data);
  if (!result.success) throw new DataIntegrityError(source, result.error);
  return result.data;
}
