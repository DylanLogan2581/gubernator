import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";

import { normalizeAuthError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { worldAccessQueryKeys } from "./worldAccessQueryKeys";

type CurrentUserAdminWorldIdsQueryKey = ReturnType<
  typeof worldAccessQueryKeys.currentUserAdminWorldIds
>;
type CurrentUserAdminWorldIdsQueryOptions = UseQueryOptions<
  readonly string[],
  AuthUiError,
  readonly string[],
  CurrentUserAdminWorldIdsQueryKey
>;

export function currentUserAdminWorldIdsQueryOptions(
  userId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): CurrentUserAdminWorldIdsQueryOptions {
  // The client is the configured Supabase singleton in app code; tests inject a fake.
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getCurrentUserAdminWorldIds(client, userId),
    queryKey: worldAccessQueryKeys.currentUserAdminWorldIds(userId),
  });
}

async function getCurrentUserAdminWorldIds(
  client: GubernatorSupabaseClient,
  userId: string,
): Promise<readonly string[]> {
  const { data, error } = await client
    .from("world_admins")
    .select("world_id")
    .eq("user_id", userId)
    .order("world_id", { ascending: true });

  if (error !== null) {
    throw normalizeAuthError(error);
  }

  return data.map((row) => row.world_id);
}
