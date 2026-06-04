// Simulation type definitions.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

import type { TurnCalendarConfig } from "../turnCalendarPrimitives.ts";

// ---------------------------------------------------------------------------
// Shared log / notification primitives
// ---------------------------------------------------------------------------

export type SimulationLogEntry = {
  readonly category: string;
  readonly citizenId?: string;
  readonly nationId?: string;
  readonly payload: Record<string, unknown>;
  readonly phase: string;
  readonly resourceId?: string;
  readonly settlementId?: string;
};

export type SimulationNotificationScope = "settlement" | "nation" | "world";

export type SimulationNotification = {
  readonly messageText: string;
  readonly nationId?: string;
  readonly notificationType: string;
  readonly scope: SimulationNotificationScope;
  readonly settlementId?: string;
};

// ---------------------------------------------------------------------------
// SimulationInputState — input entity types (prefix "Sim" to distinguish from
// application-layer domain types that carry extra UI / query fields)
// ---------------------------------------------------------------------------

export type WorldPopulationRules = {
  readonly fertilityChance: number;
  readonly foodConsumptionPerCitizen: number;
  readonly homelessnessDecliningRate: number;
  readonly incestPreventionDepth: number;
  readonly maximumFertilityAgeTurns: number | null;
  readonly minimumPartnershipAgeTurns: number;
  readonly mourningPeriodTurns: number;
  readonly partnershipSeekChance: number;
  readonly starvationSeverityMultiplier: number;
  readonly waterConsumptionPerCitizen: number;
};

export type SimSettlement = {
  readonly id: string;
  readonly name: string;
};

export type SimStockpile = {
  readonly cap: number;
  readonly quantity: number;
  readonly resourceId: string;
  readonly settlementId: string;
};

export type SimJobIoEntry = {
  readonly amountPerWorker: number;
  readonly resourceId: string;
};

export type SimJobType =
  | "construction"
  | "culling"
  | "deposit"
  | "husbandry"
  | "standard"
  | "trader";

export type SimJob = {
  readonly baseCapacity: number | null;
  readonly id: string;
  readonly inputsJson: readonly SimJobIoEntry[];
  readonly jobType: SimJobType;
  readonly linkedDepositTypeId: string | null;
  readonly linkedManagedPopulationTypeId: string | null;
  readonly name: string;
  readonly outputsJson: readonly SimJobIoEntry[];
  readonly traderCapacityPerWorker: number | null;
};

export type SimTierCostEntry = {
  readonly amount: number;
  readonly resourceId: string;
};

export type SimTierEffect =
  | {
      readonly amount: number;
      readonly jobId: string;
      readonly type: "job_capacity_increase";
    }
  | {
      readonly amount: number;
      readonly resourceId: string;
      readonly type: "passive_resource_production";
    }
  | {
      readonly amount: number;
      readonly resourceId: string;
      readonly type: "resource_storage_increase";
    }
  | {
      readonly amount: number;
      readonly type: "population_cap_increase";
    };

export type SimBuildingBlueprint = {
  readonly gracePeriodTurns: number;
  readonly id: string;
  readonly maxInstancesPerSettlement: number | null;
  readonly name: string;
};

export type SimBuildingTier = {
  readonly buildingBlueprintId: string;
  readonly constructionCostsJson: readonly SimTierCostEntry[];
  readonly effectsJson: readonly SimTierEffect[];
  readonly id: string;
  readonly tierNumber: number;
  readonly upkeepCostsJson: readonly SimTierCostEntry[];
  readonly workerTurnsRequired: number;
};

export type SimBuildingState =
  | "active"
  | "auto_deconstructed"
  | "manually_deconstructed"
  | "suspended";

export type SimSettlementBuilding = {
  readonly activatedOnTurnNumber: number;
  readonly buildingBlueprintId: string;
  readonly currentTierId: string;
  readonly id: string;
  readonly missedUpkeepCount: number;
  readonly settlementId: string;
  readonly sourceProjectId: string | null;
  readonly state: SimBuildingState;
};

export type SimConstructionStatus =
  | "cancelled"
  | "complete"
  | "in_progress"
  | "paused"
  | "queued";

export type SimConstructionProject = {
  readonly buildingBlueprintId: string;
  readonly id: string;
  readonly progressWorkerTurns: number;
  readonly queuePosition: number;
  readonly settlementId: string;
  readonly status: SimConstructionStatus;
  readonly targetTierId: string;
  readonly workerTurnsRequired: number;
};

