import { authStateQueryCacheKeys } from "@/lib/authStateQueryCache";

export const notificationQueryKeys = {
  all: authStateQueryCacheKeys.notificationsAll,
  turnCompleted: (userId: string | null, worldId: string | null = null) =>
    [...notificationQueryKeys.all, "turn-completed", userId, worldId] as const,
  unreadCount: (userId: string | null) =>
    [...notificationQueryKeys.all, "unread-count", userId] as const,
} as const;
