// Simulation type definitions.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

import type { TierEducationConfig } from "../education/index.ts";
import type { GovernmentType } from "../government/index.ts";
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

export type SimNation = {
  readonly governmentType: GovernmentType;
  readonly id: string;
  readonly name: string;
  readonly taxRate: number;
};

export type SimNationOffice = {
  readonly citizenId: string;
};

export type SimUnitSoldier = {
  readonly citizenId: string;
  readonly homeSettlementId: string | null;
  readonly id: string;
  readonly unitId: string;
};

export type SimUnitType = {
  readonly desertionRate: number;
  readonly id: string;
  readonly upkeepCostsJson: readonly SimTierCostEntry[];
};

export type SimArmy = {
  readonly fundingSource: "nation" | "host_settlement";
  readonly id: string;
  readonly name: string;
  readonly nationId: string;
  readonly stationedSettlementId: string;
};

export type SimArmyUnit = {
  readonly armyId: string;
  readonly id: string;
  readonly unitTypeId: string;
};

export type SimEducationLevel = {
  readonly id: string;
  readonly worldId: string;
  // Deviation from the original spec (which listed id/worldId/rank only):
  // name is needed to compose human-readable graduation notification text
  // ("N citizens completed <name> at the <building>"), so it's included
  // here rather than re-deriving it via an extra lookup table.
  readonly name: string;
  readonly rank: number;
};

export type SimEducationEnrollment = {
  readonly id: string;
  readonly worldId: string;
  readonly settlementBuildingId: string;
  readonly citizenId: string;
  readonly targetLevelId: string;
  readonly progressTurns: number;
  readonly enrolledTurnNumber: number;
};

export type SimNationRelationship = {
  readonly currentStance: string;
  readonly fromNationId: string;
  readonly toNationId: string;
};

// #1094: nation currency state (fiat confidence dynamics, resource-backed
// default checks). currencyType narrows which fields are meaningful:
// backingResourceId/backingRatio are set only for "resource_backed".
export type SimCurrencyType = "fiat" | "resource_backed";

export type SimNationCurrency = {
  readonly backingRatio: number | null;
  readonly backingResourceId: string | null;
  readonly confidence: number;
  readonly currencyType: SimCurrencyType;
  readonly id: string;
  readonly moneySupply: number;
  readonly name: string;
  readonly nationId: string;
  readonly reserveQuantity: number;
};

// #1094: a mint/burn/deposit/redeem row from nation_currency_ledger for the
// turn being processed. Only "mint"/"burn" carry `amount`; the phase sums
// these to derive this turn's minted/burned totals per currency.
export type SimCurrencyLedgerAction = "mint" | "burn" | "deposit" | "redeem";

export type SimCurrencyLedgerEntry = {
  readonly action: SimCurrencyLedgerAction;
  readonly amount: number | null;
  readonly currencyId: string;
};

// #1090: active treaty terms are narrowed to the fields each treaty_type's
// simulation effect needs (tribute payer/resource/quantity, royal_marriage
// citizen pair). trade_agreement and currency_exchange carry no simulation
// effect yet, so their type-specific fields stay null.
export type SimTreatyType = "tribute" | "trade_agreement" | "royal_marriage" | "currency_exchange";

export type SimTreaty = {
  readonly endsTurnNumber: number | null;
  readonly id: string;
  readonly marriageCitizenAId: string | null;
  readonly marriageCitizenBId: string | null;
  readonly proposerNationId: string;
  readonly responderNationId: string;
  readonly treatyType: SimTreatyType;
  readonly tributePayer: "proposer" | "responder" | null;
  readonly tributeQuantityPerTurn: number | null;
  readonly tributeResourceId: string | null;
};

export type SimNationStockpile = {
  readonly nationId: string;
  readonly quantity: number;
  readonly resourceId: string;
};

