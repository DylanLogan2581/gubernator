// Public surface of the src/shared/simulation module.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

export type {
  AssignmentClear,
  BuildingCreated,
  BuildingStateChange,
  CitizenBirth,
  CitizenDeath,
  CitizenPatch,
  ConstructionUpdate,
  DeathCauseCategory,
  DepositResourceDelta,
  DepositUpdate,
  ManagedPopulationUpdate,
  NpcFlavorConfig,
  PartnershipChange,
  ReadinessSummary,
  ResourceSnapshot,
  SettlementSnapshot,
  SimAssignmentType,
  SimBuildingBlueprint,
  SimBuildingState,
  SimBuildingTier,
  SimCitizen,
  SimCitizenAssignment,
  SimCitizenStatus,
  SimCitizenType,
  SimConstructionProject,
  SimConstructionStatus,
  SimDeconstructOvershootEntry,
  SimDeposit,
  SimDepositResource,
  SimDepositStatus,
  SimDepositType,
  SimJob,
  SimJobIoEntry,
  SimJobType,
  SimManagedPopulation,
  SimManagedPopulationStatus,
  SimManagedPopulationType,
  SimPartnership,
  SimPartnershipStatus,
  SimPopulationResourceEntry,
  SimSettlement,
  SimSettlementBuilding,
  SimStockpile,
  SimTierCostEntry,
  SimTierEffect,
  SimTradeRoute,
  SimTradeRouteStatus,
  SimWorkerInputEntry,
  SimulationContext,
  SimulationInputState,
  SimulationLogEntry,
  SimulationNotification,
  SimulationResult,
  StockpileDelta,
  TradeRouteOutcome,
  WorldPopulationRules,
} from "./simulationTypes.ts";

export {
  LOG_CATEGORIES,
  SIMULATION_NOTIFICATION_TYPES,
  SIMULATION_PHASES,
} from "./simulationConstants.ts";
export type {
  LogCategory,
  SimulationNotificationType,
  SimulationPhase,
} from "./simulationConstants.ts";

export {
  addDecimal,
  clampDecimal,
  divideDecimal,
  multiplyDecimal,
  subtractDecimal,
  toDecimal,
} from "./decimalMath.ts";
export type { DecimalValue } from "./decimalMath.ts";

export {
  createSeededRng,
  hashStringToSeed,
  mulberry32,
  pickDeterministic,
} from "./seededRng.ts";
export type { SeededRng } from "./seededRng.ts";

export { runSimulation } from "./runSimulation.ts";

export { phaseStandardJobs } from "./phases/phaseStandardJobs.ts";
export type { PhaseStandardJobsOutput } from "./phases/phaseStandardJobs.ts";

export { phaseDepositExtraction } from "./phases/phaseDepositExtraction.ts";
export type { PhaseDepositExtractionOutput } from "./phases/phaseDepositExtraction.ts";

export { phaseConstruction } from "./phases/phaseConstruction.ts";
export type { PhaseConstructionOutput } from "./phases/phaseConstruction.ts";

export { phaseBuildingUpkeep } from "./phases/phaseBuildingUpkeep.ts";
export type { PhaseBuildingUpkeepOutput } from "./phases/phaseBuildingUpkeep.ts";

export { phasePassiveEffects } from "./phases/phasePassiveEffects.ts";
export type { PhasePassiveEffectsOutput } from "./phases/phasePassiveEffects.ts";

export { phaseTradeRoutes } from "./phases/phaseTradeRoutes.ts";
export type { PhaseTradeRoutesOutput } from "./phases/phaseTradeRoutes.ts";

export { phaseManagedPopulations } from "./phases/phaseManagedPopulations.ts";
export type { PhaseManagedPopulationsOutput } from "./phases/phaseManagedPopulations.ts";

export { phaseCitizenConsumption } from "./phases/phaseCitizenConsumption.ts";
export type { PhaseCitizenConsumptionOutput } from "./phases/phaseCitizenConsumption.ts";

export { phasePartnerships } from "./phases/phasePartnerships.ts";
export type { PhasePartnershipsOutput } from "./phases/phasePartnerships.ts";

export { phaseHomelessness } from "./phases/phaseHomelessness.ts";
export type { PhaseHomelessnessOutput } from "./phases/phaseHomelessness.ts";

export { phaseEvents } from "./phases/phaseEvents.ts";
export type { PhaseEventsOutput } from "./phases/phaseEvents.ts";

export { phaseStockpileClamp } from "./phases/phaseStockpileClamp.ts";
export type { PhaseStockpileClampOutput } from "./phases/phaseStockpileClamp.ts";

export { phaseLogsAndSnapshots } from "./phases/phaseLogsAndSnapshots.ts";
export type { PhaseLogsAndSnapshotsOutput } from "./phases/phaseLogsAndSnapshots.ts";

export { buildSettlementSnapshot } from "./outcomes/settlementSnapshotBuilder.ts";

export { buildResourceSnapshots } from "./outcomes/resourceSnapshotBuilder.ts";

export { buildNotification } from "./outcomes/notificationBuilder.ts";
export type { NotificationBuildInput } from "./outcomes/notificationBuilder.ts";
