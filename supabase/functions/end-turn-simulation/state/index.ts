// Orchestrates the full SimulationInputState load from PostgREST.

import { getRequiredRuntimeEnv, getRequiredRuntimeUrl } from "../env.ts";
import { createErrorResponse } from "../http.ts";
import {
  parseWorldCalendarConfig,
  parseWorldNpcFlavorConfig,
} from "../validate.ts";

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
  isPartnershipRow,
  isProjectRow,
  isResourceRow,
  isSettlementRow,
  isStockpileRow,
  isTradeRouteRow,
} from "./rowTypes.ts";

import type {
  EndTurnSimulationAuthContext,
  EndTurnSimulationRequestBody,
  EndTurnSimulationStateResult,
} from "../types.ts";
import type { FetchContext, FetchReason } from "./queries.ts";
import type { SimulationInputState } from "../../_shared/simulation/simulationTypes.ts";

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

  const settlements = settlementsResult.rows
    .filter(isSettlementRow)
    .map(toSimSettlement);

  const settlementIds = settlements.map((s) => s.id);

  const populationRules = toWorldPopulationRules(worldRow);
  const npcFlavorConfig = parseWorldNpcFlavorConfig(
    worldRow.npc_flavor_config_json,
  );

  // -------------------------------------------------------------------------
  // Round 2: all entity fetches in parallel
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
    fetchTradeRoutes(ctx, settlementIds),
    fetchCitizens(ctx, worldId),
    fetchEvents(ctx, worldId),
    fetchAssignments(ctx, worldId),
    fetchPartnerships(ctx, worldId),
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
  ];

  for (const result of round2Results) {
    if (!result.ok) {
      return stateResultFromFetchError(result.reason);
    }
  }

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
    npcFlavorConfig,
    partnerships: (
      partnershipsResult as Extract<typeof partnershipsResult, { ok: true }>
    ).rows
      .filter(isPartnershipRow)
      .map(toSimPartnership),
    populationRules,
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
