import type { Account } from '../entities/account';

export interface AccountRepository {
  findAll(): Promise<Account[]>;
  findById(id: string): Promise<Account | null>;
  /** Cria ou substitui a conta (id gerado no cliente — operação idempotente). */
  save(account: Account): Promise<void>;
}
