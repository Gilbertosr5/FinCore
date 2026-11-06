/**
 * Erro de regra de negócio. A mensagem é sempre segura para exibição ao
 * usuário (pt-BR). `code` é estável e pode ser usado para decisões na interface.
 */
export class DomainError<TCode extends string = string> extends Error {
  readonly code: TCode;

  constructor(code: TCode, message: string) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}
