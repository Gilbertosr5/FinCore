export {
  GOAL_CATEGORY_LABELS,
  type Goal,
  type GoalCategory,
  type GoalContribution,
  type GoalPriority,
  type GoalStatus,
} from './domain/entities/goal';
export type { GoalRepository } from './domain/repositories/goal.repository';
export { computeGoalProgress, type GoalProgress } from './domain/services/goal-progress';
export {
  ApiGoalRepository,
  DemoGoalRepository,
  GOAL_ENDPOINTS,
  goalContributionRecordSchema,
  goalContributionToRecord,
  goalRecordSchema,
  goalToRecord,
} from './infrastructure/goal.infrastructure';
