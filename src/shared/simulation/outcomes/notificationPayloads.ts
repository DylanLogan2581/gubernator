// Typed payload shapes and parsers for simulation notification log entries.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.
//
// Each notification type in the taxonomy has a corresponding payload type and
// parser. Parsers accept `unknown` (the `payloadJsonb` field on a log entry)
// and return the typed payload or `null` on malformed input.

// ---------------------------------------------------------------------------
// building.auto_deconstructed
// ---------------------------------------------------------------------------

export type BuildingAutoDeconstructedPayload = {
  readonly blueprintId: string;
  readonly buildingId: string;
  readonly gracePeriodTurns: number;
  readonly missedUpkeepCount: number;
};

export function parseBuildingAutoDeconstructedPayload(
  payload: unknown,
): BuildingAutoDeconstructedPayload | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.blueprintId !== "string") return null;
  if (typeof p.buildingId !== "string") return null;
  if (typeof p.gracePeriodTurns !== "number") return null;
  if (typeof p.missedUpkeepCount !== "number") return null;
  return {
    blueprintId: p.blueprintId,
    buildingId: p.buildingId,
    gracePeriodTurns: p.gracePeriodTurns,
    missedUpkeepCount: p.missedUpkeepCount,
  };
}

// ---------------------------------------------------------------------------
// building.suspended
// ---------------------------------------------------------------------------

export type BuildingSuspendedPayload = {
  readonly blueprintId: string;
  readonly buildingId: string;
  readonly missedUpkeepCount: number;
};

export function parseBuildingSuspendedPayload(
  payload: unknown,
): BuildingSuspendedPayload | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.blueprintId !== "string") return null;
  if (typeof p.buildingId !== "string") return null;
  if (typeof p.missedUpkeepCount !== "number") return null;
  return {
    blueprintId: p.blueprintId,
    buildingId: p.buildingId,
    missedUpkeepCount: p.missedUpkeepCount,
  };
}

// ---------------------------------------------------------------------------
// construction.completed
// ---------------------------------------------------------------------------

export type ConstructionCompletedPayload = {
  readonly projectId: string;
  readonly workers: number;
};

export function parseConstructionCompletedPayload(
  payload: unknown,
): ConstructionCompletedPayload | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.projectId !== "string") return null;
  if (typeof p.workers !== "number") return null;
  return { projectId: p.projectId, workers: p.workers };
}

// ---------------------------------------------------------------------------
// construction.paused
// ---------------------------------------------------------------------------

export type ConstructionPausedPayload = {
  readonly projectId: string;
  readonly workers: number;
};

export function parseConstructionPausedPayload(
  payload: unknown,
): ConstructionPausedPayload | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.projectId !== "string") return null;
  if (typeof p.workers !== "number") return null;
  return { projectId: p.projectId, workers: p.workers };
}

// ---------------------------------------------------------------------------
// deposit.depleted
// ---------------------------------------------------------------------------

export type DepositDepletedPayload = {
  readonly depositId: string;
  readonly depositName: string;
};

export function parseDepositDepletedPayload(
  payload: unknown,
): DepositDepletedPayload | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.depositId !== "string") return null;
  if (typeof p.depositName !== "string") return null;
  return { depositId: p.depositId, depositName: p.depositName };
}

// ---------------------------------------------------------------------------
// managed_population.declining
// ---------------------------------------------------------------------------

export type ManagedPopulationDecliningPayload = {
  readonly husbandryCoverage: number;
  readonly maintenanceCoverage: number;
  readonly managedPopulationInstanceId: string;
  readonly name: string;
};

export function parseManagedPopulationDecliningPayload(
  payload: unknown,
): ManagedPopulationDecliningPayload | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.husbandryCoverage !== "number") return null;
  if (typeof p.maintenanceCoverage !== "number") return null;
  if (typeof p.managedPopulationInstanceId !== "string") return null;
  if (typeof p.name !== "string") return null;
  return {
    husbandryCoverage: p.husbandryCoverage,
    maintenanceCoverage: p.maintenanceCoverage,
    managedPopulationInstanceId: p.managedPopulationInstanceId,
    name: p.name,
  };
}

// ---------------------------------------------------------------------------
// managed_population.extinct
// ---------------------------------------------------------------------------

