import {
  mutationOptions,
  queryOptions,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";
import { type Database } from "@/types/database";

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
type MarkNotificationReadMutationOptions = UseMutationOptions<
  void,
  AuthUiError,
  string
>;
type MarkAllNotificationsReadMutationOptions = UseMutationOptions<
  void,
  AuthUiError,
  void
>;
export type TurnCompletedNotificationsFilters = {
  readonly worldId?: string | null;
};
export type AllNotificationsFilters = {
  readonly isRead?: boolean | null;
  readonly limit?: number;
  readonly nationId?: string | null;
  readonly offset?: number;
  readonly settlementId?: string | null;
  readonly type?: string | null;
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

type AllNotificationRow = {
  readonly citizen_id: string | null;
  readonly event_id: string | null;
  readonly generated_at: string;
  readonly generated_in_transition_id: string | null;
  readonly id: string;
  readonly is_read: boolean;
  readonly message_text: string;
  readonly nation_id: string | null;
  readonly nation: { readonly name: string } | null;
  readonly notification_type: string;
  readonly settlement_id: string | null;
  readonly settlement: { readonly name: string } | null;
  readonly trade_route_id: string | null;
  readonly world_id: string;
  readonly world: { readonly name: string };
};

export type AllNotification = {
  readonly citizenId: string | null;
  readonly eventId: string | null;
  readonly generatedAt: string;
  readonly generatedInTransitionId: string | null;
  readonly id: string;
  readonly isRead: boolean;
  readonly messageText: string;
  readonly nationId: string | null;
  readonly nationName: string | null;
  readonly notificationType: string;
  readonly settlementId: string | null;
  readonly settlementName: string | null;
  readonly tradeRouteId: string | null;
  readonly worldId: string;
  readonly worldName: string;
};

type AllNotificationsResponse = {
  readonly notifications: readonly AllNotification[];
  readonly total: number;
};

type AllNotificationsQueryKey = ReturnType<
  typeof notificationQueryKeys.allNotifications
>;
type AllNotificationsQueryOptions = UseQueryOptions<
  AllNotificationsResponse,
  AuthUiError,
  AllNotificationsResponse,
  AllNotificationsQueryKey
>;

const TURN_COMPLETED_NOTIFICATION_SELECT =
  "id,world_id,generated_in_transition_id,message_text,is_read,generated_at";
const TURN_COMPLETED_NOTIFICATION_TYPE = "turn.completed";
const ALL_NOTIFICATIONS_SELECT =
  "id,world_id,nation_id,settlement_id,citizen_id,event_id,trade_route_id,notification_type,message_text,is_read,generated_at,generated_in_transition_id,world:worlds!notifications_world_id_fkey(name),nation:nations(name),settlement:settlements(name)";

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

export function allNotificationsQueryOptions(
  userId: string | null,
  filters: AllNotificationsFilters = {},
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): AllNotificationsQueryOptions {
  const limit = filters.limit ?? 20;
  const offset = filters.offset ?? 0;
  const isRead = filters.isRead ?? null;
  const type = filters.type ?? null;
  const worldId = filters.worldId ?? null;
  const nationId = filters.nationId ?? null;
  const settlementId = filters.settlementId ?? null;

  // The client is the configured Supabase singleton in app code; tests inject a fake.
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    enabled: userId !== null,
    queryFn: () =>
      getAllNotifications(
        client,
        userId,
        limit,
        offset,
        isRead,
        type,
        worldId,
        nationId,
        settlementId,
      ),
    queryKey: notificationQueryKeys.allNotifications(
      userId,
      limit,
      offset,
      isRead,
      type,
      worldId,
      nationId,
      settlementId,
    ),
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
    throw normalizeSupabaseError(error);
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
    throw normalizeSupabaseError(error);
  }

  return data.map(toTurnCompletedNotification);
}

async function getAllNotifications(
  client: GubernatorSupabaseClient,
  userId: string | null,
  limit: number,
  offset: number,
  isRead: boolean | null,
  type: string | null,
  worldId: string | null,
  nationId: string | null,
  settlementId: string | null,
): Promise<AllNotificationsResponse> {
  if (userId === null) {
    return { notifications: [], total: 0 };
  }

  let countQuery = client
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_user_id", userId);

  if (isRead !== null) {
    countQuery = countQuery.eq("is_read", isRead);
  }

  if (type !== null) {
    countQuery = countQuery.eq(
      "notification_type",
      type as Database["public"]["Enums"]["notification_type"],
    );
  }

  if (worldId !== null) {
    countQuery = countQuery.eq("world_id", worldId);
  }

  if (nationId !== null) {
    countQuery = countQuery.eq("nation_id", nationId);
  }

  if (settlementId !== null) {
    countQuery = countQuery.eq("settlement_id", settlementId);
  }

  const { count, error: countError } = await countQuery;

  if (countError !== null) {
    throw normalizeSupabaseError(countError);
  }

  let dataQuery = client
    .from("notifications")
    .select(ALL_NOTIFICATIONS_SELECT)
    .eq("recipient_user_id", userId)
    .order("generated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (isRead !== null) {
    dataQuery = dataQuery.eq("is_read", isRead);
  }

  if (type !== null) {
    dataQuery = dataQuery.eq(
      "notification_type",
      type as Database["public"]["Enums"]["notification_type"],
    );
  }

  if (worldId !== null) {
    dataQuery = dataQuery.eq("world_id", worldId);
  }

  if (nationId !== null) {
    dataQuery = dataQuery.eq("nation_id", nationId);
  }

  if (settlementId !== null) {
    dataQuery = dataQuery.eq("settlement_id", settlementId);
  }

  const { data, error } = await dataQuery;

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return {
    notifications: data.map(toAllNotification),
    total: count ?? 0,
  };
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

function toAllNotification(row: AllNotificationRow): AllNotification {
  return {
    citizenId: row.citizen_id,
    eventId: row.event_id,
    generatedAt: row.generated_at,
    generatedInTransitionId: row.generated_in_transition_id,
    id: row.id,
    isRead: row.is_read,
    messageText: row.message_text,
    nationId: row.nation_id,
    nationName: row.nation?.name ?? null,
    notificationType: row.notification_type,
    settlementId: row.settlement_id,
    settlementName: row.settlement?.name ?? null,
    tradeRouteId: row.trade_route_id,
    worldId: row.world_id,
    worldName: row.world.name,
  };
}

export function markNotificationReadMutationOptions(
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): MarkNotificationReadMutationOptions {
  return mutationOptions({
    mutationFn: (notificationId: string) =>
      markNotificationRead(client, notificationId),
  });
}

export function markAllNotificationsReadMutationOptions(
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): MarkAllNotificationsReadMutationOptions {
  return mutationOptions({
    mutationFn: () => markAllNotificationsRead(client),
  });
}

async function markNotificationRead(
  client: GubernatorSupabaseClient,
  notificationId: string,
): Promise<void> {
  const { error } = await client.rpc("mark_notification_read", {
    notification_id: notificationId,
  });

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }
}

async function markAllNotificationsRead(
  client: GubernatorSupabaseClient,
): Promise<void> {
  const { error } = await client.rpc("mark_all_notifications_read");

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }
}
