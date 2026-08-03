import { type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";
import { worldScopedQueryOptions } from "@/lib/worldScopedQueryOptions";

import { UNIT_TYPE_SELECT, toUnitType, type UnitTypeRow } from "./unitTypeRow";
import { unitTypesQueryKeys } from "./unitTypesQueryKeys";

import type { UnitType } from "../types/unitTypeTypes";

type UnitTypesByWorldQueryKey = ReturnType<typeof unitTypesQueryKeys.byWorld>;

type UnitTypesByWorldQueryOptions = UseQueryOptions<
  readonly UnitType[],
  AuthUiError,
  readonly UnitType[],
  UnitTypesByWorldQueryKey
>;

export function unitTypesByWorldQueryOptions(
  worldId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): UnitTypesByWorldQueryOptions {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getUnitTypesByWorld(c, worldId),
    queryKey: unitTypesQueryKeys.byWorld(worldId),
  });
}

async function getUnitTypesByWorld(
  client: GubernatorSupabaseClient,
  worldId: string,
): Promise<readonly UnitType[]> {
  const { data, error } = await client
    .from("unit_types")
    .select(UNIT_TYPE_SELECT)
    .eq("world_id", worldId)
    .order("name", { ascending: true })
    .order("id", { ascending: true })
    .returns<UnitTypeRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toUnitType);
}
