import type { Account } from '../entities/account';

/**
 * Contrato de leitura de contas. Operações de escrita (criar, editar, arquivar)
 * entram na Fase 4, junto com as telas de gestão.
 */
export interface AccountRepository {
  findAll(): Promise<Account[]>;
}