export type ManagedPopulationExtinctPayload = {
  readonly managedPopulationInstanceId: string;
  readonly name: string;
};

export function parseManagedPopulationExtinctPayload(
  payload: unknown,
): ManagedPopulationExtinctPayload | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.managedPopulationInstanceId !== "string") return null;
  if (typeof p.name !== "string") return null;
  return {
    managedPopulationInstanceId: p.managedPopulationInstanceId,
    name: p.name,
  };
}

// ---------------------------------------------------------------------------
// partnership.formed
// ---------------------------------------------------------------------------

export type PartnershipFormedPayload = {
  readonly citizenAId: string;
  readonly citizenBId: string;
};

export function parsePartnershipFormedPayload(
  payload: unknown,
): PartnershipFormedPayload | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.citizenAId !== "string") return null;
  if (typeof p.citizenBId !== "string") return null;
  return { citizenAId: p.citizenAId, citizenBId: p.citizenBId };
}

// ---------------------------------------------------------------------------
// partnership.widowed
// ---------------------------------------------------------------------------

export type PartnershipWidowedPayload = {
  readonly partnershipId: string;
  readonly survivingCitizenId: string;
};

export function parsePartnershipWidowedPayload(
  payload: unknown,
): PartnershipWidowedPayload | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.partnershipId !== "string") return null;
  if (typeof p.survivingCitizenId !== "string") return null;
  return {
    partnershipId: p.partnershipId,
    survivingCitizenId: p.survivingCitizenId,
  };
}

// ---------------------------------------------------------------------------
// settlement.starvation_occurred
//
// This notification has no associated structured log payload — individual
// citizen deaths are logged separately as "citizen.starved" entries. The
// parser returns an empty object to maintain a consistent API for all types.
// ---------------------------------------------------------------------------

export type SettlementStarvationOccurredPayload = Record<string, never>;

export function parseSettlementStarvationOccurredPayload(
  payload: unknown,
): SettlementStarvationOccurredPayload | null {
  if (typeof payload !== "object" || payload === null) return null;
  return {};
}

// ---------------------------------------------------------------------------
// settlement.homelessness_occurred
//
// This notification has no associated structured log payload — individual
// citizen deaths are logged separately as "citizen.died_homeless" entries.
// The parser returns an empty object to maintain a consistent API.
// ---------------------------------------------------------------------------

export type SettlementHomelessnessOccurredPayload = Record<string, never>;

export function parseSettlementHomelessnessOccurredPayload(
  payload: unknown,
): SettlementHomelessnessOccurredPayload | null {
  if (typeof payload !== "object" || payload === null) return null;
  return {};
}

// ---------------------------------------------------------------------------
// trade_route.paused
// ---------------------------------------------------------------------------

export type TradeRoutePausedPayload = {
  readonly destinationSettlementId: string;
  readonly pauseReason: string;
  readonly quantityPerTransition: number;
  readonly resourceId: string;
  readonly tradeRouteId: string;
};

export function parseTradeRoutePausedPayload(
  payload: unknown,
): TradeRoutePausedPayload | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.destinationSettlementId !== "string") return null;
  if (typeof p.pauseReason !== "string") return null;
  if (typeof p.quantityPerTransition !== "number") return null;
  if (typeof p.resourceId !== "string") return null;
  if (typeof p.tradeRouteId !== "string") return null;
  return {
    destinationSettlementId: p.destinationSettlementId,
    pauseReason: p.pauseReason,
    quantityPerTransition: p.quantityPerTransition,
    resourceId: p.resourceId,
    tradeRouteId: p.tradeRouteId,
  };
}

// ---------------------------------------------------------------------------
// trade_route.resumed
// ---------------------------------------------------------------------------

export type TradeRouteResumedPayload = {
  readonly destinationSettlementId: string;
  readonly quantityTransferred: number;
  readonly resourceId: string;
  readonly tradeRouteId: string;
};

export function parseTradeRouteResumedPayload(
  payload: unknown,
): TradeRouteResumedPayload | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.destinationSettlementId !== "string") return null;
  if (typeof p.quantityTransferred !== "number") return null;
  if (typeof p.resourceId !== "string") return null;
  if (typeof p.tradeRouteId !== "string") return null;
  return {
    destinationSettlementId: p.destinationSettlementId,
    quantityTransferred: p.quantityTransferred,
    resourceId: p.resourceId,
    tradeRouteId: p.tradeRouteId,
  };
}

