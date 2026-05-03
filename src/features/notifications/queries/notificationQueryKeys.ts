import { authStateQueryCacheKeys } from "@/lib/authStateQueryCache";

export const notificationQueryKeys = {
  all: authStateQueryCacheKeys.notificationsAll,
  unreadCount: (userId: string | null) =>
    [...notificationQueryKeys.all, "unread-count", userId] as const,
} as const;
