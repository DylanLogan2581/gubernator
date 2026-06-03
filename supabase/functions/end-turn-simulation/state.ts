// State loader for the end-turn-simulation edge function.
//
// Fetches the full SimulationInputState for a world using the caller's JWT —
// no service-role key reads.

import { getRequiredRuntimeEnv } from "./env.ts";
import { createErrorResponse } from "./http.ts";
import { isRecord } from "./utils.ts";
import {
  parseWorldCalendarConfig,
  parseWorldNpcFlavorConfig,
} from "./validate.ts";

import type {
  EndTurnSimulationAuthContext,
  EndTurnSimulationRequestBody,
  EndTurnSimulationStateResult,
} from "./types.ts";
import type {
  SimBuildingBlueprint,
  SimBuildingState,
  SimBuildingTier,
  SimCitizen,
  SimCitizenAssignment,
  SimConstructionProject,
  SimDeconstructOvershootEntry,
  SimDeposit,
  SimDepositResource,
  SimDepositType,
  SimEvent,
  SimJob,
  SimJobIoEntry,
  SimManagedPopulation,
  SimManagedPopulationType,
  SimPartnership,
  SimSettlement,
  SimSettlementBuilding,
  SimStockpile,
  SimTierCostEntry,
  SimTierEffect,
  SimTradeRoute,
  SimulationInputState,
  SimWorkerInputEntry,
  SimPopulationResourceEntry,
  WorldPopulationRules,
} from "../../../src/shared/simulation/simulationTypes.ts";

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

  const supabaseUrl = getRequiredRuntimeEnv("SUPABASE_URL");
  const supabaseAnonKey = getRequiredRuntimeEnv("SUPABASE_ANON_KEY");

  if (supabaseUrl === undefined || supabaseAnonKey === undefined) {
    return createStateUnavailableResult();
  }

  const headers = {
    apikey: supabaseAnonKey,
    authorization: authorizationHeader,
  };

  const worldId = requestBody.worldId;

  // -------------------------------------------------------------------------
  // Round 1: world + settlements (parallel)
  // -------------------------------------------------------------------------

  const [worldResult, settlementsResult] = await Promise.all([
    fetchWorldRow({ headers, supabaseUrl, worldId }),
    fetchRows({
      headers,
      supabaseUrl,
      table: "settlements",
      params: {
        "nations.world_id": `eq.${worldId}`,
        order: "id.asc",
        select: "id,name,nations!inner()",
      },
    }),
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

  const settlements: readonly SimSettlement[] = settlementsResult.rows
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

  const inFilter =
    settlementIds.length > 0 ? `in.(${settlementIds.join(",")})` : "in.()";

  const tradeRouteOrFilter =
    settlementIds.length > 0
      ? `(origin_settlement_id.in.(${settlementIds.join(",")}),destination_settlement_id.in.(${settlementIds.join(",")}))`
      : "(origin_settlement_id.in.(),destination_settlement_id.in.())";

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
    overshootResult,
    assignmentsResult,
    partnershipsResult,
  ] = await Promise.all([
    fetchRows({
      headers,
      supabaseUrl,
      table: "resources",
      params: {
        world_id: `eq.${worldId}`,
        is_system_resource: "eq.true",
        select: "id,slug",
      },
    }),
    fetchRows({
      headers,
      supabaseUrl,
      table: "settlement_stockpiles_view",
      params: {
        settlement_id: inFilter,
        select: "settlement_id,resource_id,quantity,effective_cap",
      },
    }),
    fetchRows({
      headers,
      supabaseUrl,
      table: "job_definitions",
      params: {
        world_id: `eq.${worldId}`,
        is_trashed: "eq.false",
        order: "id.asc",
        select:
          "id,name,job_type,base_capacity,trader_capacity_per_worker,linked_deposit_type_id,linked_managed_population_type_id,inputs_json,outputs_json",
      },
    }),
    fetchRows({
      headers,
      supabaseUrl,
      table: "building_blueprints",
      params: {
        world_id: `eq.${worldId}`,
        is_trashed: "eq.false",
        order: "id.asc",
        select:
          "id,name,grace_period_turns,max_instances_per_settlement,building_blueprint_tiers(id,building_blueprint_id,tier_number,worker_turns_required,construction_costs_json,upkeep_costs_json,effects_json)",
      },
    }),
    fetchRows({
      headers,
      supabaseUrl,
      table: "settlement_buildings",
      params: {
        settlement_id: inFilter,
        state: "in.(active,suspended)",
        order: "id.asc",
        select:
          "id,settlement_id,building_blueprint_id,current_tier_id,source_project_id,state,missed_upkeep_count,activated_on_turn_number",
      },
    }),
    fetchRows({
      headers,
      supabaseUrl,
      table: "construction_projects",
      params: {
        settlement_id: inFilter,
        status: "in.(in_progress,queued,paused)",
        order: "queue_position.asc",
        select:
          "id,settlement_id,building_blueprint_id,target_tier_id,status,queue_position,progress_worker_turns,target_tier:building_blueprint_tiers!target_tier_id(worker_turns_required)",
      },
    }),
    fetchRows({
      headers,
      supabaseUrl,
      table: "deposit_types",
      params: {
        world_id: `eq.${worldId}`,
        is_trashed: "eq.false",
        order: "id.asc",
        select: "id,name,job_id,output_units_per_worker,worker_inputs_json",
      },
    }),
    fetchRows({
      headers,
      supabaseUrl,
      table: "deposit_instances",
      params: {
        settlement_id: inFilter,
        status: "eq.active",
        order: "id.asc",
        select:
          "id,settlement_id,deposit_type_id,name,status,max_workers,deposit_instance_resources(id,resource_id,remaining_quantity)",
      },
    }),
    fetchRows({
      headers,
      supabaseUrl,
      table: "managed_population_types",
      params: {
        world_id: `eq.${worldId}`,
        is_trashed: "eq.false",
        order: "id.asc",
        select:
          "id,name,husbandry_job_id,culling_job_id,husbandry_workers_per_n_animals,growth_rate,maintenance_rules_json,culling_outputs_json",
      },
    }),
    fetchRows({
      headers,
      supabaseUrl,
      table: "managed_population_instances",
      params: {
        settlement_id: inFilter,
        status: "eq.active",
        order: "id.asc",
        select:
          "id,settlement_id,managed_population_type_id,name,current_count,configured_cull_quantity,status",
      },
    }),
    fetchRows({
      headers,
      supabaseUrl,
      table: "trade_routes",
      params: {
        or: tradeRouteOrFilter,
        status: "in.(active,paused)",
        order: "id.asc",
        select:
          "id,origin_settlement_id,destination_settlement_id,resource_id,quantity_per_transition,status",
      },
    }),
    fetchRows({
      headers,
      supabaseUrl,
      table: "citizens",
      params: {
        world_id: `eq.${worldId}`,
        status: "eq.alive",
        order: "id.asc",
        select:
          "id,settlement_id,citizen_type,name,sex,status,born_on_turn_number,parent_a_citizen_id,parent_b_citizen_id",
      },
    }),
    fetchRows({
      headers,
      supabaseUrl,
      table: "events",
      params: {
        world_id: `eq.${worldId}`,
        status: "in.(active,pending)",
        order: "id.asc",
        select:
          "id,status,effect_type,activate_on_transition_after_turn_number,effect_payload_jsonb",
      },
    }),
    fetchRows({
      headers,
      supabaseUrl,
      table: "turn_log_entries",
      params: {
        world_id: `eq.${worldId}`,
        log_category: "eq.manual_deconstruct_overshoot",
        turn_transition_id: "is.null",
        order: "id.asc",
        select: "settlement_id,payload_jsonb",
      },
    }),
    fetchRows({
      headers,
      supabaseUrl,
      table: "citizen_assignments",
      params: {
        "citizens.world_id": `eq.${worldId}`,
        order: "citizen_id.asc",
        select:
          "citizen_id,assignment_type,job_id,construction_project_id,deposit_instance_id,managed_population_instance_id,trade_route_id,trade_route_end,assigned_on_turn_number,citizens!inner()",
      },
    }),
    fetchRows({
      headers,
      supabaseUrl,
      table: "partnerships",
      params: {
        "citizens!citizen_a_id.world_id": `eq.${worldId}`,
        order: "id.asc",
        select:
          "id,citizen_a_id,citizen_b_id,status,formed_on_turn_number,ended_on_turn_number,citizens!citizen_a_id!inner()",
      },
    }),
  ]);

  // Check all results
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
    overshootResult,
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

  const rawBlueprints = (
    blueprintsResult as Extract<typeof blueprintsResult, { ok: true }>
  ).rows;
  const buildingBlueprints: SimBuildingBlueprint[] = [];
  const buildingTiers: SimBuildingTier[] = [];

  for (const raw of rawBlueprints) {
    if (!isBlueprintRow(raw)) continue;
    buildingBlueprints.push({
      gracePeriodTurns: raw.grace_period_turns,
      id: raw.id,
      maxInstancesPerSettlement: raw.max_instances_per_settlement,
      name: raw.name,
    });
    for (const tier of raw.building_blueprint_tiers) {
      if (!isTierRow(tier)) continue;
      buildingTiers.push({
        buildingBlueprintId: tier.building_blueprint_id,
        constructionCostsJson: toSimTierCostEntries(
          tier.construction_costs_json,
        ),
        effectsJson: toSimTierEffects(tier.effects_json),
        id: tier.id,
        tierNumber: tier.tier_number,
        upkeepCostsJson: toSimTierCostEntries(tier.upkeep_costs_json),
        workerTurnsRequired: tier.worker_turns_required,
      });
    }
  }

  const rawProjects = (
    projectsResult as Extract<typeof projectsResult, { ok: true }>
  ).rows;
  const constructionProjects: SimConstructionProject[] = rawProjects
    .filter(isProjectRow)
    .map((raw) => ({
      buildingBlueprintId: raw.building_blueprint_id,
      id: raw.id,
      progressWorkerTurns: raw.progress_worker_turns,
      queuePosition: raw.queue_position,
      settlementId: raw.settlement_id,
      status: raw.status as SimConstructionProject["status"],
      targetTierId: raw.target_tier_id,
      workerTurnsRequired: raw.target_tier?.worker_turns_required ?? 0,
    }));

  const rawDeposits = (
    depositsResult as Extract<typeof depositsResult, { ok: true }>
  ).rows;
  const deposits: SimDeposit[] = rawDeposits
    .filter(isDepositRow)
    .map((raw) => ({
      depositTypeId: raw.deposit_type_id,
      id: raw.id,
      maxWorkers: raw.max_workers,
      name: raw.name,
      resources: raw.deposit_instance_resources
        .filter(isDepositResourceRow)
        .map(
          (r): SimDepositResource => ({
            depositInstanceId: raw.id,
            id: r.id,
            remainingQuantity: r.remaining_quantity,
            resourceId: r.resource_id,
          }),
        ),
      settlementId: raw.settlement_id,
      status: raw.status as SimDeposit["status"],
    }));

  const rawOvershoot = (
    overshootResult as Extract<typeof overshootResult, { ok: true }>
  ).rows;
  const deconstructOvershootLedger: SimDeconstructOvershootEntry[] =
    rawOvershoot
      .filter(isOvershootRow)
      .flatMap((row) => toDeconstructOvershootEntries(row));

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
    constructionProjects,
    deconstructOvershootLedger,
    depositTypes: (
      depositTypesResult as Extract<typeof depositTypesResult, { ok: true }>
    ).rows
      .filter(isDepositTypeRow)
      .map(toSimDepositType),
    deposits,
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
    settlementId: worldId,
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
// Generic fetch helper
// ---------------------------------------------------------------------------

type FetchReason =
  | "fetch_failed"
  | { readonly kind: "http_error"; readonly safeDeny: boolean }
  | "invalid_payload";

type FetchRowsResult =
  | { readonly ok: true; readonly rows: readonly unknown[] }
  | { readonly ok: false; readonly reason: FetchReason };

async function fetchRows({
  headers,
  params,
  supabaseUrl,
  table,
}: {
  readonly headers: { readonly apikey: string; readonly authorization: string };
  readonly params: Record<string, string>;
  readonly supabaseUrl: string;
  readonly table: string;
}): Promise<FetchRowsResult> {
  const searchParams = new URLSearchParams(params);
  let response: Response;

  try {
    response = await fetch(`${supabaseUrl}/rest/v1/${table}?${searchParams}`, {
      headers,
      method: "GET",
    });
  } catch {
    return { ok: false, reason: "fetch_failed" };
  }

  if (!response.ok) {
    return {
      ok: false,
      reason: {
        kind: "http_error",
        safeDeny: response.status >= 400 && response.status < 500,
      },
    };
  }

  const payload: unknown = await response.json();

  if (!Array.isArray(payload)) {
    return { ok: false, reason: "invalid_payload" };
  }

  return { ok: true, rows: payload };
}

// ---------------------------------------------------------------------------
// World row fetch (returns single row)
// ---------------------------------------------------------------------------

type WorldFetchResult =
  | { readonly ok: true; readonly row: SupabaseWorldRow }
  | { readonly ok: false; readonly reason: FetchReason | "missing_world" };

async function fetchWorldRow({
  headers,
  supabaseUrl,
  worldId,
}: {
  readonly headers: { readonly apikey: string; readonly authorization: string };
  readonly supabaseUrl: string;
  readonly worldId: string;
}): Promise<WorldFetchResult> {
  const searchParams = new URLSearchParams({
    id: `eq.${worldId}`,
    limit: "1",
    select: [
      "id",
      "status",
      "current_turn_number",
      "calendar_config_json",
      "npc_flavor_config_json",
      "partnership_seek_chance",
      "fertility_chance",
      "minimum_partnership_age_turns",
      "maximum_fertility_age_turns",
      "mourning_period_turns",
      "homelessness_decline_rate",
      "starvation_severity_multiplier",
      "food_consumption_per_citizen",
      "water_consumption_per_citizen",
      "incest_prevention_depth",
    ].join(","),
  });

  let response: Response;

  try {
    response = await fetch(`${supabaseUrl}/rest/v1/worlds?${searchParams}`, {
      headers,
      method: "GET",
    });
  } catch {
    return { ok: false, reason: "fetch_failed" };
  }

  if (!response.ok) {
    return {
      ok: false,
      reason: {
        kind: "http_error",
        safeDeny: response.status >= 400 && response.status < 500,
      },
    };
  }

  const payload: unknown = await response.json();

  if (!Array.isArray(payload)) {
    return { ok: false, reason: "invalid_payload" };
  }

  const row: unknown = payload[0];

  if (row === undefined) {
    return { ok: false, reason: "missing_world" };
  }

  if (!isWorldRow(row)) {
    return { ok: false, reason: "invalid_payload" };
  }

  return { ok: true, row };
}

// ---------------------------------------------------------------------------
// Raw row types
// ---------------------------------------------------------------------------

type SupabaseWorldRow = {
  readonly id: string;
  readonly status: "active" | "archived";
  readonly current_turn_number: number;
  readonly calendar_config_json: unknown;
  readonly npc_flavor_config_json: unknown;
  readonly partnership_seek_chance: number;
  readonly fertility_chance: number;
  readonly minimum_partnership_age_turns: number;
  readonly maximum_fertility_age_turns: number | null;
  readonly mourning_period_turns: number;
  readonly homelessness_decline_rate: number;
  readonly starvation_severity_multiplier: number;
  readonly food_consumption_per_citizen: number;
  readonly water_consumption_per_citizen: number;
  readonly incest_prevention_depth: number;
};

type SupabaseSettlementRow = {
  readonly id: string;
  readonly name: string;
};

type SupabaseResourceRow = {
  readonly id: string;
  readonly slug: string;
};

type SupabaseStockpileRow = {
  readonly settlement_id: string;
  readonly resource_id: string;
  readonly quantity: number;
  readonly effective_cap: number;
};

type SupabaseJobRow = {
  readonly id: string;
  readonly name: string;
  readonly job_type: string;
  readonly base_capacity: number | null;
  readonly trader_capacity_per_worker: number | null;
  readonly linked_deposit_type_id: string | null;
  readonly linked_managed_population_type_id: string | null;
  readonly inputs_json: unknown;
  readonly outputs_json: unknown;
};

type SupabaseTierRow = {
  readonly id: string;
  readonly building_blueprint_id: string;
  readonly tier_number: number;
  readonly worker_turns_required: number;
  readonly construction_costs_json: unknown;
  readonly upkeep_costs_json: unknown;
  readonly effects_json: unknown;
};

type SupabaseBlueprintRow = {
  readonly id: string;
  readonly name: string;
  readonly grace_period_turns: number;
  readonly max_instances_per_settlement: number | null;
  readonly building_blueprint_tiers: readonly unknown[];
};

type SupabaseBuildingRow = {
  readonly id: string;
  readonly settlement_id: string;
  readonly building_blueprint_id: string;
  readonly current_tier_id: string;
  readonly source_project_id: string | null;
  readonly state: string;
  readonly missed_upkeep_count: number;
  readonly activated_on_turn_number: number;
};

type SupabaseProjectRow = {
  readonly id: string;
  readonly settlement_id: string;
  readonly building_blueprint_id: string;
  readonly target_tier_id: string;
  readonly status: string;
  readonly queue_position: number;
  readonly progress_worker_turns: number;
  readonly target_tier: { readonly worker_turns_required: number } | null;
};

type SupabaseDepositTypeRow = {
  readonly id: string;
  readonly name: string;
  readonly job_id: string;
  readonly output_units_per_worker: number;
  readonly worker_inputs_json: unknown;
};

type SupabaseDepositResourceRow = {
  readonly id: string;
  readonly resource_id: string;
  readonly remaining_quantity: number;
};

type SupabaseDepositRow = {
  readonly id: string;
  readonly settlement_id: string;
  readonly deposit_type_id: string;
  readonly name: string;
  readonly status: string;
  readonly max_workers: number | null;
  readonly deposit_instance_resources: readonly unknown[];
};

type SupabaseManagedPopTypeRow = {
  readonly id: string;
  readonly name: string;
  readonly husbandry_job_id: string;
  readonly culling_job_id: string;
  readonly husbandry_workers_per_n_animals: number;
  readonly growth_rate: number;
  readonly maintenance_rules_json: unknown;
  readonly culling_outputs_json: unknown;
};

type SupabaseManagedPopRow = {
  readonly id: string;
  readonly settlement_id: string;
  readonly managed_population_type_id: string;
  readonly name: string;
  readonly current_count: number;
  readonly configured_cull_quantity: number;
  readonly status: string;
};

type SupabaseTradeRouteRow = {
  readonly id: string;
  readonly origin_settlement_id: string;
  readonly destination_settlement_id: string;
  readonly resource_id: string;
  readonly quantity_per_transition: number;
  readonly status: string;
};

type SupabaseCitizenRow = {
  readonly id: string;
  readonly settlement_id: string | null;
  readonly citizen_type: string;
  readonly name: string;
  readonly sex: string | null;
  readonly status: string;
  readonly born_on_turn_number: number | null;
  readonly parent_a_citizen_id: string | null;
  readonly parent_b_citizen_id: string | null;
};

type SupabaseAssignmentRow = {
  readonly citizen_id: string;
  readonly assignment_type: string;
  readonly job_id: string | null;
  readonly construction_project_id: string | null;
  readonly deposit_instance_id: string | null;
  readonly managed_population_instance_id: string | null;
  readonly trade_route_id: string | null;
  readonly trade_route_end: string | null;
  readonly assigned_on_turn_number: number;
};

type SupabasePartnershipRow = {
  readonly id: string;
  readonly citizen_a_id: string;
  readonly citizen_b_id: string;
  readonly status: string;
  readonly formed_on_turn_number: number;
  readonly ended_on_turn_number: number | null;
};

type SupabaseEventRow = {
  readonly id: string;
  readonly status: string;
  readonly effect_type: string;
  readonly activate_on_transition_after_turn_number: number;
  readonly effect_payload_jsonb: unknown;
};

type SupabaseOvershootRow = {
  readonly settlement_id: string | null;
  readonly payload_jsonb: unknown;
};

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

function isWorldRow(v: unknown): v is SupabaseWorldRow {
  if (!isRecord(v)) return false;
  return (
    typeof v.id === "string" &&
    (v.status === "active" || v.status === "archived") &&
    typeof v.current_turn_number === "number" &&
    typeof v.partnership_seek_chance === "number" &&
    typeof v.fertility_chance === "number" &&
    typeof v.minimum_partnership_age_turns === "number" &&
    (v.maximum_fertility_age_turns === null ||
      typeof v.maximum_fertility_age_turns === "number") &&
    typeof v.mourning_period_turns === "number" &&
    typeof v.homelessness_decline_rate === "number" &&
    typeof v.starvation_severity_multiplier === "number" &&
    typeof v.food_consumption_per_citizen === "number" &&
    typeof v.water_consumption_per_citizen === "number" &&
    typeof v.incest_prevention_depth === "number"
  );
}

function isSettlementRow(v: unknown): v is SupabaseSettlementRow {
  return isRecord(v) && typeof v.id === "string" && typeof v.name === "string";
}

function isResourceRow(v: unknown): v is SupabaseResourceRow {
  return isRecord(v) && typeof v.id === "string" && typeof v.slug === "string";
}

function isStockpileRow(v: unknown): v is SupabaseStockpileRow {
  return (
    isRecord(v) &&
    typeof v.settlement_id === "string" &&
    typeof v.resource_id === "string" &&
    typeof v.quantity === "number" &&
    typeof v.effective_cap === "number"
  );
}

function isJobRow(v: unknown): v is SupabaseJobRow {
  return (
    isRecord(v) &&
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    typeof v.job_type === "string" &&
    (v.base_capacity === null || typeof v.base_capacity === "number") &&
    (v.trader_capacity_per_worker === null ||
      typeof v.trader_capacity_per_worker === "number") &&
    (v.linked_deposit_type_id === null ||
      typeof v.linked_deposit_type_id === "string") &&
    (v.linked_managed_population_type_id === null ||
      typeof v.linked_managed_population_type_id === "string")
  );
}

function isTierRow(v: unknown): v is SupabaseTierRow {
  return (
    isRecord(v) &&
    typeof v.id === "string" &&
    typeof v.building_blueprint_id === "string" &&
    typeof v.tier_number === "number" &&
    typeof v.worker_turns_required === "number"
  );
}

function isBlueprintRow(v: unknown): v is SupabaseBlueprintRow {
  return (
    isRecord(v) &&
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    typeof v.grace_period_turns === "number" &&
    (v.max_instances_per_settlement === null ||
      typeof v.max_instances_per_settlement === "number") &&
    Array.isArray(v.building_blueprint_tiers)
  );
}

function isBuildingRow(v: unknown): v is SupabaseBuildingRow {
  return (
    isRecord(v) &&
    typeof v.id === "string" &&
    typeof v.settlement_id === "string" &&
    typeof v.building_blueprint_id === "string" &&
    typeof v.current_tier_id === "string" &&
    (v.source_project_id === null || typeof v.source_project_id === "string") &&
    typeof v.state === "string" &&
    typeof v.missed_upkeep_count === "number" &&
    typeof v.activated_on_turn_number === "number"
  );
}

function isProjectRow(v: unknown): v is SupabaseProjectRow {
  return (
    isRecord(v) &&
    typeof v.id === "string" &&
    typeof v.settlement_id === "string" &&
    typeof v.building_blueprint_id === "string" &&
    typeof v.target_tier_id === "string" &&
    typeof v.status === "string" &&
    typeof v.queue_position === "number" &&
    typeof v.progress_worker_turns === "number" &&
    (v.target_tier === null ||
      (isRecord(v.target_tier) &&
        typeof v.target_tier.worker_turns_required === "number"))
  );
}

function isDepositTypeRow(v: unknown): v is SupabaseDepositTypeRow {
  return (
    isRecord(v) &&
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    typeof v.job_id === "string" &&
    typeof v.output_units_per_worker === "number"
  );
}

function isDepositResourceRow(v: unknown): v is SupabaseDepositResourceRow {
  return (
    isRecord(v) &&
    typeof v.id === "string" &&
    typeof v.resource_id === "string" &&
    typeof v.remaining_quantity === "number"
  );
}

function isDepositRow(v: unknown): v is SupabaseDepositRow {
  return (
    isRecord(v) &&
    typeof v.id === "string" &&
    typeof v.settlement_id === "string" &&
    typeof v.deposit_type_id === "string" &&
    typeof v.name === "string" &&
    typeof v.status === "string" &&
    (v.max_workers === null || typeof v.max_workers === "number") &&
    Array.isArray(v.deposit_instance_resources)
  );
}

function isManagedPopTypeRow(v: unknown): v is SupabaseManagedPopTypeRow {
  return (
    isRecord(v) &&
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    typeof v.husbandry_job_id === "string" &&
    typeof v.culling_job_id === "string" &&
    typeof v.husbandry_workers_per_n_animals === "number" &&
    typeof v.growth_rate === "number"
  );
}

function isManagedPopRow(v: unknown): v is SupabaseManagedPopRow {
  return (
    isRecord(v) &&
    typeof v.id === "string" &&
    typeof v.settlement_id === "string" &&
    typeof v.managed_population_type_id === "string" &&
    typeof v.name === "string" &&
    typeof v.current_count === "number" &&
    typeof v.configured_cull_quantity === "number" &&
    typeof v.status === "string"
  );
}

function isTradeRouteRow(v: unknown): v is SupabaseTradeRouteRow {
  return (
    isRecord(v) &&
    typeof v.id === "string" &&
    typeof v.origin_settlement_id === "string" &&
    typeof v.destination_settlement_id === "string" &&
    typeof v.resource_id === "string" &&
    typeof v.quantity_per_transition === "number" &&
    typeof v.status === "string"
  );
}

function isCitizenRow(v: unknown): v is SupabaseCitizenRow {
  return (
    isRecord(v) &&
    typeof v.id === "string" &&
    (v.settlement_id === null || typeof v.settlement_id === "string") &&
    typeof v.citizen_type === "string" &&
    typeof v.name === "string" &&
    (v.sex === null || typeof v.sex === "string") &&
    typeof v.status === "string" &&
    (v.born_on_turn_number === null ||
      typeof v.born_on_turn_number === "number") &&
    (v.parent_a_citizen_id === null ||
      typeof v.parent_a_citizen_id === "string") &&
    (v.parent_b_citizen_id === null ||
      typeof v.parent_b_citizen_id === "string")
  );
}

function isAssignmentRow(v: unknown): v is SupabaseAssignmentRow {
  return (
    isRecord(v) &&
    typeof v.citizen_id === "string" &&
    typeof v.assignment_type === "string" &&
    (v.job_id === null || typeof v.job_id === "string") &&
    (v.construction_project_id === null ||
      typeof v.construction_project_id === "string") &&
    (v.deposit_instance_id === null ||
      typeof v.deposit_instance_id === "string") &&
    (v.managed_population_instance_id === null ||
      typeof v.managed_population_instance_id === "string") &&
    (v.trade_route_id === null || typeof v.trade_route_id === "string") &&
    (v.trade_route_end === null || typeof v.trade_route_end === "string") &&
    typeof v.assigned_on_turn_number === "number"
  );
}

function isPartnershipRow(v: unknown): v is SupabasePartnershipRow {
  return (
    isRecord(v) &&
    typeof v.id === "string" &&
    typeof v.citizen_a_id === "string" &&
    typeof v.citizen_b_id === "string" &&
    typeof v.status === "string" &&
    typeof v.formed_on_turn_number === "number" &&
    (v.ended_on_turn_number === null ||
      typeof v.ended_on_turn_number === "number")
  );
}

function isEventRow(v: unknown): v is SupabaseEventRow {
  return (
    isRecord(v) &&
    typeof v.id === "string" &&
    typeof v.status === "string" &&
    typeof v.effect_type === "string" &&
    typeof v.activate_on_transition_after_turn_number === "number"
  );
}

function isOvershootRow(v: unknown): v is SupabaseOvershootRow {
  return (
    isRecord(v) &&
    (v.settlement_id === null || typeof v.settlement_id === "string")
  );
}

// ---------------------------------------------------------------------------
// JSONB array transformers (snake_case DB keys → camelCase Sim types)
// ---------------------------------------------------------------------------

function toSimJobIoEntries(raw: unknown): readonly SimJobIoEntry[] {
  if (!Array.isArray(raw)) return [];
  const result: SimJobIoEntry[] = [];
  for (const item of raw) {
    if (
      isRecord(item) &&
      typeof item.resource_id === "string" &&
      typeof item.amount_per_worker === "number"
    ) {
      result.push({
        amountPerWorker: item.amount_per_worker,
        resourceId: item.resource_id,
      });
    }
  }
  return result;
}

function toSimTierCostEntries(raw: unknown): readonly SimTierCostEntry[] {
  if (!Array.isArray(raw)) return [];
  const result: SimTierCostEntry[] = [];
  for (const item of raw) {
    if (
      isRecord(item) &&
      typeof item.resource_id === "string" &&
      typeof item.amount === "number"
    ) {
      result.push({ amount: item.amount, resourceId: item.resource_id });
    }
  }
  return result;
}

function toSimTierEffects(raw: unknown): readonly SimTierEffect[] {
  if (!Array.isArray(raw)) return [];
  const result: SimTierEffect[] = [];
  for (const item of raw) {
    if (
      !isRecord(item) ||
      typeof item.type !== "string" ||
      typeof item.amount !== "number"
    ) {
      continue;
    }
    const { type, amount } = item;
    if (type === "job_capacity_increase" && typeof item.job_id === "string") {
      result.push({ amount, jobId: item.job_id, type });
    } else if (
      type === "passive_resource_production" &&
      typeof item.resource_id === "string"
    ) {
      result.push({ amount, resourceId: item.resource_id, type });
    } else if (
      type === "resource_storage_increase" &&
      typeof item.resource_id === "string"
    ) {
      result.push({ amount, resourceId: item.resource_id, type });
    } else if (type === "population_cap_increase") {
      result.push({ amount, type });
    }
  }
  return result;
}

function toSimWorkerInputEntries(raw: unknown): readonly SimWorkerInputEntry[] {
  if (!Array.isArray(raw)) return [];
  const result: SimWorkerInputEntry[] = [];
  for (const item of raw) {
    if (
      isRecord(item) &&
      typeof item.resource_id === "string" &&
      typeof item.amount_per_worker === "number"
    ) {
      result.push({
        amountPerWorker: item.amount_per_worker,
        resourceId: item.resource_id,
      });
    }
  }
  return result;
}

function toSimPopResourceEntries(
  raw: unknown,
): readonly SimPopulationResourceEntry[] {
  if (!Array.isArray(raw)) return [];
  const result: SimPopulationResourceEntry[] = [];
  for (const item of raw) {
    if (
      isRecord(item) &&
      typeof item.resource_id === "string" &&
      typeof item.amount_per_n_animals === "number"
    ) {
      result.push({
        amountPerNAnimals: item.amount_per_n_animals,
        resourceId: item.resource_id,
      });
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Row → Sim type mappers
// ---------------------------------------------------------------------------

function toSimSettlement(row: SupabaseSettlementRow): SimSettlement {
  return { id: row.id, name: row.name };
}

function toSimStockpile(row: SupabaseStockpileRow): SimStockpile {
  return {
    cap: row.effective_cap,
    quantity: row.quantity,
    resourceId: row.resource_id,
    settlementId: row.settlement_id,
  };
}

function toSimJob(row: SupabaseJobRow): SimJob {
  return {
    baseCapacity: row.base_capacity,
    id: row.id,
    inputsJson: toSimJobIoEntries(row.inputs_json),
    jobType: row.job_type as SimJob["jobType"],
    linkedDepositTypeId: row.linked_deposit_type_id,
    linkedManagedPopulationTypeId: row.linked_managed_population_type_id,
    name: row.name,
    outputsJson: toSimJobIoEntries(row.outputs_json),
    traderCapacityPerWorker: row.trader_capacity_per_worker,
  };
}

function toSimBuilding(row: SupabaseBuildingRow): SimSettlementBuilding {
  return {
    activatedOnTurnNumber: row.activated_on_turn_number,
    buildingBlueprintId: row.building_blueprint_id,
    currentTierId: row.current_tier_id,
    id: row.id,
    missedUpkeepCount: row.missed_upkeep_count,
    settlementId: row.settlement_id,
    sourceProjectId: row.source_project_id,
    state: row.state as SimBuildingState,
  };
}

function toSimDepositType(row: SupabaseDepositTypeRow): SimDepositType {
  return {
    id: row.id,
    jobId: row.job_id,
    name: row.name,
    outputUnitsPerWorker: row.output_units_per_worker,
    workerInputsJson: toSimWorkerInputEntries(row.worker_inputs_json),
  };
}

function toSimManagedPopType(
  row: SupabaseManagedPopTypeRow,
): SimManagedPopulationType {
  return {
    cullingJobId: row.culling_job_id,
    cullingOutputsJson: toSimPopResourceEntries(row.culling_outputs_json),
    growthRate: row.growth_rate,
    husbandryJobId: row.husbandry_job_id,
    husbandryWorkersPerNAnimals: row.husbandry_workers_per_n_animals,
    id: row.id,
    maintenanceRulesJson: toSimPopResourceEntries(row.maintenance_rules_json),
    name: row.name,
  };
}

function toSimManagedPop(row: SupabaseManagedPopRow): SimManagedPopulation {
  return {
    configuredCullQuantity: row.configured_cull_quantity,
    currentCount: row.current_count,
    id: row.id,
    managedPopulationTypeId: row.managed_population_type_id,
    name: row.name,
    settlementId: row.settlement_id,
    status: row.status as SimManagedPopulation["status"],
  };
}

function toSimTradeRoute(row: SupabaseTradeRouteRow): SimTradeRoute {
  return {
    destinationSettlementId: row.destination_settlement_id,
    id: row.id,
    originSettlementId: row.origin_settlement_id,
    quantityPerTransition: row.quantity_per_transition,
    resourceId: row.resource_id,
    status: row.status as SimTradeRoute["status"],
  };
}

function toSimCitizen(row: SupabaseCitizenRow): SimCitizen {
  return {
    bornOnTurnNumber: row.born_on_turn_number,
    citizenType: row.citizen_type as SimCitizen["citizenType"],
    id: row.id,
    name: row.name,
    parentACitizenId: row.parent_a_citizen_id,
    parentBCitizenId: row.parent_b_citizen_id,
    settlementId: row.settlement_id,
    sex: row.sex,
    status: row.status as SimCitizen["status"],
  };
}

function toSimCitizenAssignment(
  row: SupabaseAssignmentRow,
): SimCitizenAssignment {
  return {
    assignedOnTurnNumber: row.assigned_on_turn_number,
    assignmentType:
      row.assignment_type as SimCitizenAssignment["assignmentType"],
    citizenId: row.citizen_id,
    constructionProjectId: row.construction_project_id,
    depositInstanceId: row.deposit_instance_id,
    jobId: row.job_id,
    managedPopulationInstanceId: row.managed_population_instance_id,
    tradeRouteEnd: row.trade_route_end,
    tradeRouteId: row.trade_route_id,
  };
}

function toSimPartnership(row: SupabasePartnershipRow): SimPartnership {
  return {
    citizenAId: row.citizen_a_id,
    citizenBId: row.citizen_b_id,
    endedOnTurnNumber: row.ended_on_turn_number,
    formedOnTurnNumber: row.formed_on_turn_number,
    id: row.id,
    status: row.status as SimPartnership["status"],
  };
}

function toSimEvent(row: SupabaseEventRow): SimEvent {
  return {
    activateOnTransitionAfterTurnNumber:
      row.activate_on_transition_after_turn_number,
    effectPayloadJsonb: isRecord(row.effect_payload_jsonb)
      ? row.effect_payload_jsonb
      : {},
    effectType: row.effect_type as SimEvent["effectType"],
    id: row.id,
    status: row.status as SimEvent["status"],
  };
}

function toDeconstructOvershootEntries(
  row: SupabaseOvershootRow,
): readonly SimDeconstructOvershootEntry[] {
  const payload = row.payload_jsonb;
  if (!isRecord(payload)) return [];

  const buildingId = payload.settlement_building_id;
  const currentCitizens = payload.current_citizens;
  const newCap = payload.new_cap;

  if (
    typeof buildingId !== "string" ||
    typeof currentCitizens !== "number" ||
    typeof newCap !== "number"
  ) {
    return [];
  }

  const overshootAmount = Math.max(0, currentCitizens - newCap);
  if (overshootAmount === 0) return [];

  return [
    {
      amount: overshootAmount,
      resourceId: "population",
      settlementBuildingId: buildingId,
    },
  ];
}

function toWorldPopulationRules(row: SupabaseWorldRow): WorldPopulationRules {
  return {
    fertilityChance: row.fertility_chance,
    foodConsumptionPerCitizen: row.food_consumption_per_citizen,
    homelessnessDecliningRate: row.homelessness_decline_rate,
    incestPreventionDepth: row.incest_prevention_depth,
    maximumFertilityAgeTurns: row.maximum_fertility_age_turns,
    minimumPartnershipAgeTurns: row.minimum_partnership_age_turns,
    mourningPeriodTurns: row.mourning_period_turns,
    partnershipSeekChance: row.partnership_seek_chance,
    starvationSeverityMultiplier: row.starvation_severity_multiplier,
    waterConsumptionPerCitizen: row.water_consumption_per_citizen,
  };
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
