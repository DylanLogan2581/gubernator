import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";

import { normalizeAuthError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { toAccessibleWorld } from "../utils/worldDisplay";

import { worldQueryKeys } from "./worldQueryKeys";

import type {
  AccessibleWorld,
  WorldPermissionContext,
  WorldRouteAccess,
} from "../types/worldTypes";

type AccessibleWorldsQueryKey = ReturnType<
  typeof worldQueryKeys.accessibleWorlds
>;
type WorldBySlugQueryKey = ReturnType<typeof worldQueryKeys.bySlug>;
type AccessibleWorldsQueryOptions = UseQueryOptions<
  readonly AccessibleWorld[],
  AuthUiError,
  readonly AccessibleWorld[],
  AccessibleWorldsQueryKey
>;
type WorldRouteAccessQueryOptions = UseQueryOptions<
  WorldRouteAccess,
  AuthUiError | WorldNotFoundError,
  WorldRouteAccess,
  WorldBySlugQueryKey
>;

const WORLD_HEADER_SELECT =
  "archived_at,created_at,current_turn_number,id,name,owner_id,status,updated_at,visibility";

export class WorldNotFoundError extends Error {
  readonly slug: string;

  constructor(slug: string) {
    super("World not found.");
    this.name = "WorldNotFoundError";
    this.slug = slug;
  }
}

export function accessibleWorldsQueryOptions(
  accessContext: WorldPermissionContext,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): AccessibleWorldsQueryOptions {
  // The client is the configured Supabase singleton in app code; tests inject a fake.
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getAccessibleWorlds(client, accessContext),
    queryKey: worldQueryKeys.accessibleWorlds(accessContext),
  });
}

export function worldRouteAccessQueryOptions(
  slug: string,
  accessContext: WorldPermissionContext,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): WorldRouteAccessQueryOptions {
  // The client is the configured Supabase singleton in app code; tests inject a fake.
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getWorldRouteAccess(client, slug, accessContext),
    queryKey: worldQueryKeys.bySlug(slug, accessContext),
  });
}

async function getAccessibleWorlds(
  client: GubernatorSupabaseClient,
  accessContext: WorldPermissionContext,
): Promise<readonly AccessibleWorld[]> {
  if (!accessContext.isAuthenticated) {
    return [];
  }

  const { data, error } = await client
    .from("worlds")
    .select(WORLD_HEADER_SELECT)
    .order("updated_at", { ascending: false });

  if (error !== null) {
    throw normalizeAuthError(error);
  }

  return data
    .map((world) => toAccessibleWorld(world, accessContext))
    .filter((world) => world.canAccess);
}

async function getWorldRouteAccess(
  client: GubernatorSupabaseClient,
  slug: string,
  accessContext: WorldPermissionContext,
): Promise<WorldRouteAccess> {
  if (!accessContext.isAuthenticated) {
    throw new WorldNotFoundError(slug);
  }

  const { data, error } = await client
    .from("worlds")
    .select(WORLD_HEADER_SELECT)
    .order("updated_at", { ascending: false });

  if (error !== null) {
    throw normalizeAuthError(error);
  }

  const world = data
    .map((row) => toAccessibleWorld(row, accessContext))
    .find((candidate) => candidate.slug === slug);

  if (world === undefined) {
    throw new WorldNotFoundError(slug);
  }

  return {
    canAdmin: world.canAdmin,
    canManage: world.canManage,
    header: {
      archivedAt: world.archivedAt,
      currentTurnNumber: world.currentTurnNumber,
      isArchived: world.isArchived,
      name: world.name,
      slug: world.slug,
      status: world.status,
      visibility: world.visibility,
    },
    world,
  };
}

export function isWorldNotFoundError(
  error: unknown,
): error is WorldNotFoundError {
  return error instanceof WorldNotFoundError;
}
