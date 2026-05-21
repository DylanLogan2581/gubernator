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
type WorldByIdQueryKey = ReturnType<typeof worldQueryKeys.byId>;
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
  WorldByIdQueryKey
>;

const WORLD_HEADER_SELECT =
  "archived_at,calendar_config_json,created_at,current_turn_number,id,name,owner_id,status,updated_at,visibility";
const ACCESSIBLE_WORLDS_SELECT =
  "archived_at,calendar_config_json,created_at,current_turn_number,id,name,owner_id,status,updated_at,visibility";

export class WorldNotFoundError extends Error {
  readonly worldId: string;

  constructor(worldId: string) {
    super("World not found.");
    this.name = "WorldNotFoundError";
    this.worldId = worldId;
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
  worldId: string,
  accessContext: WorldPermissionContext,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): WorldRouteAccessQueryOptions {
  // The client is the configured Supabase singleton in app code; tests inject a fake.
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getWorldRouteAccess(client, worldId, accessContext),
    queryKey: worldQueryKeys.byId(worldId, accessContext),
    retry: shouldRetryWorldRouteAccessQuery,
  });
}

export function shouldRetryWorldRouteAccessQuery(
  failureCount: number,
  error: Error,
): boolean {
  return failureCount < 3 && !isWorldNotFoundError(error);
}

async function getAccessibleWorlds(
  client: GubernatorSupabaseClient,
  accessContext: WorldPermissionContext,
): Promise<readonly AccessibleWorld[]> {
  if (!accessContext.isAuthenticated || !accessContext.isActiveUser) {
    return [];
  }

  const { data, error } = await client
    .from("worlds")
    .select(ACCESSIBLE_WORLDS_SELECT)
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
  worldId: string,
  accessContext: WorldPermissionContext,
): Promise<WorldRouteAccess> {
  if (!accessContext.isAuthenticated || !accessContext.isActiveUser) {
    throw new WorldNotFoundError(worldId);
  }

  const { data, error } = await client
    .from("worlds")
    .select(WORLD_HEADER_SELECT)
    .eq("id", worldId)
    .maybeSingle();

  if (error !== null) {
    throw normalizeAuthError(error);
  }

  const world =
    data === null ? undefined : toAccessibleWorld(data, accessContext);

  if (world === undefined || !world.canAccess) {
    throw new WorldNotFoundError(worldId);
  }

  return {
    canAdmin: world.canAdmin,
    canManage: world.canManage,
    header: {
      archivedAt: world.archivedAt,
      currentTurnNumber: world.currentTurnNumber,
      fullInWorldDateLabel: world.fullInWorldDateLabel,
      inWorldDateLabel: world.inWorldDateLabel,
      isArchived: world.isArchived,
      name: world.name,
      nextFullInWorldDateLabel: world.nextFullInWorldDateLabel,
      nextInWorldDateLabel: world.nextInWorldDateLabel,
      nextTurnNumber: world.nextTurnNumber,
      planningTurnNumber: world.planningTurnNumber,
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
