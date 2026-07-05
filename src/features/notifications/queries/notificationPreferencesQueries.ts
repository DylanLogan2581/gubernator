import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";
import { Constants, type Database } from "@/types/database";

import { notificationQueryKeys } from "./notificationQueryKeys";

export type NotificationPreference = {
  readonly enabled: boolean;
  readonly notificationType: Database["public"]["Enums"]["notification_type"];
};

type NotificationPreferencesQueryKey = ReturnType<
  typeof notificationQueryKeys.preferences
>;
type NotificationPreferencesQueryOptions = UseQueryOptions<
  readonly NotificationPreference[],
  AuthUiError,
  readonly NotificationPreference[],
  NotificationPreferencesQueryKey
>;

/**
 * Every notification type, paired with the user's effective preference
 * (enabled unless a notification_preferences row says otherwise). Sourced
 * from Constants.public.Enums.notification_type — the generated DB enum —
 * so a newly added notification type appears here for free.
 */
export function notificationPreferencesQueryOptions(
  userId: string | null,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): NotificationPreferencesQueryOptions {
  // The client is the configured Supabase singleton in app code; tests inject a fake.
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    enabled: userId !== null,
    queryFn: () => getNotificationPreferences(client, userId),
    queryKey: notificationQueryKeys.preferences(userId),
  });
}

async function getNotificationPreferences(
  client: GubernatorSupabaseClient,
  userId: string | null,
): Promise<readonly NotificationPreference[]> {
  if (userId === null) {
    return [];
  }

  const { data, error } = await client
    .from("notification_preferences")
    .select("notification_type,enabled")
    .eq("user_id", userId);

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  const enabledByType = new Map(
    data.map((row) => [row.notification_type, row.enabled]),
  );

  return Constants.public.Enums.notification_type.map((notificationType) => ({
    enabled: enabledByType.get(notificationType) ?? true,
    notificationType,
  }));
}
