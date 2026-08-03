import type { TurnTransitionProgressStage } from "../types/turnTransitionStatusTypes";

// Player-facing names. These are read by everyone in the world while they are
// blocked, so they describe what is happening in the world rather than naming
// engine internals.
const PHASE_LABELS: Record<TurnTransitionProgressStage, string> = {
  building_upkeep: "Maintaining buildings",
  citizen_consumption: "Feeding citizens",
  construction: "Advancing construction",
  deposit_extraction: "Working deposits",
  education: "Teaching students",
  events: "Resolving events",
  homelessness: "Housing citizens",
  loading: "Loading world state",
  logs_and_snapshots: "Recording history",
  managed_populations: "Tending livestock",
  military_upkeep: "Supplying armies",
  national_economy: "Settling national accounts",
  partnerships: "Forming partnerships",
  passive_effects: "Applying passive effects",
  persisting: "Saving results",
  queued: "Queued",
  resource_decay: "Spoiling resources",
  simulating: "Simulating",
  standard_jobs: "Working jobs",
  stockpile_clamp: "Reconciling stockpiles",
  succession: "Settling succession",
  trade_routes: "Running trade routes",
  treaties: "Honouring treaties",
  treaty_marriage_notes: "Recording marriages",
};

export function getTurnPhaseLabel(
  stage: TurnTransitionProgressStage | null,
): string {
  if (stage === null) {
    return "Advancing the turn";
  }

  return PHASE_LABELS[stage];
}

export function formatElapsed(startedAt: string, now: number): string {
  const elapsedMs = Math.max(0, now - Date.parse(startedAt));
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes.toString()}:${seconds.toString().padStart(2, "0")}`;
}
