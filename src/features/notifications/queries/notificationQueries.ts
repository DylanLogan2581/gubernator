import {
  mutationOptions,
  queryOptions,
  type QueryClient,
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
  readonly includeTotal?: boolean;
  readonly isRead?: boolean | null;
  readonly limit?: number;
  readonly nationId?: string | null;
  readonly offset?: number;
  readonly settlementId?: string | null;
  readonly severity?: string | null;
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

type AllNotificationTransitionRow = {
  readonly to_turn_number: number;
  readonly finished_at: string | null;
  readonly started_at: string;
};

type AllNotificationTradeRouteRow = {
  readonly origin_settlement: {
    readonly id: string;
    readonly name: string;
    readonly nation_id: string;
  };
};

type AllNotificationRow = {
  readonly citizen_id: string | null;
  readonly citizen: { readonly name: string | null } | null;
  readonly event_id: string | null;
  readonly event: { readonly name: string } | null;
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
  readonly severity: Database["public"]["Enums"]["notification_severity"];
  readonly trade_route_id: string | null;
  readonly trade_route: AllNotificationTradeRouteRow | null;
  readonly transition: AllNotificationTransitionRow | null;
  readonly world_id: string;
  readonly world: { readonly name: string };
};

export type AllNotificationTransition = {
  readonly toTurnNumber: number;
  readonly finishedAt: string | null;
  readonly startedAt: string;
};

export type AllNotificationTradeRoute = {
  readonly originSettlementId: string;
  readonly originSettlementName: string;
  readonly originNationId: string;
};

export type AllNotification = {
  readonly citizenId: string | null;
  readonly citizenName: string | null;
  readonly eventId: string | null;
  readonly eventName: string | null;
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
  readonly severity: Database["public"]["Enums"]["notification_severity"];
  readonly tradeRouteId: string | null;
  readonly tradeRoute: AllNotificationTradeRoute | null;
  readonly transition: AllNotificationTransition | null;
  readonly worldId: string;
  readonly worldName: string;
};

type AllNotificationsResponse = {
  readonly notifications: readonly AllNotification[];
  // 0 when the caller passed includeTotal: false — the count query is
  // skipped, so this isn't a real "zero results" signal.
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
  "id,world_id,nation_id,settlement_id,citizen_id,event_id,trade_route_id,notification_type,severity,message_text,is_read,generated_at,generated_in_transition_id,world:worlds!notifications_world_id_fkey(name),nation:nations(name),settlement:settlements(name),citizen:citizens(name),event:events(name),transition:turn_transitions!notifications_transition_world_fkey(to_turn_number,finished_at,started_at),trade_route:trade_routes(origin_settlement:settlements!trade_routes_origin_settlement_id_fkey(id,name,nation_id))";

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
  const severity = filters.severity ?? null;
  const worldId = filters.worldId ?? null;
  const nationId = filters.nationId ?? null;
  const settlementId = filters.settlementId ?? null;
  const includeTotal = filters.includeTotal ?? true;

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
        severity,
        worldId,
        nationId,
        settlementId,
        includeTotal,
      ),
    queryKey: notificationQueryKeys.allNotifications(
      userId,
      limit,
      offset,
      isRead,
      type,
      severity,
      worldId,
      nationId,
      settlementId,
      includeTotal,
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

  const disabledTypes = await getDisabledNotificationTypes(client, userId);

  let query = client
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_user_id", userId)
    .eq("is_read", false);

  if (disabledTypes.length > 0) {
    query = query.not(
      "notification_type",
      "in",
      `(${disabledTypes.join(",")})`,
    );
  }

  const { count, error } = await query;

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return count ?? 0;
}

/**
 * Notification types the user has muted via notification_preferences.
 * Filtering happens here (server-side, via a `not(... in ...)` clause built
 * from this list) rather than by fetching every row and filtering in JS.
 */
async function getDisabledNotificationTypes(
  client: GubernatorSupabaseClient,
  userId: string,
): Promise<readonly string[]> {
  const { data, error } = await client
    .from("notification_preferences")
    .select("notification_type")
    .eq("user_id", userId)
    .eq("enabled", false);

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map((row) => row.notification_type);
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

  const { data, error } = await query
    .order("generated_at", { ascending: false })
    .order("id", { ascending: false });

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
  severity: string | null,
  worldId: string | null,
  nationId: string | null,
  settlementId: string | null,
  includeTotal: boolean,
): Promise<AllNotificationsResponse> {
  if (userId === null) {
    return { notifications: [], total: 0 };
  }

  const disabledTypes = await getDisabledNotificationTypes(client, userId);

  let count = 0;

  if (includeTotal) {
    let countQuery = client
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_user_id", userId);

    if (disabledTypes.length > 0) {
      countQuery = countQuery.not(
        "notification_type",
        "in",
        `(${disabledTypes.join(",")})`,
      );
    }

    if (isRead !== null) {
      countQuery = countQuery.eq("is_read", isRead);
    }

    if (type !== null) {
      countQuery = countQuery.eq(
        "notification_type",
        type as Database["public"]["Enums"]["notification_type"],
      );
    }

    if (severity !== null) {
      countQuery = countQuery.eq(
        "severity",
        severity as Database["public"]["Enums"]["notification_severity"],
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

    const { count: exactCount, error: countError } = await countQuery;

    if (countError !== null) {
      throw normalizeSupabaseError(countError);
    }

    count = exactCount ?? 0;
  }

  let dataQuery = client
    .from("notifications")
    .select(ALL_NOTIFICATIONS_SELECT)
    .eq("recipient_user_id", userId)
    .order("generated_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + limit - 1);

  if (disabledTypes.length > 0) {
    dataQuery = dataQuery.not(
      "notification_type",
      "in",
      `(${disabledTypes.join(",")})`,
    );
  }

  if (isRead !== null) {
    dataQuery = dataQuery.eq("is_read", isRead);
  }

  if (type !== null) {
    dataQuery = dataQuery.eq(
      "notification_type",
      type as Database["public"]["Enums"]["notification_type"],
    );
  }

  if (severity !== null) {
    dataQuery = dataQuery.eq(
      "severity",
      severity as Database["public"]["Enums"]["notification_severity"],
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
    total: count,
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
  const tradeRoute = row.trade_route ?? null;
  const transition = row.transition ?? null;

  return {
    citizenId: row.citizen_id,
    citizenName: row.citizen?.name ?? null,
    eventId: row.event_id,
    eventName: row.event?.name ?? null,
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
    severity: row.severity,
    tradeRouteId: row.trade_route_id,
    tradeRoute:
      tradeRoute !== null
        ? {
            originSettlementId: tradeRoute.origin_settlement.id,
            originSettlementName: tradeRoute.origin_settlement.name,
            originNationId: tradeRoute.origin_settlement.nation_id,
          }
        : null,
    transition:
      transition !== null
        ? {
            toTurnNumber: transition.to_turn_number,
            finishedAt: transition.finished_at,
            startedAt: transition.started_at,
          }
        : null,
    worldId: row.world_id,
    worldName: row.world.name,
  };
}

export function markNotificationReadMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): MarkNotificationReadMutationOptions {
  return mutationOptions({
    mutationFn: (notificationId: string) =>
      markNotificationRead(client, notificationId),
    onSuccess: async (): Promise<void> => {
      await queryClient.invalidateQueries({
        queryKey: notificationQueryKeys.all,
      });
    },
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