export type SimDepositResource = {
  readonly depositInstanceId: string;
  readonly id: string;
  readonly remainingQuantity: number;
  readonly resourceId: string;
};

export type SimDepositStatus = "active" | "depleted" | "removed";

export type SimDeposit = {
  readonly depositTypeId: string;
  readonly id: string;
  readonly maxWorkers: number | null;
  readonly name: string;
  readonly resources: readonly SimDepositResource[];
  readonly settlementId: string;
  readonly status: SimDepositStatus;
};

export type SimWorkerInputEntry = {
  readonly amountPerWorker: number;
  readonly resourceId: string;
};

export type SimDepositType = {
  readonly id: string;
  readonly jobId: string;
  readonly name: string;
  readonly outputUnitsPerWorker: number;
  readonly workerInputsJson: readonly SimWorkerInputEntry[];
};

export type SimPopulationResourceEntry = {
  readonly amountPerNAnimals: number;
  readonly resourceId: string;
};

export type SimManagedPopulationType = {
  readonly cullingJobId: string;
  readonly cullingOutputsJson: readonly SimPopulationResourceEntry[];
  readonly growthRate: number;
  readonly husbandryJobId: string;
  readonly husbandryWorkersPerNAnimals: number;
  readonly id: string;
  readonly maintenanceRulesJson: readonly SimPopulationResourceEntry[];
  readonly name: string;
};

export type SimManagedPopulationStatus = "active" | "extinct";

export type SimManagedPopulation = {
  readonly configuredCullQuantity: number;
  readonly currentCount: number;
  readonly id: string;
  readonly managedPopulationTypeId: string;
  readonly name: string;
  readonly settlementId: string;
  readonly status: SimManagedPopulationStatus;
};

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export type SimEventStatus = "active" | "expired" | "pending" | "resolved";

// Exhaustive union — adding a new value here requires a matching case in the
// phaseEvents switch, which is the Epic 7 hand-off contract.
export type EventEffectType =
  | "deposit_discovered"
  | "population_loss"
  | "resource_grant";

export type SimEvent = {
  readonly activateOnTransitionAfterTurnNumber: number;
  readonly effectPayloadJsonb: Record<string, unknown>;
  readonly effectType: EventEffectType;
  readonly id: string;
  readonly status: SimEventStatus;
};

export type SimTradeRouteStatus =
  | "active"
  | "cancelled"
  | "paused"
  | "proposed"
  | "replaced";

export type SimTradeRoute = {
  readonly destinationSettlementId: string;
  readonly id: string;
  readonly originSettlementId: string;
  readonly quantityPerTransition: number;
  readonly resourceId: string;
  readonly status: SimTradeRouteStatus;
};

export type NpcFlavorConfig = {
  readonly contradictions: readonly string[];
  readonly flaws: readonly string[];
  readonly goals: readonly string[];
  readonly traits: readonly string[];
};

export type SimCitizenType = "npc" | "player_character";

export type SimCitizenStatus = "alive" | "dead";

export type SimCitizen = {
  readonly bornOnTurnNumber: number | null;
  readonly citizenType: SimCitizenType;
  readonly id: string;
  readonly name: string;
  readonly parentACitizenId: string | null;
  readonly parentBCitizenId: string | null;
  readonly settlementId: string | null;
  readonly sex: string | null;
  readonly status: SimCitizenStatus;
};

export type SimAssignmentType =
  | "construction_project"
  | "culling"
  | "deposit"
  | "husbandry"
  | "standard_job"
  | "trade_route";

export type SimCitizenAssignment = {
  readonly assignedOnTurnNumber: number;
  readonly assignmentType: SimAssignmentType;
  readonly citizenId: string;
  readonly constructionProjectId: string | null;
  readonly depositInstanceId: string | null;
  readonly jobId: string | null;
  readonly managedPopulationInstanceId: string | null;
  readonly tradeRouteEnd: string | null;
  readonly tradeRouteId: string | null;
};

export type SimPartnershipStatus = "active" | "dissolved" | "widowed";

export type SimPartnership = {
  readonly citizenAId: string;
  readonly citizenBId: string;
  readonly endedOnTurnNumber: number | null;
  readonly formedOnTurnNumber: number;
  readonly id: string;
  readonly status: SimPartnershipStatus;
};

