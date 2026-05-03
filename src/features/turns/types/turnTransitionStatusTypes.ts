export type TurnTransitionState = "running" | "completed" | "failed";

export type LatestTurnTransitionStatus = {
  readonly finishedAt: string | null;
  readonly fromTurnNumber: number;
  readonly id: string;
  readonly isRunning: boolean;
  readonly startedAt: string;
  readonly state: TurnTransitionState;
  readonly toTurnNumber: number;
  readonly worldId: string;
};