export type SimSettlement = {
  readonly autoReadyEnabled?: boolean;
  readonly id: string;
  readonly isReadyCurrentTurn?: boolean;
  readonly name: string;
  readonly nationId?: string;
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
  readonly requiredEducationLevelId: string | null;
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
  readonly educationConfigJson: TierEducationConfig | null;
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
  readonly regularOutputsJson: readonly SimPopulationResourceEntry[];
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
  | "building_destroyed"
  | "consumption_multiplier"
  | "deposit_destroyed"
  | "deposit_discovered"
  | "managed_population_change"
  | "population_boost"
  | "population_loss"
  | "production_multiplier"
  | "resource_drain"
  | "resource_grant"
  | "upkeep_multiplier";

export type SimEffect = {
  readonly id: string;
  readonly effectType: EventEffectType;
  readonly amountValue: number | null;
  readonly multiplierValue: number | null;
  readonly isPercent: boolean;
  readonly resourceId: string | null;
  readonly jobId: string | null;
  readonly managedPopulationInstanceId: string | null;
  readonly depositInstanceId: string | null;
  readonly settlementBuildingId: string | null;
  readonly extraDataJsonb?: Record<string, unknown>;
};

export type SimEvent = {
  readonly activateOnTransitionAfterTurnNumber: number;
  readonly durationType: "instant" | "sustained";
  readonly effectPayloadJsonb: Record<string, unknown>;
  readonly effectType: EventEffectType;
  readonly effects: readonly SimEffect[];
  readonly id: string;
  readonly remainingTransitions: number | null;
  readonly scopeNationId?: string | null;
  readonly scopeSettlementId?: string | null;
  readonly scopeType?: "world" | "nation" | "settlement";
  readonly status: SimEventStatus;
};

export type EventStatusPatch = {
  readonly eventId: string;
  readonly fromStatus: SimEventStatus;
  readonly remainingTransitions: number | null;
  readonly toStatus: "active" | "expired";
};

export type SimTradeRouteStatus =
  | "active"
  | "cancelled"
  | "paused"
  | "proposed"
  | "replaced";

export type SimTradeRouteLeg = {
  readonly direction: "receive" | "send";
  readonly quantityPerTransition: number;
  readonly resourceId: string;
};

export type SimTradeRoute = {
  readonly destinationSettlementId: string;
  readonly id: string;
  readonly legs: readonly SimTradeRouteLeg[];
  readonly originSettlementId: string;
  readonly status: SimTradeRouteStatus;
};

export type NpcFlavorConfig = {
  readonly contradictions: readonly string[];
  readonly flaws: readonly string[];
  readonly goals: readonly string[];
  readonly traits: readonly string[];
};

export type SimNamingConfig = {
  readonly convention: string;
  readonly female_given_names: readonly string[];
  readonly male_given_names: readonly string[];
  readonly surnames: readonly string[];
};

export type SimCitizenType = "npc" | "player_character";

export type SimCitizenStatus = "alive" | "dead";

export type SimCitizenRoleType = "none" | "nation_manager" | "settlement_manager";

export type SimCitizen = {
  readonly bornOnTurnNumber: number | null;
  readonly citizenType: SimCitizenType;
  readonly cultureId: string | null;
  readonly educationLevelId: string | null;
  readonly givenName: string;
  readonly id: string;
  readonly namesetId: string | null;
  readonly parentACitizenId: string | null;
  readonly parentBCitizenId: string | null;
  readonly religionId: string | null;
  readonly roleNationId: string | null;
  readonly roleSettlementId: string | null;
  readonly roleType: SimCitizenRoleType;
  readonly settlementId: string | null;
  readonly sex: string | null;
  readonly status: SimCitizenStatus;
  readonly surname: string | null;
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

export type SimResource = {
  readonly decayRate: number;
  readonly id: string;
};

export type SimulationInputState = {
  readonly armies: readonly SimArmy[];
  readonly armyUnits: readonly SimArmyUnit[];
  readonly buildingBlueprints: readonly SimBuildingBlueprint[];
  readonly buildingTiers: readonly SimBuildingTier[];
  readonly calendarConfig: TurnCalendarConfig;
  readonly citizenAssignments: readonly SimCitizenAssignment[];
  readonly citizens: readonly SimCitizen[];
  readonly constructionProjects: readonly SimConstructionProject[];
  readonly depositTypes: readonly SimDepositType[];
  readonly deposits: readonly SimDeposit[];
  readonly educationEnrollments: readonly SimEducationEnrollment[];
  readonly educationLevels: readonly SimEducationLevel[];
  readonly events: readonly SimEvent[];
  readonly isWorldArchived?: boolean;
  readonly jobs: readonly SimJob[];
  readonly managedPopulationTypes: readonly SimManagedPopulationType[];
  readonly managedPopulations: readonly SimManagedPopulation[];
  readonly fallbackNamesetIdBySettlementId?: Readonly<Record<string, string>>;
  readonly namesetConfigById?: Readonly<Record<string, SimNamingConfig>>;
  readonly nationCurrencies: readonly SimNationCurrency[];
  readonly nationCurrencyLedgerEntries: readonly SimCurrencyLedgerEntry[];
  readonly nationOffices: readonly SimNationOffice[];
  readonly nationRelationships: readonly SimNationRelationship[];
  readonly nationResourceStockpiles: readonly SimNationStockpile[];
  readonly nationTreaties: readonly SimTreaty[];
  readonly nations: readonly SimNation[];
  readonly npcFlavorConfig?: NpcFlavorConfig | null;
  readonly partnerships: readonly SimPartnership[];
  readonly populationRules: WorldPopulationRules;
  readonly resources: readonly SimResource[];
  readonly settlementBuildings: readonly SimSettlementBuilding[];
  readonly settlements: readonly SimSettlement[];
  readonly stockpiles: readonly SimStockpile[];
  readonly systemResourceIds: {
    readonly foodId: string;
    readonly freshWaterId: string;
  };
  readonly tradeRoutes: readonly SimTradeRoute[];
  readonly turnNumber: number;
  readonly unitSoldiers: readonly SimUnitSoldier[];
  readonly unitTypes: readonly SimUnitType[];
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
  // Set only by event-driven spawns (e.g. population_boost) that need an age
  // other than newborn; undefined means "born this transition's turn number"
  // (the historical behavior for partnership births).
  readonly bornOnTurnNumber?: number;
  // Null for parentless spawns (no parent to inherit from); partnership
  // births roll 50/50 between parentA/parentB culture, independently for
  // religion (see pickInheritedFieldId).
  readonly cultureId: string | null;
  readonly givenName: string;
  readonly namesetId: string | null;
  readonly npcFlaw: string | null;
  readonly npcGoal: string | null;
  readonly npcSecretContradiction: string | null;
  readonly npcTrait1: string | null;
  readonly npcTrait2: string | null;
  // Null for parentless spawns (e.g. population_boost); partnership births
  // always set both.
  readonly parentACitizenId: string | null;
  readonly parentBCitizenId: string | null;
  readonly religionId: string | null;
  readonly sex: string;
  readonly settlementId: string;
  readonly surname: string | null;
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

export type CitizenEducationPatch = {
  readonly citizenId: string;
  readonly educationLevelId: string;
};

export type EnrollmentProgressUpdate = {
  readonly enrollmentId: string;
  readonly progressTurns: number;
  readonly targetLevelId: string;
};

export type EnrollmentGraduation = {
  readonly enrollmentId: string;
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

export type EducationSummary = {
  // Enrolled student counts by target_level_id, end of turn, this settlement.
  readonly countsByLevelId: Readonly<Record<string, number>>;
  // Citizens who completed a level (advanced or fully graduated) at this
  // settlement this turn.
  readonly graduationsThisTurn: number;
};

export type SettlementSnapshot = {
  readonly aliveNpc: number;
  readonly alivePc: number;
  readonly aliveTotal: number;
  readonly birthCount: number;
  readonly buildingSummary: SettlementSnapshotBuildingStateCounts;
  readonly deathCount: number;
  readonly educationSummary: EducationSummary;
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

export type NationStockpileDelta = {
  readonly delta: number;
  readonly nationId: string;
  readonly resourceId: string;
};

export type NationTurnSnapshot = {
  readonly nationId: string;
  readonly taxCollectedByResource: Readonly<Record<string, number>>;
  readonly tributePaidByResource: Readonly<Record<string, number>>;
  readonly tributeReceivedByResource: Readonly<Record<string, number>>;
};


export type ArmyTurnSnapshot = {
  readonly armyId: string;
  readonly soldierCountTotal: number;
  readonly soldiersByUnitTypeJson: Readonly<Record<string, number>>;
  readonly turnNumber: number;
  readonly upkeepPaid: boolean;
};

export type DesertedSoldier = {
  readonly citizenId: string;
  readonly newSettlementId: string;
  readonly soldierId: string;
  readonly unitId: string;
};

export type DisbandedUnit = {
  readonly armyId: string;
  readonly unitId: string;
};

// #1094: per-turn currency snapshot for history/charting, and the resulting
// confidence (+ default-state) patch to persist back onto nation_currencies.
export type NationCurrencySnapshot = {
  readonly burned: number;
  readonly confidence: number;
  readonly currencyId: string;
  readonly minted: number;
  readonly moneySupply: number;
  readonly nationId: string;
  readonly reserveQuantity: number;
};

export type NationCurrencyUpdate = {
  readonly confidence: number;
  readonly currencyId: string;
  readonly isInDefault: boolean;
};

// #1090: an active treaty's expiry patch — always "expired" in v1 (breaking
// happens via break_nation_treaty, not the simulation).
export type TreatyStatusChange = {
  readonly toStatus: "expired";
  readonly treatyId: string;
};

export type ReadinessSummary = {
  readonly notReadySettlementCount: number;
  readonly readyPercentage: number;
  readonly readySettlementCount: number;
  readonly totalSettlementCount: number;
};

export type SimulationResult = {
  readonly armyTurnSnapshots: readonly ArmyTurnSnapshot[];
  readonly assignmentClears: readonly AssignmentClear[];
  readonly buildingStateChanges: readonly BuildingStateChange[];
  readonly buildingsCreated: readonly BuildingCreated[];
  readonly citizenBirths: readonly CitizenBirth[];
  readonly citizenDeaths: readonly CitizenDeath[];
  readonly citizenEducationPatches: readonly CitizenEducationPatch[];
  readonly citizenPatches: readonly CitizenPatch[];
  readonly constructionUpdates: readonly ConstructionUpdate[];
  readonly depositUpdates: readonly DepositUpdate[];
  readonly desertedSoldiers: readonly DesertedSoldier[];
  readonly disbandedUnits: readonly DisbandedUnit[];
  readonly enrollmentGraduations: readonly EnrollmentGraduation[];
  readonly enrollmentProgressUpdates: readonly EnrollmentProgressUpdate[];
  readonly eventStatusPatches: readonly EventStatusPatch[];
  readonly logEntries: readonly SimulationLogEntry[];
  readonly managedPopulationUpdates: readonly ManagedPopulationUpdate[];
  readonly nationCurrencySnapshots: readonly NationCurrencySnapshot[];
  readonly nationCurrencyUpdates: readonly NationCurrencyUpdate[];
  readonly nationStockpileDeltas: readonly NationStockpileDelta[];
  readonly nationTurnSnapshots: readonly NationTurnSnapshot[];
  readonly notifications: readonly SimulationNotification[];
  readonly partnershipChanges: readonly PartnershipChange[];
  readonly readinessSummary: ReadinessSummary;
  readonly resourceSnapshots: readonly ResourceSnapshot[];
  readonly settlementSnapshots: readonly SettlementSnapshot[];
  readonly stockpileDeltas: readonly StockpileDelta[];
  readonly tradeRouteOutcomes: readonly TradeRouteOutcome[];
  readonly treatyStatusChanges: readonly TreatyStatusChange[];
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
  // Event-triggered multipliers per settlement: production (by job_id or building_id),
  // consumption, upkeep. Applied by phaseStandardJobs, phaseCitizenConsumption,
  // phaseBuildingUpkeep. Maps are always present after initialization.
  readonly pendingEventMultipliers: Map<
    string,
    {
      productionByJobId: Map<string, number>;
      productionByBuildingId: Map<string, number>;
      consumption: number;
      upkeep: number;
      upkeepByBlueprintId: Map<string, number>;
      upkeepByBuildingInstanceId: Map<string, number>;
    }
  >;
  // Managed population ID -> population delta from managed_population_change effects.
  readonly pendingManagedPopulationDeltas: Map<string, number>;
  // Deposit instance IDs to mark as removed due to deposit_destroyed effects.
  readonly pendingDepositDestroys: Set<string>;
  // Running nation resource-stockpile quantities, updated after nation tax
  // credits (phaseNationalEconomy) and treaty tribute transfers (phaseTreaties)
  // so a treaty tributed this turn spends from freshly-taxed goods too.
  readonly pendingNationStockpiles: Map<string, number>;
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
