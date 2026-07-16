import { type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";
import { worldScopedQueryOptions } from "@/lib/worldScopedQueryOptions";

import {
  BLUEPRINT_SELECT,
  TIER_SELECT,
  toBlueprint,
  toTier,
  type BlueprintRow,
  type TierRow,
} from "./buildingRow";
import { buildingsQueryKeys } from "./buildingsQueryKeys";

import type {
  BuildingBlueprint,
  BuildingBlueprintTier,
} from "../types/buildingTypes";

type BlueprintsByWorldQueryKey = ReturnType<
  typeof buildingsQueryKeys.blueprintsByWorld
>;
type TiersByBlueprintQueryKey = ReturnType<
  typeof buildingsQueryKeys.tiersByBlueprint
>;
type BlueprintDetailQueryKey = ReturnType<
  typeof buildingsQueryKeys.blueprintById
>;
type TierDetailQueryKey = ReturnType<typeof buildingsQueryKeys.tierById>;

type BlueprintsByWorldQueryOptions = UseQueryOptions<
  readonly BuildingBlueprint[],
  AuthUiError,
  readonly BuildingBlueprint[],
  BlueprintsByWorldQueryKey
>;
type TiersByBlueprintQueryOptions = UseQueryOptions<
  readonly BuildingBlueprintTier[],
  AuthUiError,
  readonly BuildingBlueprintTier[],
  TiersByBlueprintQueryKey
>;
type BlueprintDetailQueryOptions = UseQueryOptions<
  BuildingBlueprint | null,
  AuthUiError,
  BuildingBlueprint | null,
  BlueprintDetailQueryKey
>;
type TierDetailQueryOptions = UseQueryOptions<
  BuildingBlueprintTier | null,
  AuthUiError,
  BuildingBlueprintTier | null,
  TierDetailQueryKey
>;

export function blueprintsByWorldQueryOptions(
  worldId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): BlueprintsByWorldQueryOptions {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getBlueprintsByWorld(c, worldId),
    queryKey: buildingsQueryKeys.blueprintsByWorld(worldId),
  });
}

export function tiersByBlueprintQueryOptions(
  blueprintId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): TiersByBlueprintQueryOptions {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getTiersByBlueprint(c, blueprintId),
    queryKey: buildingsQueryKeys.tiersByBlueprint(blueprintId),
  });
}

export function blueprintByIdQueryOptions(
  blueprintId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): BlueprintDetailQueryOptions {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getBlueprintById(c, blueprintId),
    queryKey: buildingsQueryKeys.blueprintById(blueprintId),
  });
}

export function tierByIdQueryOptions(
  tierId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): TierDetailQueryOptions {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getTierById(c, tierId),
    queryKey: buildingsQueryKeys.tierById(tierId),
  });
}

export type BlueprintsSortBy = "name" | "gracePeriod" | "maxInstances";

export type BlueprintsPageParams = {
  readonly page: number;
  readonly pageSize: number;
  readonly search?: string;
  readonly sortBy?: BlueprintsSortBy;
  readonly sortDirection?: "asc" | "desc";
  readonly trash: boolean;
};

export type BuildingBlueprintSummary = BuildingBlueprint & {
  readonly tierCount: number;
};

export type BlueprintsPage = {
  readonly items: readonly BuildingBlueprintSummary[];
  readonly totalCount: number;
};

type BlueprintsPageQueryKey = ReturnType<
  typeof buildingsQueryKeys.blueprintsPage
>;
type BlueprintsPageQueryOptions = UseQueryOptions<
  BlueprintsPage,
  AuthUiError,
  BlueprintsPage,
  BlueprintsPageQueryKey
>;

// Config panel table (#1032): server-side search + pagination + trash
// filtering so the client only ever holds one page of blueprints, not the
// whole world's list. Also embeds a per-blueprint tier count via a Supabase
// embedded count select, without touching BLUEPRINT_SELECT/BlueprintRow
// (used elsewhere for single-blueprint/tier fetches).
export function blueprintsPageQueryOptions(
  worldId: string,
  params: BlueprintsPageParams,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): BlueprintsPageQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return {
    queryFn: () => getBlueprintsPage(client, worldId, params),
    queryKey: buildingsQueryKeys.blueprintsPage(worldId, params),
  };
}

type BlueprintSummaryRow = BlueprintRow & {
  readonly tier_count: readonly { readonly count: number }[];
};

const BLUEPRINT_SUMMARY_SELECT = `${BLUEPRINT_SELECT},tier_count:building_blueprint_tiers(count)`;

function toBlueprintSummary(
  row: BlueprintSummaryRow,
): BuildingBlueprintSummary {
  return {
    ...toBlueprint(row),
    tierCount: row.tier_count[0]?.count ?? 0,
  };
}

async function getBlueprintsPage(
  client: GubernatorSupabaseClient,
  worldId: string,
  params: BlueprintsPageParams,
): Promise<BlueprintsPage> {
  const pageStart = params.page * params.pageSize;
  const pageEnd = pageStart + params.pageSize - 1;
  const search = params.search?.trim() ?? "";

  let query = client
    .from("building_blueprints")
    .select(BLUEPRINT_SUMMARY_SELECT, { count: "exact" })
    .eq("world_id", worldId)
    .eq("is_trashed", params.trash);

  if (search !== "") {
    query = query.ilike("name", `%${search}%`);
  }

  const sortAscending = params.sortDirection !== "desc";

  if (params.sortBy === "gracePeriod") {
    query = query
      .order("grace_period_turns", { ascending: sortAscending })
      .order("name", { ascending: true });
  } else if (params.sortBy === "maxInstances") {
    query = query
      .order("max_instances_per_settlement", {
        ascending: sortAscending,
        nullsFirst: sortAscending,
      })
      .order("name", { ascending: true });
  } else {
    query = query.order("name", { ascending: sortAscending });
  }

  const { data, error, count } = await query
    .order("id", { ascending: true })
    .range(pageStart, pageEnd)
    .returns<BlueprintSummaryRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return {
    items: data.map(toBlueprintSummary),
    totalCount: count ?? 0,
  };
}

async function getBlueprintsByWorld(
  client: GubernatorSupabaseClient,
  worldId: string,
): Promise<readonly BuildingBlueprint[]> {
  const { data, error } = await client
    .from("building_blueprints")
    .select(BLUEPRINT_SELECT)
    .eq("world_id", worldId)
    .order("name", { ascending: true })
    .order("id", { ascending: true })
    .returns<BlueprintRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toBlueprint);
}

async function getTiersByBlueprint(
  client: GubernatorSupabaseClient,
  blueprintId: string,
): Promise<readonly BuildingBlueprintTier[]> {
  const { data, error } = await client
    .from("building_blueprint_tiers")
    .select(TIER_SELECT)
    .eq("building_blueprint_id", blueprintId)
    .order("tier_number", { ascending: true })
    .returns<TierRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toTier);
}

async function getBlueprintById(
  client: GubernatorSupabaseClient,
  blueprintId: string,
): Promise<BuildingBlueprint | null> {
  const { data, error } = await client
    .from("building_blueprints")
    .select(BLUEPRINT_SELECT)
    .eq("id", blueprintId)
    .maybeSingle<BlueprintRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data === null ? null : toBlueprint(data);
}

async function getTierById(
  client: GubernatorSupabaseClient,
  tierId: string,
): Promise<BuildingBlueprintTier | null> {
  const { data, error } = await client
    .from("building_blueprint_tiers")
    .select(TIER_SELECT)
    .eq("id", tierId)
    .maybeSingle<TierRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data === null ? null : toTier(data);
}
