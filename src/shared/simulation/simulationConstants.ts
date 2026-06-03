// Simulation constants: phase order, log categories, notification types.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

export const SIMULATION_PHASES = [
  "standardJobs",
  "depositExtraction",
  "construction",
  "buildingUpkeep",
  "passiveEffects",
  "tradeRoutes",
  "managedPopulations",
  "citizenConsumption",
  "partnerships",
  "homelessness",
  "events",
  "stockpileClamp",
  "logsAndSnapshots",
] as const;

export type SimulationPhase = (typeof SIMULATION_PHASES)[number];

export const LOG_CATEGORIES = {
  CONSTRUCTION: "construction",
  DEPOSIT_EXTRACTION: "depositExtraction",
  HOMELESSNESS: "homelessness",
  JOBS: "jobs",
  MANAGED_POPULATIONS: "managedPopulations",
  PARTNERSHIPS: "partnerships",
  PASSIVE_EFFECTS: "passiveEffects",
  RESOURCES: "resources",
  STOCKPILE: "stockpile",
  TRADE_ROUTES: "tradeRoutes",
  UPKEEP: "upkeep",
} as const;

export type LogCategory = (typeof LOG_CATEGORIES)[keyof typeof LOG_CATEGORIES];

export const SIMULATION_NOTIFICATION_TYPES = {
  CONSTRUCTION_COMPLETE: "simulation.construction.complete",
  CONSTRUCTION_PAUSED: "simulation.construction.paused",
  DEPOSIT_DEPLETED: "simulation.deposit.depleted",
  STOCKPILE_CLAMPED: "simulation.stockpile.clamped",
  TURN_SIMULATED: "simulation.turn.simulated",
} as const;

export type SimulationNotificationType =
  (typeof SIMULATION_NOTIFICATION_TYPES)[keyof typeof SIMULATION_NOTIFICATION_TYPES];
