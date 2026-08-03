// Turns feature — advance and track turns within a world.
// Implemented in Epic 2.
export { TurnLogBrowser } from "./components/TurnLogBrowser";
export { TurnLogPage } from "./components/TurnLogPage";
export {
  turnLogBrowserQueryOptions,
  type TurnLogBrowserEntry,
  type TurnLogBrowserFilter,
  type TurnLogBrowserPage,
  TURN_LOG_PAGE_SIZE,
} from "./queries/turnLogBrowserQueries";
export {
  useSettlementTransitionOutcome,
  useWorldTransitionOutcome,
} from "./hooks/useTransitionOutcome";
export {
  EndTurnTransitionError,
  endTurnTransitionMutationOptions,
  invalidateAfterTurnAdvance,
  isEndTurnTransitionError,
  type EndTurnTransitionInput,
  type EndTurnTransitionMutationResult,
} from "./mutations/endTurnTransitionMutations";
export {
  FailStuckTurnTransitionError,
  failStuckTurnTransitionMutationOptions,
  isFailStuckTurnTransitionError,
  type FailStuckTurnTransitionInput,
  type FailStuckTurnTransitionMutationResult,
} from "./mutations/failStuckTurnTransitionMutations";
export { EndTurnControl } from "./components/EndTurnControl";
export { EndTurnConfirmationDialog } from "./components/EndTurnConfirmationDialog";
export {
  useEndTurnControl,
  type UseEndTurnControlResult,
} from "./hooks/useEndTurnControl";
export {
  getControlDescription,
  getErrorDescription as getEndTurnErrorDescription,
  getTurnProgressLabel,
  getTurnProgressPercentage,
} from "./utils/endTurnDescriptions";
export { TurnTransitionProgressPanel } from "./components/TurnTransitionProgressPanel";
export { WorldTurnPauseOverlay } from "./components/WorldTurnPauseOverlay";
export {
  useWorldTurnPause,
  type UseWorldTurnPauseResult,
  type WorldTurnPauseState,
} from "./hooks/useWorldTurnPause";
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
export {
  LOG_CATEGORY_LABELS,
  logCategoryLabel,
} from "./utils/logCategoryLabels";
export type {
  CurrentTurnDateDisplay,
  CurrentTurnDateDisplayLabels,
} from "./types/currentTurnTypes";
export type {
  LatestTurnTransitionStatus,
  TurnTransitionProgressStage,
  TurnTransitionState,
} from "./types/turnTransitionStatusTypes";
