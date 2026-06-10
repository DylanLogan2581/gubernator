// Orchestrates the full SimulationInputState load from PostgREST.

import {
  getRequiredRuntimeEnv,
  getRequiredRuntimeUrl,
} from "../../_shared/http/env.ts";
import { createErrorResponse } from "../http.ts";

import {
  parseWorldCalendarConfig,
  parseWorldNamingConfig,
  parseWorldNpcFlavorConfig,
} from "./configParsers.ts";
import {
  toBlueprintsAndTiers,
  toDeposits,
  toSimBuilding,
  toSimCitizen,
  toSimCitizenAssignment,
  toSimDepositType,
  toSimEvent,
  toSimJob,
  toSimManagedPop,
  toSimManagedPopType,
  toSimPartnership,
  toSimProject,
  toSimSettlement,
  toSimStockpile,
  toSimTradeRoute,
  toWorldPopulationRules,
} from "./mappers.ts";
import {
  fetchAssignments,
  fetchBlueprints,
  fetchBuildings,
  fetchCitizens,
  fetchDeposits,
  fetchDepositTypes,
  fetchEvents,
  fetchJobs,
  fetchManagedPops,
  fetchManagedPopTypes,
  fetchNamesets,
  fetchPartnerships,
  fetchProjects,
  fetchResources,
  fetchSettlements,
  fetchStockpiles,
  fetchTradeRoutes,
  fetchWorldRow,
} from "./queries.ts";
import {
  isAssignmentRow,
  isBuildingRow,
  isCitizenRow,
  isDepositTypeRow,
  isEventRow,
  isJobRow,
  isManagedPopRow,
  isManagedPopTypeRow,
  isNamesetRow,
  isPartnershipRow,
  isProjectRow,
  isResourceRow,
  isSettlementRow,
  isStockpileRow,
  isTradeRouteRow,
  type SupabaseNamesetRow,
  type SupabaseSettlementRow,
} from "./rowTypes.ts";

