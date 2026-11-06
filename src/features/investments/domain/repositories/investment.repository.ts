import type { Asset, AssetValuation, InvestmentMovement } from '../entities/investment';

/**
 * Contrato de leitura da carteira. Cadastro de ativos, movimentações e
 * integração com cotações externas entram na Fase 7.
 */
export interface InvestmentRepository {
  findAssets(): Promise<Asset[]>;
  findMovements(): Promise<InvestmentMovement[]>;
  findValuations(): Promise<AssetValuation[]>;
}
