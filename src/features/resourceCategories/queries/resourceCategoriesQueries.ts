import { type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";
import { worldScopedQueryOptions } from "@/lib/worldScopedQueryOptions";

import { resourceCategoriesQueryKeys } from "./resourceCategoriesQueryKeys";
import {
  RESOURCE_CATEGORY_SELECT,
  toResourceCategory,
  type ResourceCategoryRow,
} from "./resourceCategoryRow";

import type { ResourceCategory } from "../types/resourceCategoryTypes";

type ResourceCategoriesByWorldQueryKey = ReturnType<
  typeof resourceCategoriesQueryKeys.byWorld
>;

type ResourceCategoriesByWorldQueryOptions = UseQueryOptions<
  readonly ResourceCategory[],
  AuthUiError,
  readonly ResourceCategory[],
  ResourceCategoriesByWorldQueryKey
>;

export function resourceCategoriesByWorldQueryOptions(
  worldId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): ResourceCategoriesByWorldQueryOptions {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getResourceCategoriesByWorld(c, worldId),
    queryKey: resourceCategoriesQueryKeys.byWorld(worldId),
  });
}

async function getResourceCategoriesByWorld(
  client: GubernatorSupabaseClient,
  worldId: string,
): Promise<readonly ResourceCategory[]> {
  const { data, error } = await client
    .from("resource_categories")
    .select(RESOURCE_CATEGORY_SELECT)
    .eq("world_id", worldId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })
    .returns<ResourceCategoryRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toResourceCategory);
}