// Tracks the resource overshoot when a building is manually deconstructed mid-turn
// (i.e., upkeep costs that were partially or fully bypassed). The sim uses this
// ledger to avoid double-charging or incorrectly crediting stockpiles.
export type SimDeconstructOvershootEntry = {
  readonly amount: number;
  readonly resourceId: string;
  readonly settlementBuildingId: string;
};

export type SimulationInputState = {
  readonly buildingBlueprints: readonly SimBuildingBlueprint[];
  readonly buildingTiers: readonly SimBuildingTier[];
  readonly calendarConfig: TurnCalendarConfig;
  readonly citizenAssignments: readonly SimCitizenAssignment[];
  readonly citizens: readonly SimCitizen[];
  readonly constructionProjects: readonly SimConstructionProject[];
  readonly deconstructOvershootLedger: readonly SimDeconstructOvershootEntry[];
  readonly depositTypes: readonly SimDepositType[];
  readonly deposits: readonly SimDeposit[];
  readonly events: readonly SimEvent[];
  readonly isWorldArchived?: boolean;
  readonly jobs: readonly SimJob[];
  readonly managedPopulationTypes: readonly SimManagedPopulationType[];
  readonly managedPopulations: readonly SimManagedPopulation[];
  readonly npcFlavorConfig?: NpcFlavorConfig | null;
  readonly partnerships: readonly SimPartnership[];
  readonly populationRules: WorldPopulationRules;
  readonly settlementBuildings: readonly SimSettlementBuilding[];
  readonly settlementId: string;
  readonly settlements: readonly SimSettlement[];
  readonly stockpiles: readonly SimStockpile[];
  readonly systemResourceIds: {
    readonly foodId: string;
    readonly freshWaterId: string;
  };
  readonly tradeRoutes: readonly SimTradeRoute[];
  readonly turnNumber: number;
  readonly worldId: string;
};

// ---------------------------------------------------------------------------
// SimulationResult — typed patch lists produced by the simulation engine
// ---------------------------------------------------------------------------

export type StockpileDelta = {
  readonly delta: number;
  readonly resourceId: string;
  readonly settlementId: string;
};

export type ConstructionUpdate = {
  readonly progressWorkerTurnsDelta: number;
  readonly projectId: string;
  readonly settlementId: string;
  readonly toStatus: SimConstructionStatus | null;
};

export type BuildingCreated = {
  readonly buildingBlueprintId: string;
  readonly settlementId: string;
  readonly tierId: string;
};

export type BuildingStateChange = {
  readonly missedUpkeepCountDelta: number | null;
  readonly settlementBuildingId: string;
  readonly toState: SimBuildingState;
};

export type DepositResourceDelta = {
  readonly delta: number;
  readonly resourceId: string;
};

export type DepositUpdate = {
  readonly depositInstanceId: string;
  readonly resourceDeltas: readonly DepositResourceDelta[];
  readonly toStatus: SimDepositStatus | null;
};

export type ManagedPopulationUpdate = {
  readonly countDelta: number;
  readonly managedPopulationInstanceId: string;
  readonly toStatus: SimManagedPopulationStatus | null;
};

export type TradeRouteOutcome = {
  readonly delivered: boolean;
  readonly pauseReason: string | null;
  readonly quantityTransferred: number;
  readonly tradeRouteId: string;
};

export type DeathCauseCategory =
  | "event"
  | "homeless"
  | "manual_admin"
  | "starvation"
  | "unknown";

export type CitizenDeath = {
  readonly category: DeathCauseCategory;
  readonly citizenId: string;
  readonly detail: string | null;
};

export type CitizenBirth = {
  readonly npcFlaw: string | null;
  readonly npcGoal: string | null;
  readonly npcSecretContradiction: string | null;
  readonly npcTrait1: string | null;
  readonly npcTrait2: string | null;
  readonly parentACitizenId: string;
  readonly parentBCitizenId: string;
  readonly sex: string;
  readonly settlementId: string;
};

export type CitizenPatch = {
  readonly bornOnTurnNumber: number;
  readonly citizenId: string;
};

export type PartnershipChange =
  | {
      readonly citizenAId: string;
      readonly citizenBId: string;
      readonly type: "formed";
    }
  | {
      readonly partnershipId: string;
      readonly reason: string;
      readonly toStatus: "dissolved" | "widowed";
      readonly type: "status_changed";
    };

