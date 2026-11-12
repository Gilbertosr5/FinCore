export {
  GOAL_CATEGORY_LABELS,
  GOAL_PRIORITY_LABELS,
  GOAL_STATUS_LABELS,
  type Goal,
  type GoalCategory,
  type GoalContribution,
  type GoalPriority,
  type GoalStatus,
} from './domain/entities/goal';
export type { GoalRepository } from './domain/repositories/goal.repository';
export {
  computeGoalProgress,
  GOAL_PACE_WINDOW_MONTHS,
  projectGoal,
  type GoalProgress,
  type GoalProjection,
} from './domain/services/goal-progress';
export {
  ApiGoalRepository,
  DemoGoalRepository,
  GOAL_ENDPOINTS,
  goalContributionRecordSchema,
  goalContributionToRecord,
  goalRecordSchema,
  goalToRecord,
} from './infrastructure/goal.infrastructure';

// Fase 6 — escrita e casos de uso
export {
  createGoalUseCases,
  GOAL_DESCRIPTION_MAX_LENGTH,
  GOAL_NAME_MAX_LENGTH,
  GoalError,
  type ContributionInput,
  type GoalContext,
  type GoalDetails,
  type GoalInput,
  type GoalsOverview,
  type GoalTransferPort,
  type GoalUseCases,
  type GoalView,
} from './application/goal-use-cases';
export {
  GoalsServicesContext,
  useGoalsServices,
  type GoalsServices,
} from './presentation/context/goals-context';
export * from './presentation/hooks/use-goals';
