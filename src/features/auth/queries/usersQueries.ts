import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";

import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { normalizeSupabaseError, type AuthUiError } from "../utils/authErrors";

import { authQueryKeys } from "./authQueryKeys";

import type { AdminPickerUser } from "../types/authTypes";

type AvailableUsersQueryKey = ReturnType<typeof authQueryKeys.availableUsers>;
type AvailableUsersQueryOptions = UseQueryOptions<
  readonly AdminPickerUser[],
  AuthUiError,
  readonly AdminPickerUser[],
  AvailableUsersQueryKey
>;

// Lists users for admin pickers (link user to citizen, create player character).
// Calls the search_users_for_admin_picker SECURITY DEFINER RPC which returns
// only id + username — never email or other sensitive columns.
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
): Promise<readonly AdminPickerUser[]> {
  const { data, error } = await client.rpc("search_users_for_admin_picker", {
    p_limit: 50,
  });

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data;
}
