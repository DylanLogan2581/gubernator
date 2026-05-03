// Turns feature — advance and track turns within a world.
// Implemented in Epic 2.
export {
  EndTurnBasicError,
  endTurnBasicMutationOptions,
  isEndTurnBasicError,
  type EndTurnBasicInput,
  type EndTurnBasicMutationResult,
} from "./mutations/endTurnBasicMutations";
export {
  CurrentTurnStateError,
  currentTurnStateQueryOptions,
  isCurrentTurnStateError,
  shouldRetryCurrentTurnStateQuery,
} from "./queries/currentTurnStateQueries";
export {
  LatestTurnTransitionStatusError,
  isLatestTurnTransitionStatusError,
  latestTurnTransitionStatusQueryOptions,
  shouldRetryLatestTurnTransitionStatusQuery,
} from "./queries/latestTurnTransitionStatusQueries";
export { turnQueryKeys } from "./queries/turnQueryKeys";
export type {
  CurrentTurnDateDisplay,
  CurrentTurnDateDisplayLabels,
} from "./types/currentTurnTypes";
export type {
  BasicEndTurnLogPayload,
  BasicEndTurnNotificationPayload,
  BasicEndTurnReadinessRow,
  BasicEndTurnReadinessSummary,
  BasicEndTurnTransitionInput,
  BasicEndTurnTransitionResult,
} from "./types/endTurnTransitionTypes";
export type {
  LatestTurnTransitionStatus,
  TurnTransitionState,
} from "./types/turnTransitionStatusTypes";
export {
  BasicEndTurnTransitionPlanningError,
  isBasicEndTurnTransitionPlanningError,
  planBasicEndTurnTransition,
  type BasicEndTurnTransitionPlanningErrorCode,
} from "./utils/endTurnTransitionPlanning";
