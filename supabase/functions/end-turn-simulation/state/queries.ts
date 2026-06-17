import { classifyHttpError, supabaseFetch } from "../../_shared/supabaseFetch.ts";

import { isWorldRow } from "./rowTypes.ts";

import type { SupabaseWorldRow } from "./rowTypes.ts";

// ---------------------------------------------------------------------------
// Shared fetch context
// ---------------------------------------------------------------------------

export type FetchContext = {
  readonly headers: { readonly apikey: string; readonly authorization: string };
  readonly supabaseUrl: string;
};

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export type FetchReason =
  | "fetch_failed"
  | { readonly kind: "http_error"; readonly safeDeny: boolean }
  | "invalid_payload"
  | "response_truncated";

export type FetchRowsResult =
  | { readonly ok: true; readonly rows: readonly unknown[] }
  | { readonly ok: false; readonly reason: FetchReason };

export type WorldFetchResult =
  | { readonly ok: true; readonly row: SupabaseWorldRow }
  | { readonly ok: false; readonly reason: FetchReason | "missing_world" };

// ---------------------------------------------------------------------------
// Generic fetch helper (private)
// ---------------------------------------------------------------------------

async function fetchRows({
  ctx,
  params,
  table,
}: {
  readonly ctx: FetchContext;
  readonly params: Record<string, string>;
  readonly table: string;
}): Promise<FetchRowsResult> {
  const searchParams = new URLSearchParams(params);
  let response: Response;

  try {
    response = await supabaseFetch(
      `${ctx.supabaseUrl}/rest/v1/${table}?${searchParams}`,
      { headers: ctx.headers, method: "GET" },
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-restricted-syntax
    console.log(
      JSON.stringify({
        event: "fetch_error",
        table,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      }),
    );
    return { ok: false, reason: "fetch_failed" };
  }

  if (!response.ok) {
    return {
      ok: false,
      reason: {
        kind: "http_error",
        ...classifyHttpError(response.status),
      },
    };
  }

  const payload: unknown = await response.json();

  if (!Array.isArray(payload)) {
    return { ok: false, reason: "invalid_payload" };
  }

  return { ok: true, rows: payload };
}

/**
 * Fetch rows with automatic pagination for responses that exceed the 1000-row limit.
 * Detects truncation via Content-Range header and paginates to fetch all rows.
 * Raises error if response is truncated (safeguard against silent data loss).
 */
async function fetchRowsPaginated({
  ctx,
  params,
  table,
}: {
  readonly ctx: FetchContext;
  readonly params: Record<string, string>;
  readonly table: string;
}): Promise<FetchRowsResult> {
  const allRows: unknown[] = [];
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const searchParams = new URLSearchParams(params);

    let response: Response;

    try {
      const rangeHeader = `rows=${offset}-${offset + pageSize - 1}`;
      response = await supabaseFetch(
        `${ctx.supabaseUrl}/rest/v1/${table}?${searchParams}`,
        {
          headers: { ...ctx.headers, Range: rangeHeader },
          method: "GET",
        },
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // eslint-disable-next-line no-restricted-syntax
      console.log(
        JSON.stringify({
          event: "fetch_error",
          table,
          error: errorMessage,
          timestamp: new Date().toISOString(),
          offset,
        }),
      );
      return { ok: false, reason: "fetch_failed" };
    }

    if (!response.ok) {
      return {
        ok: false,
        reason: {
          kind: "http_error",
          ...classifyHttpError(response.status),
        },
      };
    }

    const payload: unknown = await response.json();

    if (!Array.isArray(payload)) {
      return { ok: false, reason: "invalid_payload" };
    }

    const pageRowCount = payload.length;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    allRows.push(...payload);

    // A short page (fewer rows than the page size) is always the final page;
    // there cannot be more rows to fetch regardless of the Content-Range header.
    if (pageRowCount < pageSize) {
      break;
    }

    // Check Content-Range header to determine whether more rows exist.
    const contentRange = response.headers.get("Content-Range");

    if (contentRange === null) {
      // No Content-Range header but a full page: cannot rule out more rows.
      // Treat as truncation risk to avoid silent data loss.
      // eslint-disable-next-line no-restricted-syntax
      console.log(
        JSON.stringify({
          event: "missing_content_range",
          table,
          timestamp: new Date().toISOString(),
        }),
      );
      return { ok: false, reason: "response_truncated" };
    }

    // PostgREST Content-Range format is `<start>-<end>/<total>` where the total
    // is `*` unless an exact count was requested (e.g. `0-999/*` or `0-999/1500`).
    // There is no `items ` prefix.
    const rangeMatch = contentRange.match(/(\d+)-(\d+)\/(\d+|\*)/);

    if (rangeMatch === null) {
      // Malformed header, assume truncation risk and raise error.
      // eslint-disable-next-line no-restricted-syntax
      console.log(
        JSON.stringify({
          event: "content_range_parse_error",
          table,
          contentRange,
          timestamp: new Date().toISOString(),
        }),
      );
      return { ok: false, reason: "response_truncated" };
    }

    const rangeEnd = parseInt(rangeMatch[2], 10);
    const totalRaw = rangeMatch[3];

    // If the total is known and we've reached it, stop.
    if (totalRaw !== "*") {
      const total = parseInt(totalRaw, 10);

      if (rangeEnd >= total - 1) {
        break;
      }
    }

    // Total unknown (`*`) or more rows remain: fetch the next full page.
    offset = rangeEnd + 1;
  }

  return { ok: true, rows: allRows };
}

function buildInFilter(ids: readonly string[]): string {
  return ids.length > 0 ? `in.(${ids.join(",")})` : "in.()";
}

// ---------------------------------------------------------------------------
// World row fetch (single-row, special handling)
// ---------------------------------------------------------------------------

export async function fetchWorldRow(
  ctx: FetchContext,
  worldId: string,
): Promise<WorldFetchResult> {
  const searchParams = new URLSearchParams({
    id: `eq.${worldId}`,
    limit: "1",
    select: [
      "id",
      "status",
      "current_turn_number",
      "calendar_config_json",
      "naming_config_json",
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
    response = await supabaseFetch(
      `${ctx.supabaseUrl}/rest/v1/worlds?${searchParams}`,
      { headers: ctx.headers, method: "GET" },
    );
  } catch {
    return { ok: false, reason: "fetch_failed" };
  }

  if (!response.ok) {
    return {
      ok: false,
      reason: {
        kind: "http_error",
        ...classifyHttpError(response.status),
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
// World-scoped table queries
// ---------------------------------------------------------------------------

export function fetchSettlements(
  ctx: FetchContext,
  worldId: string,
): Promise<FetchRowsResult> {
  return fetchRows({
    ctx,
    table: "settlements",
    params: {
      "nations.world_id": `eq.${worldId}`,
      order: "id.asc",
      select:
        "id,name,nameset_id,nation_id,is_ready_current_turn,auto_ready_enabled,nations!inner(nameset_id,world_id)",
    },
  });
}

export function fetchNamesets(
  ctx: FetchContext,
  worldId: string,
): Promise<FetchRowsResult> {
  return fetchRows({
    ctx,
    table: "namesets",
    params: {
      world_id: `eq.${worldId}`,
      is_trashed: "eq.false",
      order: "id.asc",
      select: "id,config_json,is_default",
    },
  });
}

export function fetchResources(
  ctx: FetchContext,
  worldId: string,
): Promise<FetchRowsResult> {
  return fetchRows({
    ctx,
    table: "resources",
    params: {
      world_id: `eq.${worldId}`,
      is_system_resource: "eq.true",
      is_trashed: "eq.false",
      select: "decay_rate,id,slug",
    },
  });
}

export function fetchJobs(
  ctx: FetchContext,
  worldId: string,
): Promise<FetchRowsResult> {
  return fetchRows({
    ctx,
    table: "job_definitions",
    params: {
      world_id: `eq.${worldId}`,
      is_trashed: "eq.false",
      order: "id.asc",
      select:
        "id,name,job_type,base_capacity,trader_capacity_per_worker,linked_deposit_type_id,linked_managed_population_type_id,inputs_json,outputs_json",
    },
  });
}

export function fetchBlueprints(
  ctx: FetchContext,
  worldId: string,
): Promise<FetchRowsResult> {
  return fetchRows({
    ctx,
    table: "building_blueprints",
    params: {
      world_id: `eq.${worldId}`,
      is_trashed: "eq.false",
      order: "id.asc",
      select:
        "id,name,grace_period_turns,max_instances_per_settlement,building_blueprint_tiers(id,building_blueprint_id,tier_number,worker_turns_required,construction_costs_json,upkeep_costs_json,effects_json)",
    },
  });
}

export function fetchDepositTypes(
  ctx: FetchContext,
  worldId: string,
): Promise<FetchRowsResult> {
  return fetchRows({
    ctx,
    table: "deposit_types",
    params: {
      world_id: `eq.${worldId}`,
      is_trashed: "eq.false",
      order: "id.asc",
      select: "id,name,job_id,output_units_per_worker,worker_inputs_json",
    },
  });
}

export function fetchManagedPopTypes(
  ctx: FetchContext,
  worldId: string,
): Promise<FetchRowsResult> {
  return fetchRows({
    ctx,
    table: "managed_population_types",
    params: {
      world_id: `eq.${worldId}`,
      is_trashed: "eq.false",
      order: "id.asc",
      select:
        "id,name,husbandry_job_id,culling_job_id,husbandry_workers_per_n_animals,growth_rate,maintenance_rules_json,culling_outputs_json,regular_outputs_json",
    },
  });
}

export function fetchCitizens(
  ctx: FetchContext,
  worldId: string,
): Promise<FetchRowsResult> {
  return fetchRowsPaginated({
    ctx,
    table: "citizens",
    params: {
      world_id: `eq.${worldId}`,
      status: "eq.alive",
      order: "id.asc",
      select:
        "id,settlement_id,citizen_type,given_name,surname,sex,status,born_on_turn_number,parent_a_citizen_id,parent_b_citizen_id,nameset_id",
    },
  });
}

export function fetchEvents(
  ctx: FetchContext,
  worldId: string,
): Promise<FetchRowsResult> {
  return fetchRowsPaginated({
    ctx,
    table: "events",
    params: {
      world_id: `eq.${worldId}`,
      status: "in.(active,pending)",
      order: "id.asc",
      select:
        "id,status,effect_type,activate_on_transition_after_turn_number,duration_type,remaining_transitions,effect_payload_jsonb,scope_type,scope_nation_id,scope_settlement_id",
    },
  });
}

export function fetchEventEffects(
  ctx: FetchContext,
  _worldId: string,
): Promise<FetchRowsResult> {
  return fetchRowsPaginated({
    ctx,
    table: "event_effects",
    params: {
      select:
        "id,event_id,effect_type,amount_value,multiplier_value,is_percent,resource_id,job_id,managed_population_instance_id,deposit_instance_id,settlement_building_id,building_blueprint_id,extra_data_jsonb",
      order: "event_id.asc,id.asc",
    },
  });
}

export function fetchAssignments(
  ctx: FetchContext,
  worldId: string,
): Promise<FetchRowsResult> {
  return fetchRowsPaginated({
    ctx,
    table: "citizen_assignments",
    params: {
      "citizens.world_id": `eq.${worldId}`,
      order: "citizen_id.asc",
      select:
        "citizen_id,assignment_type,job_id,construction_project_id,deposit_instance_id,managed_population_instance_id,trade_route_id,trade_route_end,assigned_on_turn_number,citizens!inner(world_id)",
    },
  });
}

export function fetchPartnerships(
  ctx: FetchContext,
  worldId: string,
): Promise<FetchRowsResult> {
  // PostgREST requires an alias when filtering by a related table that has
  // multiple FKs to the same target (citizen_a_id / citizen_b_id both point
  // to citizens).  "citizens!citizen_a_id.world_id" is not valid syntax in
  // PostgREST 14; instead we alias the embed and filter by the alias.
  return fetchRowsPaginated({
    ctx,
    table: "partnerships",
    params: {
      "citizen_a.world_id": `eq.${worldId}`,
      order: "id.asc",
      select:
        "id,citizen_a_id,citizen_b_id,status,formed_on_turn_number,ended_on_turn_number,citizen_a:citizens!citizen_a_id!inner(world_id)",
    },
  });
}

// ---------------------------------------------------------------------------
// Settlement-scoped table queries
// ---------------------------------------------------------------------------

export function fetchStockpiles(
  ctx: FetchContext,
  settlementIds: readonly string[],
): Promise<FetchRowsResult> {
  return fetchRowsPaginated({
    ctx,
    table: "settlement_stockpiles_view",
    params: {
      settlement_id: buildInFilter(settlementIds),
      select: "settlement_id,resource_id,quantity,effective_cap",
    },
  });
}

export function fetchBuildings(
  ctx: FetchContext,
  settlementIds: readonly string[],
): Promise<FetchRowsResult> {
  return fetchRows({
    ctx,
    table: "settlement_buildings",
    params: {
      settlement_id: buildInFilter(settlementIds),
      state: "in.(active,suspended)",
      order: "id.asc",
      select:
        "id,settlement_id,building_blueprint_id,current_tier_id,source_project_id,state,missed_upkeep_count,activated_on_turn_number",
    },
  });
}

export function fetchProjects(
  ctx: FetchContext,
  settlementIds: readonly string[],
): Promise<FetchRowsResult> {
  return fetchRows({
    ctx,
    table: "construction_projects",
    params: {
      settlement_id: buildInFilter(settlementIds),
      status: "in.(in_progress,queued,paused)",
      order: "queue_position.asc",
      select:
        "id,settlement_id,building_blueprint_id,target_tier_id,status,queue_position,progress_worker_turns,target_tier:building_blueprint_tiers!target_tier_id(worker_turns_required)",
    },
  });
}

export function fetchDeposits(
  ctx: FetchContext,
  settlementIds: readonly string[],
): Promise<FetchRowsResult> {
  return fetchRows({
    ctx,
    table: "deposit_instances",
    params: {
      settlement_id: buildInFilter(settlementIds),
      status: "eq.active",
      order: "id.asc",
      select:
        "id,settlement_id,deposit_type_id,name,status,max_workers,deposit_instance_resources(id,resource_id,remaining_quantity)",
    },
  });
}

export function fetchManagedPops(
  ctx: FetchContext,
  settlementIds: readonly string[],
): Promise<FetchRowsResult> {
  return fetchRows({
    ctx,
    table: "managed_population_instances",
    params: {
      settlement_id: buildInFilter(settlementIds),
      status: "eq.active",
      order: "id.asc",
      select:
        "id,settlement_id,managed_population_type_id,name,current_count,configured_cull_quantity,status",
    },
  });
}

export function fetchTradeRoutes(
  ctx: FetchContext,
  settlementIds: readonly string[],
): Promise<FetchRowsResult> {
  // Scope to routes whose origin AND destination are in-world. `origin_settlement_id`
  // is a UUID FK (not JSON), so it cannot be filtered with PostgREST's `->` operator.
  // Filtering by the world's settlement IDs is both correct and simpler.
  return fetchRows({
    ctx,
    table: "trade_routes",
    params: {
      origin_settlement_id: buildInFilter(settlementIds),
      destination_settlement_id: buildInFilter(settlementIds),
      status: "in.(active,paused)",
      order: "id.asc",
      select:
        "id,origin_settlement_id,destination_settlement_id,status,trade_route_legs(direction,resource_id,quantity_per_transition)",
    },
  });
}
