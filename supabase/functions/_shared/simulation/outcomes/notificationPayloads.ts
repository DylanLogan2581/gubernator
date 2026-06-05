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
