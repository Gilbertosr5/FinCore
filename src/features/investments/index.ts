export {
  ASSET_CLASS_LABELS,
  MOVEMENT_TYPE_LABELS,
  VALUATION_SOURCE_LABELS,
  type Asset,
  type AssetClass,
  type AssetValuation,
  type InvestmentMovement,
  type InvestmentMovementType,
  type ValuationSource,
} from './domain/entities/investment';
export type { InvestmentRepository } from './domain/repositories/investment.repository';
export {
  computePortfolio,
  computePosition,
  type PortfolioSummary,
  type Position,
} from './domain/services/portfolio';
export {
  ApiInvestmentRepository,
  assetRecordSchema,
  assetValuationRecordSchema,
  assetValuationToRecord,
  DemoInvestmentRepository,
  INVESTMENT_ENDPOINTS,
  investmentMovementRecordSchema,
  investmentMovementToRecord,
} from './infrastructure/investment.infrastructure';
