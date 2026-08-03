export type TurnTransitionState = "running" | "completed" | "failed";

// Coarse progress the background turn worker stamps while the turn runs
// (#1278). Null before the worker picks the job up and once it finishes.
export type TurnTransitionProgressStage =
  | "loading"
  | "persisting"
  | "queued"
  | "simulating";

export type LatestTurnTransitionStatus = {
  readonly finishedAt: string | null;
  readonly fromTurnNumber: number;
  readonly id: string;
  readonly isRunning: boolean;
  readonly progressStage: TurnTransitionProgressStage | null;
  readonly startedAt: string;
  readonly state: TurnTransitionState;
  readonly toTurnNumber: number;
  readonly worldId: string;
};
