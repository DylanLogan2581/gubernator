// PostgREST data-fetching for world template export.
// Uses raw fetch — no supabase-js, no @/ imports.

import { supabaseFetch } from "../_shared/supabaseFetch.ts";

import type {
  RawBlueprintRow,
  RawDepositTypeRow,
  RawJobRow,
  RawManagedPopulationTypeRow,
  RawNamesetRow,
  RawResourceRow,
  RawWorldRow,
  WorldConfigData,
} from "./types.ts";

type FetchCtx = {
  readonly headers: { readonly apikey: string; readonly authorization: string };
  readonly supabaseUrl: string;
};

type FetchResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly reason: string };

async function fetchRows<T>(
  ctx: FetchCtx,
  table: string,
  params: Record<string, string>,
): Promise<FetchResult<readonly T[]>> {
  const searchParams = new URLSearchParams(params);
  let response: Response;
  try {
    response = await supabaseFetch(`${ctx.supabaseUrl}/rest/v1/${table}?${searchParams}`, {
      headers: ctx.headers,
      method: "GET",
    });
  } catch {
    return { ok: false, reason: `fetch_failed:${table}` };
  }
  if (!response.ok) {
    return { ok: false, reason: `http_error:${table}:${String(response.status)}` };
  }
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) {
    return { ok: false, reason: `invalid_payload:${table}` };
  }
  return { ok: true, data: payload as readonly T[] };
}

async function fetchSingleRow<T>(
  ctx: FetchCtx,
  table: string,
  params: Record<string, string>,
): Promise<FetchResult<T>> {
  const result = await fetchRows<T>(ctx, table, params);
  if (!result.ok) return result;
  const row = result.data[0];
  if (row === undefined) {
    return { ok: false, reason: `missing_row:${table}` };
  }
  return { ok: true, data: row };
}

export async function fetchWorldConfigData(
  ctx: FetchCtx,
  worldId: string,
  exportedAt: string,
): Promise<FetchResult<WorldConfigData>> {
  // Fan out all independent queries in parallel.
  // Tiers are fetched as an embedded relationship inside blueprints.
  const [worldResult, resourcesResult, jobsResult, blueprintsResult, depositTypesResult, managedPopResult, namesetsResult] =
    await Promise.all([
      fetchSingleRow<RawWorldRow>(ctx, "worlds", {
        id: `eq.${worldId}`,
        limit: "1",
        select: [
          "id",
          "name",
          "calendar_config_json",
          "naming_config_json",
          "npc_flavor_config_json",
          "fertility_chance",
          "food_consumption_per_citizen",
          "homelessness_decline_rate",
          "incest_prevention_depth",
          "maximum_fertility_age_turns",
          "minimum_partnership_age_turns",
          "mourning_period_turns",
          "partnership_seek_chance",
          "starvation_severity_multiplier",
          "water_consumption_per_citizen",
        ].join(","),
      }),
      fetchRows<RawResourceRow>(ctx, "resources", {
        world_id: `eq.${worldId}`,
        is_trashed: "eq.false",
        order: "slug.asc,id.asc",
        select:
          "id,name,slug,base_stockpile_cap,decay_rate,is_system_resource,is_trashed",
      }),
      fetchRows<RawJobRow>(ctx, "job_definitions", {
        world_id: `eq.${worldId}`,
        is_trashed: "eq.false",
        order: "slug.asc,id.asc",
        select:
          "id,name,slug,job_type,base_capacity,trader_capacity_per_worker,inputs_json,outputs_json,is_trashed",
      }),
      fetchRows<RawBlueprintRow>(ctx, "building_blueprints", {
        world_id: `eq.${worldId}`,
        is_trashed: "eq.false",
        order: "slug.asc,id.asc",
        select: [
          "id,name,slug,description,max_instances_per_settlement,grace_period_turns,is_trashed",
          "building_blueprint_tiers(building_blueprint_id,tier_number,worker_turns_required,construction_costs_json,upkeep_costs_json,effects_json)",
        ].join(","),
      }),
      fetchRows<RawDepositTypeRow>(ctx, "deposit_types", {
        world_id: `eq.${worldId}`,
        is_trashed: "eq.false",
        order: "slug.asc,id.asc",
        select:
          "id,name,slug,job_id,output_units_per_worker,worker_inputs_json,is_trashed",
      }),
      fetchRows<RawManagedPopulationTypeRow>(ctx, "managed_population_types", {
        world_id: `eq.${worldId}`,
        is_trashed: "eq.false",
        order: "slug.asc,id.asc",
        select: [
          "id,name,slug,husbandry_job_id,culling_job_id",
          "husbandry_workers_per_n_animals,growth_rate",
          "maintenance_rules_json,culling_outputs_json,regular_outputs_json,is_trashed",
        ].join(","),
      }),
      fetchRows<RawNamesetRow>(ctx, "namesets", {
        world_id: `eq.${worldId}`,
        is_trashed: "eq.false",
        order: "is_default.desc,name.asc,id.asc",
        select: "id,name,config_json,is_default,is_trashed",
      }),
    ]);

  if (!worldResult.ok) return { ok: false, reason: worldResult.reason };
  if (!resourcesResult.ok) return { ok: false, reason: resourcesResult.reason };
  if (!jobsResult.ok) return { ok: false, reason: jobsResult.reason };
  if (!blueprintsResult.ok) return { ok: false, reason: blueprintsResult.reason };
  if (!depositTypesResult.ok) return { ok: false, reason: depositTypesResult.reason };
  if (!managedPopResult.ok) return { ok: false, reason: managedPopResult.reason };
  if (!namesetsResult.ok) return { ok: false, reason: namesetsResult.reason };

  return {
    ok: true,
    data: {
      world: worldResult.data,
      resources: resourcesResult.data,
      jobs: jobsResult.data,
      blueprints: blueprintsResult.data,
      depositTypes: depositTypesResult.data,
      managedPopulationTypes: managedPopResult.data,
      namesets: namesetsResult.data,
      exportedAt,
    },
  };
}
