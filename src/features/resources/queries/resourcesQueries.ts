import { type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";
import { worldScopedQueryOptions } from "@/lib/worldScopedQueryOptions";

import { RESOURCE_SELECT, toResource, type ResourceRow } from "./resourceRow";
import { resourcesQueryKeys } from "./resourcesQueryKeys";

import type { Resource } from "../types/resourceTypes";

type ResourcesByWorldQueryKey = ReturnType<typeof resourcesQueryKeys.byWorld>;
type ActiveResourcesByWorldQueryKey = ReturnType<
  typeof resourcesQueryKeys.activeByWorld
>;
type ResourceDetailQueryKey = ReturnType<typeof resourcesQueryKeys.detail>;

type ResourcesByWorldQueryOptions = UseQueryOptions<
  readonly Resource[],
  AuthUiError,
  readonly Resource[],
  ResourcesByWorldQueryKey
>;
type ActiveResourcesByWorldQueryOptions = UseQueryOptions<
  readonly Resource[],
  AuthUiError,
  readonly Resource[],
  ActiveResourcesByWorldQueryKey
>;
type ResourceDetailQueryOptions = UseQueryOptions<
  Resource | null,
  AuthUiError,
  Resource | null,
  ResourceDetailQueryKey
>;

export function resourcesByWorldQueryOptions(
  worldId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): ResourcesByWorldQueryOptions {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getResourcesByWorld(c, worldId),
    queryKey: resourcesQueryKeys.byWorld(worldId),
  });
}

export function activeResourcesByWorldQueryOptions(
  worldId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): ActiveResourcesByWorldQueryOptions {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getActiveResourcesByWorld(c, worldId),
    queryKey: resourcesQueryKeys.activeByWorld(worldId),
  });
}

export function resourceByIdQueryOptions(
  resourceId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): ResourceDetailQueryOptions {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getResourceById(c, resourceId),
    queryKey: resourcesQueryKeys.detail(resourceId),
  });
}

export type ResourcesSortBy = "name" | "category" | "cap" | "change";

// Sentinel for the "Uncategorized" filter option, distinct from any real
// resource_categories.id (a uuid), so the page query can tell "no filter"
// (categoryId === null) apart from "filter to resources with no category".
export const UNCATEGORIZED_RESOURCE_CATEGORY_FILTER = "uncategorized";

export type ResourcesPageParams = {
  readonly categoryId?: string | null;
  readonly page: number;
  readonly pageSize: number;
  readonly search?: string;
  readonly sortBy?: ResourcesSortBy;
  readonly sortDirection?: "asc" | "desc";
  readonly trash: boolean;
};

export type ResourcesPage = {
  readonly items: readonly Resource[];
  readonly totalCount: number;
};

type ResourcesPageQueryKey = ReturnType<typeof resourcesQueryKeys.page>;
type ResourcesPageQueryOptions = UseQueryOptions<
  ResourcesPage,
  AuthUiError,
  ResourcesPage,
  ResourcesPageQueryKey
>;

// Config panel table (#1032): server-side search + pagination + trash
// filtering so the client only ever holds one page of resources, not the
// whole world's list.
export function resourcesPageQueryOptions(
  worldId: string,
  params: ResourcesPageParams,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): ResourcesPageQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return {
    queryFn: () => getResourcesPage(client, worldId, params),
    queryKey: resourcesQueryKeys.page(worldId, params),
  };
}

async function getResourcesPage(
  client: GubernatorSupabaseClient,
  worldId: string,
  params: ResourcesPageParams,
): Promise<ResourcesPage> {
  const pageStart = params.page * params.pageSize;
  const pageEnd = pageStart + params.pageSize - 1;
  const search = params.search?.trim() ?? "";

  let query = client
    .from("resources")
    .select(RESOURCE_SELECT, { count: "exact" })
    .eq("world_id", worldId)
    .eq("is_trashed", params.trash);

  if (search !== "") {
    query = query.ilike("name", `%${search}%`);
  }

  if (params.categoryId === UNCATEGORIZED_RESOURCE_CATEGORY_FILTER) {
    query = query.is("category_id", null);
  } else if (params.categoryId !== undefined && params.categoryId !== null) {
    query = query.eq("category_id", params.categoryId);
  }

  const sortAscending = params.sortDirection !== "desc";

  if (params.sortBy === "category") {
    query = query
      .order("name", {
        ascending: sortAscending,
        nullsFirst: sortAscending,
        referencedTable: "resource_categories",
      })
      .order("name", { ascending: true });
  } else if (params.sortBy === "cap") {
    query = query
      .order("base_stockpile_cap", { ascending: sortAscending })
      .order("name", { ascending: true });
  } else if (params.sortBy === "change") {
    query = query
      .order("change_amount", { ascending: sortAscending })
      .order("name", { ascending: true });
  } else {
    query = query.order("name", { ascending: sortAscending });
  }

  const { data, error, count } = await query
    .order("id", { ascending: true })
    .range(pageStart, pageEnd)
    .returns<ResourceRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return {
    items: data.map(toResource),
    totalCount: count ?? 0,
  };
}

async function getResourcesByWorld(
  client: GubernatorSupabaseClient,
  worldId: string,
): Promise<readonly Resource[]> {
  const { data, error } = await client
    .from("resources")
    .select(RESOURCE_SELECT)
    .eq("world_id", worldId)
    .order("name", { ascending: true })
    .order("id", { ascending: true })
    .returns<ResourceRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toResource);
}

async function getActiveResourcesByWorld(
  client: GubernatorSupabaseClient,
  worldId: string,
): Promise<readonly Resource[]> {
  const { data, error } = await client
    .from("resources")
    .select(RESOURCE_SELECT)
    .eq("world_id", worldId)
    .eq("is_trashed", false)
    .order("name", { ascending: true })
    .order("id", { ascending: true })
    .returns<ResourceRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toResource);
}

async function getResourceById(
  client: GubernatorSupabaseClient,
  resourceId: string,
): Promise<Resource | null> {
  const { data, error } = await client
    .from("resources")
    .select(RESOURCE_SELECT)
    .eq("id", resourceId)
    .maybeSingle<ResourceRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data === null ? null : toResource(data);
}
