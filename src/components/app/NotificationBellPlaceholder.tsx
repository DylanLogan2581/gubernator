import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { type JSX } from "react";

import { Button } from "@/components/ui/button";
import { currentSessionQueryOptions } from "@/features/auth";
import { unreadNotificationsCountQueryOptions } from "@/features/notifications";

export function NotificationBellPlaceholder(): JSX.Element {
  const currentSessionQuery = useQuery(currentSessionQueryOptions());
  const userId = currentSessionQuery.data?.user.id ?? null;
  const unreadCountQuery = useQuery(
    unreadNotificationsCountQueryOptions(userId),
  );
  const unreadCount = unreadCountQuery.data ?? 0;
  const badgeText = unreadCount > 99 ? "99+" : unreadCount.toString();
  const notificationLabel =
    unreadCount > 0
      ? `Notifications (${badgeText} unread)`
      : "Notifications (not yet available)";

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={notificationLabel}
      className="relative"
      disabled
    >
      <Bell className="size-4" />
      {unreadCount > 0 ? (
        <span className="absolute -right-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[0.625rem] font-medium leading-none text-destructive-foreground">
          {badgeText}
        </span>
      ) : null}
    </Button>
  );
}
