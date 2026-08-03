export type TurnTransitionState = "running" | "completed" | "failed";

// Progress the background turn worker stamps while the turn runs (#1278):
// either a queue/load/persist stage or the simulation phase currently running
// (#1400). Null before the worker picks the job up and once it finishes.
export type TurnTransitionProgressStage =
  | "building_upkeep"
  | "citizen_consumption"
  | "construction"
  | "deposit_extraction"
  | "education"
  | "events"
  | "homelessness"
  | "loading"
  | "logs_and_snapshots"
  | "managed_populations"
  | "military_upkeep"
  | "national_economy"
  | "partnerships"
  | "passive_effects"
  | "persisting"
  | "queued"
  | "resource_decay"
  | "simulating"
  | "standard_jobs"
  | "stockpile_clamp"
  | "succession"
  | "trade_routes"
  | "treaties"
  | "treaty_marriage_notes";

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
