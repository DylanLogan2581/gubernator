import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

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
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getBlueprintsByWorld(client, worldId),
    queryKey: buildingsQueryKeys.blueprintsByWorld(worldId),
  });
}

export function tiersByBlueprintQueryOptions(
  blueprintId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): TiersByBlueprintQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getTiersByBlueprint(client, blueprintId),
    queryKey: buildingsQueryKeys.tiersByBlueprint(blueprintId),
  });
}

export function blueprintByIdQueryOptions(
  blueprintId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): BlueprintDetailQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getBlueprintById(client, blueprintId),
    queryKey: buildingsQueryKeys.blueprintById(blueprintId),
  });
}

export function tierByIdQueryOptions(
  tierId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): TierDetailQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getTierById(client, tierId),
    queryKey: buildingsQueryKeys.tierById(tierId),
  });
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
