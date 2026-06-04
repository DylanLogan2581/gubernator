// Turns feature — advance and track turns within a world.
// Implemented in Epic 2.
export {
  useSettlementTransitionOutcome,
  useWorldTransitionOutcome,
} from "./hooks/useTransitionOutcome";
export {
  EndTurnTransitionError,
  endTurnTransitionMutationOptions,
  isEndTurnTransitionError,
  type EndTurnTransitionInput,
  type EndTurnTransitionMutationResult,
  type EndTurnTransitionSummary,
} from "./mutations/endTurnTransitionMutations";
export { EndTurnControl } from "./components/EndTurnControl";
export {
  TurnTransitionOutcomeContent,
  TurnTransitionOutcomeEmptyState,
  TurnTransitionOutcomePanel,
} from "./components/TurnTransitionOutcomePanel";
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
export {
  latestSettlementTransitionOutcomeQueryOptions,
  latestWorldTransitionOutcomeQueryOptions,
  type TurnTransitionLogEntry,
  type TurnTransitionNotification,
  type TurnTransitionOutcome,
  type TurnTransitionResourceSnapshot,
  type TurnTransitionSettlementSnapshot,
} from "./queries/turnTransitionOutcomeQueries";
export { turnQueryKeys } from "./queries/turnQueryKeys";
export type {
  CurrentTurnDateDisplay,
  CurrentTurnDateDisplayLabels,
} from "./types/currentTurnTypes";
export type {
  LatestTurnTransitionStatus,
  TurnTransitionState,
} from "./types/turnTransitionStatusTypes";
