import { z } from 'zod';

import type { User } from '../../domain/entities/user';

/** DTO de usuário retornado pela API (contrato em docs/auth-contract.md). */
export const userDtoSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  name: z.string(),
  email: z.string(),
});

export type UserDto = z.input<typeof userDtoSchema>;

/** Valida a resposta da API: dados fora do contrato não entram na aplicação. */
export function toUser(dto: unknown): User {
  const parsed = userDtoSchema.parse(dto);
  return { id: parsed.id, name: parsed.name, email: parsed.email };
}
