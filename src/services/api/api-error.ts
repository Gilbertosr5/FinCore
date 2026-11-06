import { isAxiosError, isCancel } from 'axios';
import { z } from 'zod';

/**
 * Erro HTTP normalizado. Toda falha de comunicação com a API chega às camadas
 * superiores como ApiError — nunca como AxiosError — para que casos de uso e
 * componentes não dependam da biblioteca HTTP.
 *
 * Contrato esperado do backend: RFC 9457 (Problem Details), suportado nativamente
 * pelo Spring Boot 3 via `ProblemDetail`. Ver docs/api-contract.md.
 */

export type ApiErrorKind =
  | 'bad_request' // 400
  | 'unauthorized' // 401
  | 'forbidden' // 403
  | 'not_found' // 404
  | 'conflict' // 409
  | 'validation' // 422
  | 'rate_limited' // 429
  | 'server' // 5xx
  | 'network'
  | 'timeout'
  | 'canceled'
  | 'unknown';

export interface FieldError {
  field: string;
  message: string;
}

const problemDetailsSchema = z
  .object({
    type: z.string().optional(),
    title: z.string().optional(),
    status: z.number().optional(),
    detail: z.string().optional(),
    instance: z.string().optional(),
    code: z.string().optional(),
    errors: z
      .array(z.object({ field: z.string(), message: z.string() }))
      .optional()
      .catch(undefined),
  })
  .loose();

const DEFAULT_MESSAGES: Record<ApiErrorKind, string> = {
  bad_request: 'A requisição contém dados inválidos.',
  unauthorized: 'Sua sessão expirou. Faça login novamente.',
  forbidden: 'Você não tem permissão para realizar esta ação.',
  not_found: 'O recurso solicitado não foi encontrado.',
  conflict: 'Esta operação conflita com dados existentes. Atualize a página e tente novamente.',
  validation: 'Alguns campos precisam ser corrigidos.',
  rate_limited: 'Muitas requisições em pouco tempo. Aguarde e tente novamente.',
  server: 'Ocorreu um erro no servidor. Tente novamente em instantes.',
  network: 'Não foi possível conectar ao servidor. Verifique sua conexão.',
  timeout: 'O servidor demorou para responder. Tente novamente.',
  canceled: 'A operação foi cancelada.',
  unknown: 'Ocorreu um erro inesperado.',
};

export interface ApiErrorInit {
  kind: ApiErrorKind;
  message?: string;
  status?: number;
  code?: string;
  fieldErrors?: FieldError[];
  retryAfterSeconds?: number;
  requestId?: string;
  cause?: unknown;
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | undefined;
  readonly code: string | undefined;
  readonly fieldErrors: FieldError[];
  readonly retryAfterSeconds: number | undefined;
  readonly requestId: string | undefined;

  constructor(init: ApiErrorInit) {
    super(init.message ?? DEFAULT_MESSAGES[init.kind], { cause: init.cause });
    this.name = 'ApiError';
    this.kind = init.kind;
    this.status = init.status;
    this.code = init.code;
    this.fieldErrors = init.fieldErrors ?? [];
    this.retryAfterSeconds = init.retryAfterSeconds;
    this.requestId = init.requestId;
  }

  /** Erros que podem ter sucesso se repetidos automaticamente. */
  get isRetryable(): boolean {
    return this.kind === 'network' || this.kind === 'timeout' || this.kind === 'server';
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function kindFromStatus(status: number): ApiErrorKind {
  switch (status) {
    case 400:
      return 'bad_request';
    case 401:
      return 'unauthorized';
    case 403:
      return 'forbidden';
    case 404:
      return 'not_found';
    case 409:
      return 'conflict';
    case 422:
      return 'validation';
    case 429:
      return 'rate_limited';
    default:
      if (status >= 500) return 'server';
      if (status >= 400) return 'bad_request';
      return 'unknown';
  }
}

function parseRetryAfter(value: unknown): number | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
}

function readHeader(headers: unknown, name: string): unknown {
  if (headers && typeof headers === 'object' && name in headers) {
    return (headers as Record<string, unknown>)[name];
  }
  return undefined;
}

/** Converte qualquer erro lançado pelo cliente HTTP em ApiError. */
export function normalizeHttpError(error: unknown): ApiError {
  if (isApiError(error)) return error;

  if (isCancel(error)) {
    return new ApiError({ kind: 'canceled', cause: error });
  }

  if (!isAxiosError(error)) {
    return new ApiError({ kind: 'unknown', cause: error });
  }

  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return new ApiError({ kind: 'timeout', cause: error });
  }

  const response = error.response;
  if (!response) {
    return new ApiError({ kind: 'network', cause: error });
  }

  const kind = kindFromStatus(response.status);
  const parsed = problemDetailsSchema.safeParse(response.data);
  const problem = parsed.success ? parsed.data : undefined;
  const requestId = readHeader(response.headers, 'x-request-id');

  return new ApiError({
    kind,
    status: response.status,
    // Mensagens de erro 5xx do servidor não são exibidas ao usuário (podem vazar detalhes internos).
    message: kind === 'server' ? undefined : (problem?.detail ?? problem?.title),
    code: problem?.code,
    fieldErrors: problem?.errors,
    retryAfterSeconds: parseRetryAfter(readHeader(response.headers, 'retry-after')),
    requestId: typeof requestId === 'string' ? requestId : undefined,
    cause: error,
  });
}
