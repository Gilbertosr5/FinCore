export type { Flow, FlowType, PlanningData, VariableAverages } from './domain/flows';
export { collectFlows, computeVariableAverages, VARIABLE_WINDOW_MONTHS } from './domain/flows';
export {
  buildBalanceProjection,
  MAX_PROJECTION_MONTHS,
  SCENARIO_LABELS,
  SCENARIO_PRESETS,
  type BalanceProjection,
  type PlannedPurchase,
  type ProjectionMonth,
  type ScenarioAdjustments,
  type ScenarioKey,
} from './domain/balance-projection';
export {
  buildAnnualPlan,
  buildMonthPlan,
  PLAN_MONTH_STATUS_LABELS,
  type AnnualPlan,
  type CategoryPlanLine,
  type MonthPlan,
  type PlanAmounts,
  type PlanMonthStatus,
} from './domain/month-plan';
export {
  MAX_SIMULATION_MONTHS,
  monthsToReach,
  requiredMonthlyContribution,
  simulateSavings,
  type SavingsInput,
  type SavingsPoint,
  type SavingsResult,
} from './domain/savings-simulation';
export {
  LoadPlanningDataUseCase,
  type PlanningContext,
  type PlanningSnapshot,
} from './application/load-planning-data';
export {
  PlanningServicesContext,
  usePlanningServices,
  type PlanningServices,
} from './presentation/context/planning-context';
export * from './presentation/hooks/use-planning';