// ---------------------------------------------------------------------------
// building.recovered
// ---------------------------------------------------------------------------

export type BuildingRecoveredPayload = {
  readonly blueprintId: string;
  readonly buildingId: string;
};

export function parseBuildingRecoveredPayload(
  payload: unknown,
): BuildingRecoveredPayload | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.blueprintId !== "string") return null;
  if (typeof p.buildingId !== "string") return null;
  return { blueprintId: p.blueprintId, buildingId: p.buildingId };
}

// ---------------------------------------------------------------------------
// citizen.born
// ---------------------------------------------------------------------------

export type CitizenBornPayload = {
  readonly parentACitizenId: string;
  readonly parentBCitizenId: string;
};

export function parseCitizenBornPayload(
  payload: unknown,
): CitizenBornPayload | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.parentACitizenId !== "string") return null;
  if (typeof p.parentBCitizenId !== "string") return null;
  return {
    parentACitizenId: p.parentACitizenId,
    parentBCitizenId: p.parentBCitizenId,
  };
}

// ---------------------------------------------------------------------------
// citizen.consumed_food_water
// ---------------------------------------------------------------------------

export type CitizenConsumedFoodWaterPayload = {
  readonly aliveCount: number;
  readonly foodConsumed: number;
  readonly foodRequired: number;
  readonly foodStock: number;
  readonly settlementId: string;
  readonly waterConsumed: number;
  readonly waterRequired: number;
  readonly waterStock: number;
};

export function parseCitizenConsumedFoodWaterPayload(
  payload: unknown,
): CitizenConsumedFoodWaterPayload | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.aliveCount !== "number") return null;
  if (typeof p.foodConsumed !== "number") return null;
  if (typeof p.foodRequired !== "number") return null;
  if (typeof p.foodStock !== "number") return null;
  if (typeof p.settlementId !== "string") return null;
  if (typeof p.waterConsumed !== "number") return null;
  if (typeof p.waterRequired !== "number") return null;
  if (typeof p.waterStock !== "number") return null;
  return {
    aliveCount: p.aliveCount,
    foodConsumed: p.foodConsumed,
    foodRequired: p.foodRequired,
    foodStock: p.foodStock,
    settlementId: p.settlementId,
    waterConsumed: p.waterConsumed,
    waterRequired: p.waterRequired,
    waterStock: p.waterStock,
  };
}

// ---------------------------------------------------------------------------
// citizen.died_homeless
// ---------------------------------------------------------------------------

export type CitizenDiedHomelessPayload = {
  readonly deathDetail: string;
};

export function parseCitizenDiedHomelessPayload(
  payload: unknown,
): CitizenDiedHomelessPayload | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.deathDetail !== "string") return null;
  return { deathDetail: p.deathDetail };
}

// ---------------------------------------------------------------------------
// citizen.starved
// ---------------------------------------------------------------------------

export type CitizenStarvedPayload = {
  readonly deathDetail: string;
};

export function parseCitizenStarvedPayload(
  payload: unknown,
): CitizenStarvedPayload | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.deathDetail !== "string") return null;
  return { deathDetail: p.deathDetail };
}

// ---------------------------------------------------------------------------
// construction.progress
// ---------------------------------------------------------------------------

export type ConstructionProgressPayload = {
  readonly costsDeducted: Readonly<Record<string, number>>;
  readonly newProgress: number;
  readonly projectId: string;
  readonly settlementId: string;
  readonly workers: number;
  readonly workerTurnsRequired: number;
};

export function parseConstructionProgressPayload(
  payload: unknown,
): ConstructionProgressPayload | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.costsDeducted !== "object" || p.costsDeducted === null)
    return null;
  if (typeof p.newProgress !== "number") return null;
  if (typeof p.projectId !== "string") return null;
  if (typeof p.settlementId !== "string") return null;
  if (typeof p.workers !== "number") return null;
  if (typeof p.workerTurnsRequired !== "number") return null;
  return {
    costsDeducted: p.costsDeducted as Record<string, number>,
    newProgress: p.newProgress,
    projectId: p.projectId,
    settlementId: p.settlementId,
    workers: p.workers,
    workerTurnsRequired: p.workerTurnsRequired,
  };
}

