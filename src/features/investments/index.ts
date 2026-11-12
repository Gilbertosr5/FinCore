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
  QUANTITY_ASSET_CLASSES,
} from './domain/entities/investment';
export {
  MARKET_INDICATOR_LABELS,
  type MarketIndicatorCode,
  type MarketIndicatorQuote,
  type MarketIndicatorsSnapshot,
} from './domain/entities/market-indicator';
export type {
  InvestmentRepository,
  MarketIndicatorRepository,
} from './domain/repositories/investment.repository';
export {
  computePortfolio,
  computePosition,
  findOversell,
  replayMovements,
  type PortfolioSummary,
  type Position,
} from './domain/services/portfolio';
export {
  ApiInvestmentRepository,
  ApiMarketIndicatorRepository,
  assetToRecord,
  DemoMarketIndicatorRepository,
  assetRecordSchema,
  assetValuationRecordSchema,
  assetValuationToRecord,
  DemoInvestmentRepository,
  INVESTMENT_ENDPOINTS,
  investmentMovementRecordSchema,
  investmentMovementToRecord,
} from './infrastructure/investment.infrastructure';
export {
  buildEvolution,
  buildIncomeByMonth,
  type EvolutionPoint,
  type IncomePoint,
} from './domain/services/portfolio-analytics';

// Fase 7 — escrita e casos de uso
export {
  allowedMovementTypes,
  ASSET_NAME_MAX_LENGTH,
  createInvestmentUseCases,
  InvestmentError,
  TICKER_MAX_LENGTH,
  type AssetDetails,
  type AssetInput,
  type InvestmentContext,
  type InvestmentLedgerPort,
  type InvestmentUseCases,
  type MovementInput,
  type PortfolioOverview,
  type PositionView,
  type RevaluationSuggestion,
  type ValuationInput,
} from './application/investment-use-cases';
export {
  InvestmentsServicesContext,
  useInvestmentsServices,
  type InvestmentsServices,
} from './presentation/context/investments-context';
export * from './presentation/hooks/use-investments';
