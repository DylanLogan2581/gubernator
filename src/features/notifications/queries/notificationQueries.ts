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
type TurnCompletedNotificationsQueryKey = ReturnType<
  typeof notificationQueryKeys.turnCompleted
>;
type UnreadNotificationsCountQueryOptions = UseQueryOptions<
  number,
  AuthUiError,
  number,
  UnreadNotificationsCountQueryKey
>;
type TurnCompletedNotificationsQueryOptions = UseQueryOptions<
  readonly TurnCompletedNotification[],
  AuthUiError,
  readonly TurnCompletedNotification[],
  TurnCompletedNotificationsQueryKey
>;
export type TurnCompletedNotificationsFilters = {
  readonly worldId?: string | null;
};
type TurnCompletedNotificationRow = {
  readonly generated_at: string;
  readonly generated_in_transition_id: string | null;
  readonly id: string;
  readonly is_read: boolean;
  readonly message_text: string;
  readonly world_id: string;
};

export type TurnCompletedNotification = {
  readonly generatedAt: string;
  readonly generatedInTransitionId: string | null;
  readonly id: string;
  readonly isRead: boolean;
  readonly messageText: string;
  readonly worldId: string;
};

const TURN_COMPLETED_NOTIFICATION_SELECT =
  "id,world_id,generated_in_transition_id,message_text,is_read,generated_at";
const TURN_COMPLETED_NOTIFICATION_TYPE = "turn.completed";

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

export function turnCompletedNotificationsQueryOptions(
  userId: string | null,
  filters: TurnCompletedNotificationsFilters = {},
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): TurnCompletedNotificationsQueryOptions {
  const worldId = filters.worldId ?? null;

  // The client is the configured Supabase singleton in app code; tests inject a fake.
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    enabled: userId !== null,
    queryFn: () => getTurnCompletedNotifications(client, userId, worldId),
    queryKey: notificationQueryKeys.turnCompleted(userId, worldId),
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

async function getTurnCompletedNotifications(
  client: GubernatorSupabaseClient,
  userId: string | null,
  worldId: string | null,
): Promise<readonly TurnCompletedNotification[]> {
  if (userId === null) {
    return [];
  }

  let query = client
    .from("notifications")
    .select(TURN_COMPLETED_NOTIFICATION_SELECT)
    .eq("recipient_user_id", userId)
    .eq("notification_type", TURN_COMPLETED_NOTIFICATION_TYPE);

  if (worldId !== null) {
    query = query.eq("world_id", worldId);
  }

  const { data, error } = await query.order("generated_at", {
    ascending: false,
  });

  if (error !== null) {
    throw normalizeAuthError(error);
  }

  return data.map(toTurnCompletedNotification);
}

function toTurnCompletedNotification(
  row: TurnCompletedNotificationRow,
): TurnCompletedNotification {
  return {
    generatedAt: row.generated_at,
    generatedInTransitionId: row.generated_in_transition_id,
    id: row.id,
    isRead: row.is_read,
    messageText: row.message_text,
    worldId: row.world_id,
  };
}