// ---------------------------------------------------------------------------
// deposit.processed
// ---------------------------------------------------------------------------

export type DepositProcessedPayload = {
  readonly depositId: string;
  readonly extractedByResource: Readonly<Record<string, number>>;
  readonly inputShortfallScale: number;
  readonly inputsConsumed: Readonly<Record<string, number>>;
  readonly settlementId: string;
  readonly totalExtraction: number;
  readonly workers: number;
};

export function parseDepositProcessedPayload(
  payload: unknown,
): DepositProcessedPayload | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.depositId !== "string") return null;
  if (
    typeof p.extractedByResource !== "object" ||
    p.extractedByResource === null
  )
    return null;
  if (typeof p.inputShortfallScale !== "number") return null;
  if (typeof p.inputsConsumed !== "object" || p.inputsConsumed === null)
    return null;
  if (typeof p.settlementId !== "string") return null;
  if (typeof p.totalExtraction !== "number") return null;
  if (typeof p.workers !== "number") return null;
  return {
    depositId: p.depositId,
    extractedByResource: p.extractedByResource as Record<string, number>,
    inputShortfallScale: p.inputShortfallScale,
    inputsConsumed: p.inputsConsumed as Record<string, number>,
    settlementId: p.settlementId,
    totalExtraction: p.totalExtraction,
    workers: p.workers,
  };
}

// ---------------------------------------------------------------------------
// event.building_destroyed
// ---------------------------------------------------------------------------

export type EventBuildingDestroyedPayload = {
  readonly eventId: string;
  readonly settlementBuildingId: string;
};

export function parseEventBuildingDestroyedPayload(
  payload: unknown,
): EventBuildingDestroyedPayload | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.eventId !== "string") return null;
  if (typeof p.settlementBuildingId !== "string") return null;
  return {
    eventId: p.eventId,
    settlementBuildingId: p.settlementBuildingId,
  };
}

// ---------------------------------------------------------------------------
// event.consumption_multiplier
// ---------------------------------------------------------------------------

export type EventConsumptionMultiplierPayload = {
  readonly eventId: string;
  readonly multiplier: number;
  readonly settlementId: string;
};

export function parseEventConsumptionMultiplierPayload(
  payload: unknown,
): EventConsumptionMultiplierPayload | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.eventId !== "string") return null;
  if (typeof p.multiplier !== "number") return null;
  if (typeof p.settlementId !== "string") return null;
  return {
    eventId: p.eventId,
    multiplier: p.multiplier,
    settlementId: p.settlementId,
  };
}

// ---------------------------------------------------------------------------
// event.deposit_discovered
// ---------------------------------------------------------------------------

export type EventDepositDiscoveredPayload = {
  readonly eventId: string;
};

export function parseEventDepositDiscoveredPayload(
  payload: unknown,
): EventDepositDiscoveredPayload | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.eventId !== "string") return null;
  return { eventId: p.eventId };
}

// ---------------------------------------------------------------------------
// event.deposit_destroyed
//
// Two shapes depending on whether the event targeted a deposit type
// (destroying all instances of it) or a single deposit instance.
// ---------------------------------------------------------------------------

export type EventDepositDestroyedPayload =
  | {
      readonly depositTypeId: string;
      readonly destroyedCount: number;
      readonly eventId: string;
    }
  | { readonly depositInstanceId: string; readonly eventId: string };

export function parseEventDepositDestroyedPayload(
  payload: unknown,
): EventDepositDestroyedPayload | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.eventId !== "string") return null;
  if (
    typeof p.depositTypeId === "string" &&
    typeof p.destroyedCount === "number"
  ) {
    return {
      depositTypeId: p.depositTypeId,
      destroyedCount: p.destroyedCount,
      eventId: p.eventId,
    };
  }
  if (typeof p.depositInstanceId === "string") {
    return { depositInstanceId: p.depositInstanceId, eventId: p.eventId };
  }
  return null;
}

// ---------------------------------------------------------------------------
// event.managed_population_change
// ---------------------------------------------------------------------------

export type EventManagedPopulationChangePayload = {
  readonly delta: number;
  readonly eventId: string;
  readonly managedPopulationId: string;
};

