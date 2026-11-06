import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';

import { isApiError } from '@/services/api/api-error';

/**
 * Aplica erros por campo vindos da API (422 / Problem Details `errors[]`) aos
 * campos do formulário. Retorna true se ao menos um erro foi aplicado.
 */
export function applyApiFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  knownFields: readonly Path<T>[],
): boolean {
  if (!isApiError(error)) return false;
  let applied = false;
  for (const fieldError of error.fieldErrors) {
    const field = knownFields.find((name) => name === fieldError.field);
    if (field) {
      setError(field, { type: 'server', message: fieldError.message });
      applied = true;
    }
  }
  return applied;
}
