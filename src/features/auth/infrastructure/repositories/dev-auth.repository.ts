import { STORAGE_KEYS } from '@/constants/storage-keys';

import type { User } from '../../domain/entities/user';
import { AuthError } from '../../domain/errors/auth-error';
import type { AuthRepository } from '../../domain/repositories/auth.repository';
import { normalizeEmail } from '../../domain/rules/credentials.rules';
import type {
  ChangePasswordData,
  LoginCredentials,
  RegisterData,
  ResetPasswordData,
} from '../../domain/types/auth.types';
import { DEV_DEMO_ACCOUNT } from '../dev/dev-users.seed';

/**
 * ⚠️ ADAPTADOR DE DESENVOLVIMENTO — NÃO É AUTENTICAÇÃO REAL.
 *
 * Simula o backend localmente para permitir usar a aplicação sem servidor:
 * - Contas ficam SOMENTE EM MEMÓRIA (somem ao recarregar a página), exceto a
 *   conta de demonstração, recriada a cada carga. Senhas nunca são persistidas.
 * - A "sessão" é um marcador {userId, expiresAt} em sessionStorage — não é um
 *   token nem uma credencial; serve apenas para sobreviver a um F5 na aba.
 * - Links de redefinição de senha são entregues via `onPasswordResetLink`
 *   (por padrão, console do navegador) em vez de e-mail.
 *
 * Bloqueado em builds de produção (ver env.schema.ts).
 */

interface StoredAccount {
  user: User;
  password: string;
}

interface DevSessionMarker {
  userId: string;
  expiresAt: number;
}

interface ResetTicket {
  email: string;
  expiresAt: number;
}

export interface DevAuthRepositoryOptions {
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  now?: () => number;
  /** Latência simulada para exercitar estados de carregamento. */
  latencyMs?: number;
  sessionTtlMs?: number;
  generateId?: () => string;
  onPasswordResetLink?: (link: string) => void;
}

const DEFAULT_SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 horas
const RESET_TICKET_TTL_MS = 30 * 60 * 1000; // 30 minutos

export class DevAuthRepository implements AuthRepository {
  private readonly accounts = new Map<string, StoredAccount>();
  private readonly resetTickets = new Map<string, ResetTicket>();
  private readonly storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  private readonly now: () => number;
  private readonly latencyMs: number;
  private readonly sessionTtlMs: number;
  private readonly generateId: () => string;
  private readonly onPasswordResetLink: (link: string) => void;

  constructor(options: DevAuthRepositoryOptions = {}) {
    this.storage = options.storage ?? sessionStorage;
    this.now = options.now ?? Date.now;
    this.latencyMs = options.latencyMs ?? 400;
    this.sessionTtlMs = options.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;
    this.generateId = options.generateId ?? (() => crypto.randomUUID());
    this.onPasswordResetLink =
      options.onPasswordResetLink ??
      ((link) => {
        console.warn(`[FinCore • autenticação de desenvolvimento] Link de redefinição: ${link}`);
      });

    this.accounts.set(DEV_DEMO_ACCOUNT.email, {
      user: { id: DEV_DEMO_ACCOUNT.id, name: DEV_DEMO_ACCOUNT.name, email: DEV_DEMO_ACCOUNT.email },
      password: DEV_DEMO_ACCOUNT.password,
    });
  }

  async login({ email, password }: LoginCredentials): Promise<User> {
    await this.delay();
    const account = this.accounts.get(normalizeEmail(email));
    if (account?.password !== password) throw new AuthError('invalid_credentials');
    this.startSession(account.user);
    return { ...account.user };
  }

  async register({ name, email, password }: RegisterData): Promise<User> {
    await this.delay();
    const normalizedEmail = normalizeEmail(email);
    if (this.accounts.has(normalizedEmail)) throw new AuthError('email_already_registered');
    const user: User = { id: this.generateId(), name, email: normalizedEmail };
    this.accounts.set(normalizedEmail, { user, password });
    this.startSession(user);
    return { ...user };
  }

  async logout(): Promise<void> {
    await this.delay();
    this.storage.removeItem(STORAGE_KEYS.devAuthSession);
  }

  async getCurrentUser(): Promise<User | null> {
    await this.delay();
    const account = this.getSessionAccount();
    return account ? { ...account.user } : null;
  }

  async requestPasswordReset(email: string): Promise<void> {
    await this.delay();
    const normalizedEmail = normalizeEmail(email);
    // Resposta idêntica exista ou não a conta (evita enumeração de e-mails).
    if (!this.accounts.has(normalizedEmail)) return;
    const token = this.generateId();
    this.resetTickets.set(token, {
      email: normalizedEmail,
      expiresAt: this.now() + RESET_TICKET_TTL_MS,
    });
    this.onPasswordResetLink(`/redefinir-senha?token=${encodeURIComponent(token)}`);
  }

  async resetPassword({ token, newPassword }: ResetPasswordData): Promise<void> {
    await this.delay();
    const ticket = this.resetTickets.get(token);
    // Token de uso único: removido em qualquer tentativa válida ou expirada.
    this.resetTickets.delete(token);
    if (!ticket || ticket.expiresAt <= this.now()) throw new AuthError('invalid_reset_token');
    const account = this.accounts.get(ticket.email);
    if (!account) throw new AuthError('invalid_reset_token');
    account.password = newPassword;
    // Redefinir a senha encerra a sessão atual, como faria um backend real.
    this.storage.removeItem(STORAGE_KEYS.devAuthSession);
  }

  async changePassword({ currentPassword, newPassword }: ChangePasswordData): Promise<void> {
    await this.delay();
    const account = this.getSessionAccount();
    if (!account) throw new AuthError('not_authenticated');
    if (account.password !== currentPassword) throw new AuthError('invalid_current_password');
    account.password = newPassword;
  }

  private startSession(user: User): void {
    const marker: DevSessionMarker = { userId: user.id, expiresAt: this.now() + this.sessionTtlMs };
    this.storage.setItem(STORAGE_KEYS.devAuthSession, JSON.stringify(marker));
  }

  private getSessionAccount(): StoredAccount | null {
    const marker = this.readSessionMarker();
    if (!marker) return null;
    if (marker.expiresAt <= this.now()) {
      this.storage.removeItem(STORAGE_KEYS.devAuthSession);
      return null;
    }
    for (const account of this.accounts.values()) {
      if (account.user.id === marker.userId) return account;
    }
    // Conta criada antes de um recarregamento: não existe mais em memória.
    this.storage.removeItem(STORAGE_KEYS.devAuthSession);
    return null;
  }

  private readSessionMarker(): DevSessionMarker | null {
    const raw = this.storage.getItem(STORAGE_KEYS.devAuthSession);
    if (!raw) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'userId' in parsed &&
        'expiresAt' in parsed &&
        typeof parsed.userId === 'string' &&
        typeof parsed.expiresAt === 'number'
      ) {
        return { userId: parsed.userId, expiresAt: parsed.expiresAt };
      }
    } catch {
      // marcador corrompido: tratado como ausência de sessão
    }
    return null;
  }

  private delay(): Promise<void> {
    if (this.latencyMs <= 0) return Promise.resolve();
    return new Promise((resolve) => setTimeout(resolve, this.latencyMs));
  }
}