export function parseEventManagedPopulationChangePayload(
  payload: unknown,
): EventManagedPopulationChangePayload | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.delta !== "number") return null;
  if (typeof p.eventId !== "string") return null;
  if (typeof p.managedPopulationId !== "string") return null;
  return {
    delta: p.delta,
    eventId: p.eventId,
    managedPopulationId: p.managedPopulationId,
  };
}

// ---------------------------------------------------------------------------
// event.population_boost
// ---------------------------------------------------------------------------

export type EventPopulationBoostPayload = {
  readonly amount: number;
  readonly citizenCount: number;
  readonly eventId: string;
  readonly settlementId: string;
};

export function parseEventPopulationBoostPayload(
  payload: unknown,
): EventPopulationBoostPayload | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.amount !== "number") return null;
  if (typeof p.citizenCount !== "number") return null;
  if (typeof p.eventId !== "string") return null;
  if (typeof p.settlementId !== "string") return null;
  return {
    amount: p.amount,
    citizenCount: p.citizenCount,
    eventId: p.eventId,
    settlementId: p.settlementId,
  };
}

// ---------------------------------------------------------------------------
// event.population_loss
// ---------------------------------------------------------------------------

export type EventPopulationLossPayload = {
  readonly amount: number;
  readonly citizenCount: number;
  readonly eventId: string;
  readonly settlementId: string;
};

export function parseEventPopulationLossPayload(
  payload: unknown,
): EventPopulationLossPayload | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.amount !== "number") return null;
  if (typeof p.citizenCount !== "number") return null;
  if (typeof p.eventId !== "string") return null;
  if (typeof p.settlementId !== "string") return null;
  return {
    amount: p.amount,
    citizenCount: p.citizenCount,
    eventId: p.eventId,
    settlementId: p.settlementId,
  };
}

// ---------------------------------------------------------------------------
// event.production_multiplier
// ---------------------------------------------------------------------------

export type EventProductionMultiplierPayload = {
  readonly buildingBlueprintId: string | undefined;
  readonly eventId: string;
  readonly jobId: string | undefined;
  readonly multiplier: number;
  readonly settlementId: string;
};

export function parseEventProductionMultiplierPayload(
  payload: unknown,
): EventProductionMultiplierPayload | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  if (
    p.buildingBlueprintId !== undefined &&
    typeof p.buildingBlueprintId !== "string"
  )
    return null;
  if (typeof p.eventId !== "string") return null;
  if (p.jobId !== undefined && typeof p.jobId !== "string") return null;
  if (typeof p.multiplier !== "number") return null;
  if (typeof p.settlementId !== "string") return null;
  return {
    buildingBlueprintId: p.buildingBlueprintId,
    eventId: p.eventId,
    jobId: p.jobId,
    multiplier: p.multiplier,
    settlementId: p.settlementId,
  };
}

// ---------------------------------------------------------------------------
// event.resource_drain
// ---------------------------------------------------------------------------

export type EventResourceDrainPayload = {
  readonly amount: number;
  readonly eventId: string;
  readonly resourceId: string;
  readonly settlementId: string;
};

export function parseEventResourceDrainPayload(
  payload: unknown,
): EventResourceDrainPayload | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.amount !== "number") return null;
  if (typeof p.eventId !== "string") return null;
  if (typeof p.resourceId !== "string") return null;
  if (typeof p.settlementId !== "string") return null;
  return {
    amount: p.amount,
    eventId: p.eventId,
    resourceId: p.resourceId,
    settlementId: p.settlementId,
  };
}

// ---------------------------------------------------------------------------
// event.resource_grant
// ---------------------------------------------------------------------------

export type EventResourceGrantPayload = {
  readonly amount: number;
  readonly eventId: string;
  readonly resourceId: string;
  readonly settlementId: string;
};

export function parseEventResourceGrantPayload(
  payload: unknown,
): EventResourceGrantPayload | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.amount !== "number") return null;
  if (typeof p.eventId !== "string") return null;
  if (typeof p.resourceId !== "string") return null;
  if (typeof p.settlementId !== "string") return null;
  return {
    amount: p.amount,
    eventId: p.eventId,
    resourceId: p.resourceId,
    settlementId: p.settlementId,
  };
}

// ---------------------------------------------------------------------------
// event.upkeep_multiplier
// ---------------------------------------------------------------------------

