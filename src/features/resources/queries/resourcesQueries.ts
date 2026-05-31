import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";
import type { Json } from "@/types/database";

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

type ResourceRow = {
  readonly base_stockpile_cap: number;
  readonly created_at: string;
  readonly id: string;
  readonly is_trashed: boolean;
  readonly is_system_resource: boolean;
  readonly last_cleanup_summary_json: Json;
  readonly name: string;
  readonly slug: string;
  readonly updated_at: string;
  readonly world_id: string;
};

const RESOURCE_SELECT =
  "id,world_id,name,slug,base_stockpile_cap,is_system_resource,is_trashed,last_cleanup_summary_json,created_at,updated_at";

export function resourcesByWorldQueryOptions(
  worldId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): ResourcesByWorldQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getResourcesByWorld(client, worldId),
    queryKey: resourcesQueryKeys.byWorld(worldId),
  });
}

export function activeResourcesByWorldQueryOptions(
  worldId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): ActiveResourcesByWorldQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getActiveResourcesByWorld(client, worldId),
    queryKey: resourcesQueryKeys.activeByWorld(worldId),
  });
}

export function resourceByIdQueryOptions(
  resourceId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): ResourceDetailQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getResourceById(client, resourceId),
    queryKey: resourcesQueryKeys.detail(resourceId),
  });
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

function toResource(row: ResourceRow): Resource {
  return {
    baseStockpileCap: row.base_stockpile_cap,
    createdAt: row.created_at,
    id: row.id,
    isTrashed: row.is_trashed,
    isSystemResource: row.is_system_resource,
    lastCleanupSummaryJson: row.last_cleanup_summary_json,
    name: row.name,
    slug: row.slug,
    updatedAt: row.updated_at,
    worldId: row.world_id,
  };
}
