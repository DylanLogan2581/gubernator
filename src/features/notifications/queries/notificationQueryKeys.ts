import { authStateQueryCacheKeys } from "@/lib/authStateQueryCache";

export const notificationQueryKeys = {
  all: authStateQueryCacheKeys.notificationsAll,
  allNotifications: (
    userId: string | null,
    limit: number,
    offset: number,
    isRead: boolean | null = null,
    type: string | null = null,
  ) =>
    [
      ...notificationQueryKeys.all,
      "all",
      userId,
      limit,
      offset,
      isRead,
      type,
    ] as const,
  turnCompleted: (userId: string | null, worldId: string | null = null) =>
    [...notificationQueryKeys.all, "turn-completed", userId, worldId] as const,
  unreadCount: (userId: string | null) =>
    [...notificationQueryKeys.all, "unread-count", userId] as const,
} as const;
