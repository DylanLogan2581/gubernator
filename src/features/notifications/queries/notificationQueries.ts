import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";

import { normalizeAuthError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { notificationQueryKeys } from "./notificationQueryKeys";

type UnreadNotificationsCountQueryKey = ReturnType<
  typeof notificationQueryKeys.unreadCount
>;
type UnreadNotificationsCountQueryOptions = UseQueryOptions<
  number,
  AuthUiError,
  number,
  UnreadNotificationsCountQueryKey
>;

export function unreadNotificationsCountQueryOptions(
  userId: string | null,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): UnreadNotificationsCountQueryOptions {
  // The client is the configured Supabase singleton in app code; tests inject a fake.
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    enabled: userId !== null,
    queryFn: () => getUnreadNotificationsCount(client, userId),
    queryKey: notificationQueryKeys.unreadCount(userId),
  });
}

async function getUnreadNotificationsCount(
  client: GubernatorSupabaseClient,
  userId: string | null,
): Promise<number> {
  if (userId === null) {
    return 0;
  }

  const { count, error } = await client
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_user_id", userId)
    .eq("is_read", false);

  if (error !== null) {
    throw normalizeAuthError(error);
  }

  return count ?? 0;
}