export type EventUpkeepMultiplierPayload = {
  readonly eventId: string;
  readonly multiplier: number;
  readonly settlementId: string;
};

export function parseEventUpkeepMultiplierPayload(
  payload: unknown,
): EventUpkeepMultiplierPayload | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.eventId !== "string") return null;
  if (typeof p.multiplier !== "number") return null;
  if (typeof p.settlementId !== "string") return null;
  return {
    eventId: p.eventId,
    multiplier: p.multiplier,
    settlementId: p.settlementId,
  };
}

// ---------------------------------------------------------------------------
// manual_deconstruct_overshoot
//
// Constructed directly in SQL (manual_deconstruct_settlement_building RPC),
// so field names are snake_case unlike the TS-authored payloads above.
// ---------------------------------------------------------------------------

export type ManualDeconstructOvershootPayload = {
  readonly currentCitizens: number;
  readonly newCap: number;
  readonly settlementBuildingId: string;
};

export function parseManualDeconstructOvershootPayload(
  payload: unknown,
): ManualDeconstructOvershootPayload | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.current_citizens !== "number") return null;
  if (typeof p.new_cap !== "number") return null;
  if (typeof p.settlement_building_id !== "string") return null;
  return {
    currentCitizens: p.current_citizens,
    newCap: p.new_cap,
    settlementBuildingId: p.settlement_building_id,
  };
}

// ---------------------------------------------------------------------------
// passive_effect.applied
// ---------------------------------------------------------------------------

export type PassiveEffectAppliedPayload = {
  readonly amount: number;
  readonly buildingId: string;
  readonly resourceId: string;
  readonly settlementId: string;
  readonly tierId: string;
};

export function parsePassiveEffectAppliedPayload(
  payload: unknown,
): PassiveEffectAppliedPayload | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.amount !== "number") return null;
  if (typeof p.buildingId !== "string") return null;
  if (typeof p.resourceId !== "string") return null;
  if (typeof p.settlementId !== "string") return null;
  if (typeof p.tierId !== "string") return null;
  return {
    amount: p.amount,
    buildingId: p.buildingId,
    resourceId: p.resourceId,
    settlementId: p.settlementId,
    tierId: p.tierId,
  };
}

// ---------------------------------------------------------------------------
// stockpile.clamped
// ---------------------------------------------------------------------------

export type StockpileClampedPayload = {
  readonly delta: number;
  readonly effectiveCap: number;
  readonly post: number;
  readonly pre: number;
  readonly reason: "negative" | "over_cap";
  readonly resourceId: string;
  readonly settlementId: string;
};

export function parseStockpileClampedPayload(
  payload: unknown,
): StockpileClampedPayload | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.delta !== "number") return null;
  if (typeof p.effectiveCap !== "number") return null;
  if (typeof p.post !== "number") return null;
  if (typeof p.pre !== "number") return null;
  if (p.reason !== "negative" && p.reason !== "over_cap") return null;
  if (typeof p.resourceId !== "string") return null;
  if (typeof p.settlementId !== "string") return null;
  return {
    delta: p.delta,
    effectiveCap: p.effectiveCap,
    post: p.post,
    pre: p.pre,
    reason: p.reason,
    resourceId: p.resourceId,
    settlementId: p.settlementId,
  };
}

// ---------------------------------------------------------------------------
// stockpile.changed
// ---------------------------------------------------------------------------

export type StockpileChangedPayload = {
  readonly changeAmount: number;
  readonly changeMode: "percent" | "flat";
  readonly delta: number;
  readonly post: number;
  readonly pre: number;
  readonly resourceId: string;
  readonly settlementId: string;
};

export function parseStockpileChangedPayload(
  payload: unknown,
): StockpileChangedPayload | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.changeAmount !== "number") return null;
  if (p.changeMode !== "percent" && p.changeMode !== "flat") return null;
  if (typeof p.delta !== "number") return null;
  if (typeof p.post !== "number") return null;
  if (typeof p.pre !== "number") return null;
  if (typeof p.resourceId !== "string") return null;
  if (typeof p.settlementId !== "string") return null;
  return {
    changeAmount: p.changeAmount,
    changeMode: p.changeMode,
    delta: p.delta,
    post: p.post,
    pre: p.pre,
    resourceId: p.resourceId,
    settlementId: p.settlementId,
  };
}
