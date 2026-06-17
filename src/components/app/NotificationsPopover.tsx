import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bell, ChevronRight, X } from "lucide-react";
import { type JSX } from "react";

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
  getDeepLink,
  markAllNotificationsReadMutationOptions,
  markNotificationReadMutationOptions,
  notificationQueryKeys,
} from "@/features/notifications";

type NotificationsPopoverProps = {
  readonly className?: string;
};

export function NotificationsPopover({
  className,
}: NotificationsPopoverProps): JSX.Element {
  const queryClient = useQueryClient();
  const currentSessionQuery = useQuery(currentSessionQueryOptions());
  const userId = currentSessionQuery.data?.user.id ?? null;

  const notificationsQuery = useQuery(
    allNotificationsQueryOptions(userId, { isRead: false }),
  );
  const unreadCount = notificationsQuery.data?.total ?? 0;
  const notifications = notificationsQuery.data?.notifications ?? [];

  const markReadMutation = useMutation(markNotificationReadMutationOptions());

  const markAllReadMutation = useMutation(
    markAllNotificationsReadMutationOptions(),
  );

  const handleMarkRead = (notificationId: string): void => {
    markReadMutation.mutate(notificationId, {
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: notificationQueryKeys.all,
        });
      },
    });
  };

  const handleMarkAllRead = (): void => {
    markAllReadMutation.mutate(undefined, {
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: notificationQueryKeys.all,
        });
      },
    });
  };

  const badgeText = unreadCount > 99 ? "99+" : unreadCount.toString();
  const notificationLabel =
    unreadCount > 0
      ? `Notifications (${badgeText} unread)`
      : ("Notifications" as const);

  return (
    <Popover>
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
              <h2 className="font-semibold">Notifications</h2>
              {unreadCount > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMarkAllRead}
                  disabled={markAllReadMutation.isPending}
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
                  return (
                    <div
                      key={notification.id}
                      className={`border-b px-4 py-3 transition-colors hover:bg-muted ${
                        !notification.isRead ? "bg-muted/50" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="text-sm">{notification.messageText}</p>
                          <p className="text-xs text-muted-foreground">
                            {/* eslint-disable-next-line no-restricted-syntax */}
                            {new Date(
                              notification.generatedAt,
                            ).toLocaleString()}
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
                              <X className="size-4" />
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
          <div className="border-t px-4 py-2">
            <Button variant="ghost" className="w-full" size="sm" asChild>
              <Link to="/notifications">View all notifications</Link>
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
