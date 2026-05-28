import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";

import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { normalizeSupabaseError, type AuthUiError } from "../utils/authErrors";

import { authQueryKeys } from "./authQueryKeys";

import type { AppUser } from "../types/authTypes";

type AvailableUsersQueryKey = ReturnType<typeof authQueryKeys.availableUsers>;
type AvailableUsersQueryOptions = UseQueryOptions<
  readonly AppUser[],
  AuthUiError,
  readonly AppUser[],
  AvailableUsersQueryKey
>;

// Lists active application users for admin pickers such as the player
// character creation dialog. The users table's RLS already gates raw row
// visibility (any authenticated user may read profiles); the surface here
// exists so the dialog has a stable query key and uniform shape rather than
// hitting the table from the component.
export function availableUsersQueryOptions(
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): AvailableUsersQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getAvailableUsers(client),
    queryKey: authQueryKeys.availableUsers(),
  });
}

async function getAvailableUsers(
  client: GubernatorSupabaseClient,
): Promise<readonly AppUser[]> {
  const { data, error } = await client
    .from("users")
    .select("created_at,email,id,is_super_admin,status,updated_at,username")
    .eq("status", "active")
    .order("username", { ascending: true });

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data;
}