import type {
  EndTurnSimulationAuthContext,
  EndTurnSimulationRequestBody,
  EndTurnSimulationStateResult,
} from "../types.ts";
import type { FetchContext, FetchReason } from "./queries.ts";
import type {
  SimNamingConfig,
  SimulationInputState,
} from "../../_shared/simulation/simulationTypes.ts";

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function resolveSupabaseEndTurnSimulationInput(
  requestBody: EndTurnSimulationRequestBody,
  authContext: EndTurnSimulationAuthContext,
): Promise<EndTurnSimulationStateResult> {
  const authorizationHeader = authContext.authorizationHeader;

  if (authorizationHeader === undefined) {
    return createStateUnavailableResult();
  }

  const supabaseUrl = getRequiredRuntimeUrl("SUPABASE_URL");
  const supabaseAnonKey = getRequiredRuntimeEnv("SUPABASE_ANON_KEY");

  if (supabaseUrl === undefined || supabaseAnonKey === undefined) {
    return createStateUnavailableResult();
  }

  const ctx: FetchContext = {
    headers: { apikey: supabaseAnonKey, authorization: authorizationHeader },
    supabaseUrl,
  };

  const worldId = requestBody.worldId;

  // -------------------------------------------------------------------------
  // Round 1: world + settlements (parallel)
  // Settlements fetched first to determine scope (settlementIds) for Round 2.
  // See LOAD_ARCHITECTURE.md for design rationale.
  // -------------------------------------------------------------------------

  const [worldResult, settlementsResult] = await Promise.all([
    fetchWorldRow(ctx, worldId),
    fetchSettlements(ctx, worldId),
  ]);

  if (!worldResult.ok) {
    return stateResultFromFetchError(worldResult.reason);
  }

  if (!settlementsResult.ok) {
    return stateResultFromFetchError(settlementsResult.reason);
  }

  const worldRow = worldResult.row;

  const calendarConfig = parseWorldCalendarConfig(
    worldRow.calendar_config_json,
  );

  if (calendarConfig === null) {
    return {
      error: createErrorResponse({
        code: "end_turn_calendar_config_invalid",
        message: "Calendar configuration is invalid.",
      }),
      ok: false,
      status: 500,
    };
  }

  const settlementRows = settlementsResult.rows.filter(isSettlementRow);
  const settlements = settlementRows.map(toSimSettlement);

  const settlementIds = settlements.map((s) => s.id);

  const populationRules = toWorldPopulationRules(worldRow);
  const namingConfig = parseWorldNamingConfig(worldRow.naming_config_json);
  const npcFlavorConfig = parseWorldNpcFlavorConfig(
    worldRow.npc_flavor_config_json,
  );

  // -------------------------------------------------------------------------
  // Round 2: all 16 entity fetches parallelized via Promise.all (not N+1).
  // DB round-trip count fixed at 2 regardless of entity table size.
  // See LOAD_ARCHITECTURE.md for design rationale.
  // -------------------------------------------------------------------------

  const [
    resourcesResult,
    stockpilesResult,
    jobsResult,
    blueprintsResult,
    buildingsResult,
    projectsResult,
    depositTypesResult,
    depositsResult,
    managedPopTypesResult,
    managedPopsResult,
    tradeRoutesResult,
    citizensResult,
    eventsResult,
    assignmentsResult,
    partnershipsResult,
    namesetsResult,
  ] = await Promise.all([
    fetchResources(ctx, worldId),
    fetchStockpiles(ctx, settlementIds),
    fetchJobs(ctx, worldId),
    fetchBlueprints(ctx, worldId),
    fetchBuildings(ctx, settlementIds),
    fetchProjects(ctx, settlementIds),
    fetchDepositTypes(ctx, worldId),
    fetchDeposits(ctx, settlementIds),
    fetchManagedPopTypes(ctx, worldId),
    fetchManagedPops(ctx, settlementIds),
    fetchTradeRoutes(ctx, worldId),
    fetchCitizens(ctx, worldId),
    fetchEvents(ctx, worldId),
    fetchAssignments(ctx, worldId),
    fetchPartnerships(ctx, worldId),
    fetchNamesets(ctx, worldId),
  ]);

  const round2Results = [
    resourcesResult,
    stockpilesResult,
    jobsResult,
    blueprintsResult,
    buildingsResult,
    projectsResult,
    depositTypesResult,
    depositsResult,
    managedPopTypesResult,
    managedPopsResult,
    tradeRoutesResult,
    citizensResult,
    eventsResult,
    assignmentsResult,
    partnershipsResult,
    namesetsResult,
  ];

  for (const result of round2Results) {
    if (!result.ok) {
      return stateResultFromFetchError(result.reason);
    }
  }

  // -------------------------------------------------------------------------
  // Build per-settlement naming config lookup from namesets
  // -------------------------------------------------------------------------

  const namesetRows = (
    namesetsResult as Extract<typeof namesetsResult, { ok: true }>
  ).rows.filter(isNamesetRow);

  const namingConfigBySettlementId = resolveNamingConfigBySettlement(
    settlementRows,
    namesetRows,
    namingConfig,
  );

  // -------------------------------------------------------------------------
  // Map raw rows → Sim types
  // -------------------------------------------------------------------------

  const systemResources = (
    resourcesResult as Extract<typeof resourcesResult, { ok: true }>
  ).rows.filter(isResourceRow);
  const foodResource = systemResources.find((r) => r.slug === "food");
  const waterResource = systemResources.find((r) => r.slug === "fresh-water");

  if (foodResource === undefined || waterResource === undefined) {
    return createStateUnavailableResult();
  }

  const { buildingBlueprints, buildingTiers } = toBlueprintsAndTiers(
    (blueprintsResult as Extract<typeof blueprintsResult, { ok: true }>).rows,
  );

  const input: SimulationInputState = {
    buildingBlueprints,
    buildingTiers,
    calendarConfig,
    citizenAssignments: (
      assignmentsResult as Extract<typeof assignmentsResult, { ok: true }>
    ).rows
      .filter(isAssignmentRow)
      .map(toSimCitizenAssignment),
    citizens: (
      citizensResult as Extract<typeof citizensResult, { ok: true }>
    ).rows
      .filter(isCitizenRow)
      .map(toSimCitizen),
    constructionProjects: (
      projectsResult as Extract<typeof projectsResult, { ok: true }>
    ).rows
      .filter(isProjectRow)
      .map(toSimProject),
    depositTypes: (
      depositTypesResult as Extract<typeof depositTypesResult, { ok: true }>
    ).rows
      .filter(isDepositTypeRow)
      .map(toSimDepositType),
    deposits: toDeposits(
      (depositsResult as Extract<typeof depositsResult, { ok: true }>).rows,
    ),
    events: (eventsResult as Extract<typeof eventsResult, { ok: true }>).rows
      .filter(isEventRow)
      .map(toSimEvent),
    isWorldArchived: worldRow.status === "archived",
    jobs: (jobsResult as Extract<typeof jobsResult, { ok: true }>).rows
      .filter(isJobRow)
      .map(toSimJob),
    managedPopulationTypes: (
      managedPopTypesResult as Extract<
        typeof managedPopTypesResult,
        { ok: true }
      >
    ).rows
      .filter(isManagedPopTypeRow)
      .map(toSimManagedPopType),
    managedPopulations: (
      managedPopsResult as Extract<typeof managedPopsResult, { ok: true }>
    ).rows
      .filter(isManagedPopRow)
      .map(toSimManagedPop),
    namingConfig,
    namingConfigBySettlementId,
    npcFlavorConfig,
    partnerships: (
      partnershipsResult as Extract<typeof partnershipsResult, { ok: true }>
    ).rows
      .filter(isPartnershipRow)
      .map(toSimPartnership),
    populationRules,
    resources: systemResources.map((r) => ({
      decayRate: r.decay_rate,
      id: r.id,
    })),
    settlementBuildings: (
      buildingsResult as Extract<typeof buildingsResult, { ok: true }>
    ).rows
      .filter(isBuildingRow)
      .map(toSimBuilding),
    settlements,
    stockpiles: (
      stockpilesResult as Extract<typeof stockpilesResult, { ok: true }>
    ).rows
      .filter(isStockpileRow)
      .map(toSimStockpile),
    systemResourceIds: {
      foodId: foodResource.id,
      freshWaterId: waterResource.id,
    },
    tradeRoutes: (
      tradeRoutesResult as Extract<typeof tradeRoutesResult, { ok: true }>
    ).rows
      .filter(isTradeRouteRow)
      .map(toSimTradeRoute),
    turnNumber: worldRow.current_turn_number,
    worldId,
  };

  return { input, ok: true };
}

