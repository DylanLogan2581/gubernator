import { type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";
import { worldScopedQueryOptions } from "@/lib/worldScopedQueryOptions";

import {
  EDUCATION_LEVEL_SELECT,
  toEducationLevel,
  type EducationLevelRow,
} from "./educationLevelRow";
import { educationLevelsQueryKeys } from "./educationLevelsQueryKeys";

import type { EducationLevel } from "../types/educationLevelTypes";

type EducationLevelsByWorldQueryKey = ReturnType<
  typeof educationLevelsQueryKeys.byWorld
>;

type EducationLevelsByWorldQueryOptions = UseQueryOptions<
  readonly EducationLevel[],
  AuthUiError,
  readonly EducationLevel[],
  EducationLevelsByWorldQueryKey
>;

export function educationLevelsByWorldQueryOptions(
  worldId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): EducationLevelsByWorldQueryOptions {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getEducationLevelsByWorld(c, worldId),
    queryKey: educationLevelsQueryKeys.byWorld(worldId),
  });
}

async function getEducationLevelsByWorld(
  client: GubernatorSupabaseClient,
  worldId: string,
): Promise<readonly EducationLevel[]> {
  const { data, error } = await client
    .from("education_levels")
    .select(EDUCATION_LEVEL_SELECT)
    .eq("world_id", worldId)
    .order("rank", { ascending: true })
    .returns<EducationLevelRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toEducationLevel);
}
