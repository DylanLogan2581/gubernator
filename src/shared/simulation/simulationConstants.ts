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
  BUILDING_AUTO_DECONSTRUCTED: "building.auto_deconstructed",
  BUILDING_SUSPENDED: "building.suspended",
  CONSTRUCTION_COMPLETED: "construction.completed",
  CONSTRUCTION_PAUSED: "construction.paused",
  DEPOSIT_DEPLETED: "deposit.depleted",
  MANAGED_POPULATION_DECLINING: "managed_population.declining",
  MANAGED_POPULATION_EXTINCT: "managed_population.extinct",
  PARTNERSHIP_FORMED: "partnership.formed",
  PARTNERSHIP_WIDOWED: "partnership.widowed",
  SETTLEMENT_HOMELESSNESS_OCCURRED: "settlement.homelessness_occurred",
  SETTLEMENT_STARVATION_OCCURRED: "settlement.starvation_occurred",
  TRADE_ROUTE_PAUSED: "trade_route.paused",
  TRADE_ROUTE_RESUMED: "trade_route.resumed",
} as const;

export type SimulationNotificationType =
  (typeof SIMULATION_NOTIFICATION_TYPES)[keyof typeof SIMULATION_NOTIFICATION_TYPES];
