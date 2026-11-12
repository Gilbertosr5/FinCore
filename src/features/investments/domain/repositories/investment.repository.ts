import type { Transaction } from '@/features/transactions/domain/entities/transaction';

import type { Asset, AssetValuation, InvestmentMovement } from '../entities/investment';
import type { MarketIndicatorsSnapshot } from '../entities/market-indicator';

/** Contrato da carteira (ids gerados no cliente; gravações idempotentes). */
export interface InvestmentRepository {
  findAssets(): Promise<Asset[]>;
  findMovements(): Promise<InvestmentMovement[]>;
  findValuations(): Promise<AssetValuation[]>;
  saveAsset(asset: Asset): Promise<void>;
  /** Exclui o ativo (somente sem movimentações — validado no caso de uso). */
  removeAsset(id: string): Promise<void>;
  /**
   * Grava a movimentação e, se houver, o lançamento da conta numa única operação
   * atômica (ADR 0015): na API, uma requisição; no IndexedDB, uma transação.
   */
  saveMovement(movement: InvestmentMovement, linked?: Transaction | null): Promise<void>;
  /** Exclui a movimentação e o lançamento vinculado, atomicamente. */
  removeMovement(id: string, linkedTransactionIds?: readonly string[]): Promise<void>;
  saveValuation(valuation: AssetValuation): Promise<void>;
  removeValuation(id: string): Promise<void>;
}

/**
 * Porta dos indicadores de mercado. A implementação real depende do backend
 * (contrato em docs/api-contract.md); no modo demonstração retorna indisponível.
 */
export interface MarketIndicatorRepository {
  findLatest(): Promise<MarketIndicatorsSnapshot>;
}
