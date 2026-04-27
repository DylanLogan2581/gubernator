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
} from "../types/worldTypes";

type AccessibleWorldsQueryKey = ReturnType<
  typeof worldQueryKeys.accessibleWorlds
>;
type AccessibleWorldsQueryOptions = UseQueryOptions<
  readonly AccessibleWorld[],
  AuthUiError,
  readonly AccessibleWorld[],
  AccessibleWorldsQueryKey
>;

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

async function getAccessibleWorlds(
  client: GubernatorSupabaseClient,
  accessContext: WorldPermissionContext,
): Promise<readonly AccessibleWorld[]> {
  if (!accessContext.isAuthenticated) {
    return [];
  }

  const { data, error } = await client
    .from("worlds")
    .select(
      "archived_at,created_at,current_turn_number,id,name,owner_id,status,updated_at,visibility",
    )
    .order("updated_at", { ascending: false });

  if (error !== null) {
    throw normalizeAuthError(error);
  }

  return data
    .map((world) => toAccessibleWorld(world, accessContext))
    .filter((world) => world.canAccess);
}
