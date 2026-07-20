import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bell, Check, ChevronRight } from "lucide-react";
import { type JSX, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { currentSessionQueryOptions } from "@/features/auth";
import {
  allNotificationsQueryOptions,
  formatUnreadBadgeCount,
  getDeepLink,
  markNotificationReadMutationOptions,
  NotificationPreferencesSheet,
  unreadNotificationsCountQueryOptions,
  useMarkAllNotificationsRead,
  useNotificationsRealtime,
} from "@/features/notifications";
import { formatRelativeTime } from "@/lib/formatDate";

type NotificationsPopoverProps = {
  readonly className?: string;
};

export function NotificationsPopover({
  className,
}: NotificationsPopoverProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const currentSessionQuery = useQuery(currentSessionQueryOptions());
  const userId = currentSessionQuery.data?.user.id ?? null;

  useNotificationsRealtime(userId);

  const unreadCountQuery = useQuery(
    unreadNotificationsCountQueryOptions(userId),
  );
  const unreadCount = unreadCountQuery.data ?? 0;

  const notificationsQuery = useQuery(
    allNotificationsQueryOptions(userId, { isRead: false }),
  );
  const notifications = notificationsQuery.data?.notifications ?? [];

  const markReadMutation = useMutation(
    markNotificationReadMutationOptions({ queryClient }),
  );

  const { handleMarkAllRead, isPending: isMarkingAllRead } =
    useMarkAllNotificationsRead();

  const handleMarkRead = (notificationId: string): void => {
    markReadMutation.mutate(notificationId);
  };

  const badgeText = formatUnreadBadgeCount(unreadCount);
  const notificationLabel =
    unreadCount > 0
      ? `Notifications (${badgeText} unread)`
      : ("Notifications" as const);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={notificationLabel}
          className={`relative ${className ?? ""}`}
        >
          <Bell className="size-4" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[0.625rem] font-medium leading-none text-destructive-foreground">
              {badgeText}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0">
        <div className="flex flex-col">
          <div className="border-b px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold">Notifications</h2>
                <p className="text-xs text-muted-foreground">
                  Showing unread only
                </p>
              </div>
              {unreadCount > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMarkAllRead}
                  disabled={isMarkingAllRead}
                >
                  Mark all as read
                </Button>
              ) : null}
            </div>
          </div>
          <ScrollArea className="h-96">
            <div className="flex flex-col">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No notifications
                </div>
              ) : (
                notifications.map((notification) => {
                  const deepLink = getDeepLink(notification);
                  const contextParts = [
                    notification.worldName,
                    notification.nationName,
                    notification.settlementName,
                  ].filter((name): name is string => name !== null);
                  return (
                    <div
                      key={notification.id}
                      className={`border-b px-4 py-3 transition-colors hover:bg-muted ${
                        !notification.isRead ? "bg-muted/50" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5">
                            {!notification.isRead ? (
                              <span
                                aria-hidden="true"
                                className="size-2 shrink-0 rounded-full bg-primary"
                              />
                            ) : null}
                            <p className="text-sm">
                              {notification.messageText}
                            </p>
                          </div>
                          {contextParts.length > 0 ? (
                            <p className="text-xs text-muted-foreground">
                              {contextParts.join(" · ")}
                            </p>
                          ) : null}
                          <p className="text-xs text-muted-foreground">
                            {formatRelativeTime(notification.generatedAt)}
                          </p>
                        </div>
                        {!notification.isRead ? (
                          <div className="flex shrink-0 items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMarkRead(notification.id)}
                              disabled={markReadMutation.isPending}
                              aria-label="Mark as read"
                              className="shrink-0"
                            >
                              <Check className="size-4" />
                            </Button>
                            {deepLink !== null ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={markReadMutation.isPending}
                                aria-label={deepLink.label}
                                className="shrink-0"
                                asChild
                              >
                                <Link
                                  to={deepLink.href}
                                  onClick={() =>
                                    handleMarkRead(notification.id)
                                  }
                                >
                                  <ChevronRight className="size-4" />
                                </Link>
                              </Button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
          <div className="flex items-center gap-2 border-t px-4 py-2">
            <Button variant="ghost" className="flex-1" size="sm" asChild>
              <Link to="/notifications" onClick={() => setOpen(false)}>
                View all notifications
              </Link>
            </Button>
            <NotificationPreferencesSheet userId={userId} />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