export type AssignmentClear = {
  readonly citizenId: string;
  readonly reason: string;
};

export type SettlementSnapshotManagedPopEntry = {
  readonly currentCount: number;
  readonly instanceId: string;
};

export type SettlementSnapshotBuildingStateCounts = {
  readonly active: number;
  readonly auto_deconstructed: number;
  readonly manually_deconstructed: number;
  readonly suspended: number;
};

export type SettlementSnapshotTradeEntry = {
  readonly delivered: boolean;
  readonly quantityTransferred: number;
  readonly tradeRouteId: string;
};

export type SettlementSnapshotWarnings = {
  readonly depletedDepositIds: readonly string[];
  readonly pausedProjectIds: readonly string[];
};

export type SettlementSnapshot = {
  readonly aliveNpc: number;
  readonly alivePc: number;
  readonly aliveTotal: number;
  readonly birthCount: number;
  readonly buildingSummary: SettlementSnapshotBuildingStateCounts;
  readonly deathCount: number;
  readonly homelessDeathsCount: number;
  readonly managedPopulationSummary: readonly SettlementSnapshotManagedPopEntry[];
  readonly partnershipsFormedCount: number;
  readonly populationCap: number;
  readonly settlementId: string;
  readonly starvationDeathsCount: number;
  readonly tradeSummary: readonly SettlementSnapshotTradeEntry[];
  readonly turnNumber: number;
  readonly warnings: SettlementSnapshotWarnings;
};

export type ResourceSnapshot = {
  readonly consumed: number;
  readonly produced: number;
  readonly quantityAfter: number;
  readonly quantityBefore: number;
  readonly resourceId: string;
  readonly settlementId: string;
  readonly tradeIn: number;
  readonly tradeOut: number;
  readonly turnNumber: number;
};

export type ReadinessSummary = {
  readonly notReadySettlementCount: number;
  readonly readyPercentage: number;
  readonly readySettlementCount: number;
  readonly totalSettlementCount: number;
};

export type SimulationResult = {
  readonly assignmentClears: readonly AssignmentClear[];
  readonly buildingStateChanges: readonly BuildingStateChange[];
  readonly buildingsCreated: readonly BuildingCreated[];
  readonly citizenBirths: readonly CitizenBirth[];
  readonly citizenDeaths: readonly CitizenDeath[];
  readonly citizenPatches: readonly CitizenPatch[];
  readonly constructionUpdates: readonly ConstructionUpdate[];
  readonly depositUpdates: readonly DepositUpdate[];
  readonly logEntries: readonly SimulationLogEntry[];
  readonly managedPopulationUpdates: readonly ManagedPopulationUpdate[];
  readonly notifications: readonly SimulationNotification[];
  readonly partnershipChanges: readonly PartnershipChange[];
  readonly readinessSummary: ReadinessSummary;
  readonly resourceSnapshots: readonly ResourceSnapshot[];
  readonly settlementSnapshots: readonly SettlementSnapshot[];
  readonly stockpileDeltas: readonly StockpileDelta[];
  readonly tradeRouteOutcomes: readonly TradeRouteOutcome[];
};

// ---------------------------------------------------------------------------
// SimulationSharedState — mutable running totals updated after each phase
// ---------------------------------------------------------------------------

export type SimulationSharedState = {
  // Running stockpile quantities updated after every phase.
  readonly pendingStockpiles: Map<string, number>;
  // Population cap per settlement, decremented when buildings are suspended
  // or auto-deconstructed in phase 4.
  readonly pendingPopCapBySettlement: Map<string, number>;
  // Citizen IDs that have died in earlier phases this turn (populated after
  // phase 8 so that phase 10 homelessness does not double-count starvation deaths).
  readonly pendingDeaths: Set<string>;
};

// ---------------------------------------------------------------------------
// SimulationContext — passed through every phase
// ---------------------------------------------------------------------------

export type SimulationContext = {
  readonly input: SimulationInputState;
  readonly shared: SimulationSharedState;
};

// ---------------------------------------------------------------------------
// SimulationRejectionError — thrown by runSimulation before any phase runs
// ---------------------------------------------------------------------------

export class SimulationRejectionError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "SimulationRejectionError";
    this.code = code;
  }
}