// ---------------------------------------------------------------------------
// Error helpers
// ---------------------------------------------------------------------------

function createStateUnavailableResult(): EndTurnSimulationStateResult {
  return {
    error: createErrorResponse({
      code: "end_turn_state_unavailable",
      message: "End turn state is unavailable.",
    }),
    ok: false,
    status: 500,
  };
}

// ---------------------------------------------------------------------------
// Per-settlement naming config resolution
// ---------------------------------------------------------------------------

function resolveNamingConfigBySettlement(
  settlementRows: readonly SupabaseSettlementRow[],
  namesetRows: readonly SupabaseNamesetRow[],
  worldFallback: SimNamingConfig | null,
): Record<string, SimNamingConfig> {
  const configById = new Map<string, SimNamingConfig>();
  let defaultConfig: SimNamingConfig | null = null;

  for (const ns of namesetRows) {
    const config = parseWorldNamingConfig(ns.config_json);
    if (config !== null) {
      configById.set(ns.id, config);
      if (ns.is_default) {
        defaultConfig = config;
      }
    }
  }

  const result: Record<string, SimNamingConfig> = {};

  for (const row of settlementRows) {
    const resolved =
      (row.nameset_id !== null ? configById.get(row.nameset_id) : undefined) ??
      (row.nations?.nameset_id !== null && row.nations?.nameset_id !== undefined
        ? configById.get(row.nations.nameset_id)
        : undefined) ??
      defaultConfig ??
      worldFallback;

    if (resolved !== null && resolved !== undefined) {
      result[row.id] = resolved;
    }
  }

  return result;
}

function stateResultFromFetchError(
  reason: FetchReason | "missing_world",
): EndTurnSimulationStateResult {
  if (reason === "missing_world") {
    return {
      error: createErrorResponse({
        code: "end_turn_world_not_found",
        message: "World is unavailable.",
      }),
      ok: false,
      status: 404,
    };
  }

  if (
    typeof reason === "object" &&
    reason.kind === "http_error" &&
    reason.safeDeny
  ) {
    return {
      error: createErrorResponse({
        code: "unauthorized",
        message: "End turn is unavailable for this world.",
      }),
      ok: false,
      status: 403,
    };
  }

  return createStateUnavailableResult();
}
