import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { type JSX, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { currentSessionQueryOptions } from "@/features/auth";
import {
  allNotificationsQueryOptions,
  markNotificationReadMutationOptions,
  type AllNotification,
} from "@/features/notifications";

import { NotificationListItem } from "../components/NotificationListItem";
import { NotificationsPageFrame } from "../components/NotificationsPageFrame";

const PAGE_SIZE = 20;
const NOTIFICATION_TYPES = [
  { value: "all", label: "All types" },
  { value: "turn.completed", label: "Turn completed" },
  { value: "settlement.threat", label: "Settlement threat" },
  { value: "trade.proposed", label: "Trade proposed" },
  { value: "partnership.formed", label: "Partnership formed" },
];

const READ_STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "read", label: "Read" },
];

export function NotificationsPage(): JSX.Element {
  const currentSessionQuery = useQuery(currentSessionQueryOptions());
  const userId = currentSessionQuery.data?.user.id ?? null;

  const [page, setPage] = useState(1);
  const [selectedType, setSelectedType] = useState("all");
  const [readStatus, setReadStatus] = useState("all");

  const offset = (page - 1) * PAGE_SIZE;
  const isRead =
    readStatus === "read" ? true : readStatus === "unread" ? false : null;
  const type = selectedType !== "all" ? selectedType : null;

  const notificationsQuery = useQuery(
    allNotificationsQueryOptions(userId, {
      limit: PAGE_SIZE,
      offset,
      isRead,
      type,
    }),
  );

  const markReadMutation = useMutation(markNotificationReadMutationOptions());

  const handleMarkRead = (notification: AllNotification): void => {
    if (!notification.isRead) {
      markReadMutation.mutate(notification.id, {
        onSuccess: () => {
          void notificationsQuery.refetch();
        },
      });
    }
  };

  const notifications = notificationsQuery.data?.notifications ?? [];
  const total = notificationsQuery.data?.total ?? 0;
  const pageCount = Math.ceil(total / PAGE_SIZE);

  return (
    <NotificationsPageFrame>
      <div className="flex flex-col gap-4">
        {/* Filters */}
        <div className="flex gap-3">
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              {NOTIFICATION_TYPES.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={readStatus} onValueChange={setReadStatus}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              {READ_STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Notifications List */}
        <div className="border rounded-lg divide-y">
          {notificationsQuery.isLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No notifications found
            </div>
          ) : (
            notifications.map((notification) => (
              <NotificationListItem
                key={notification.id}
                notification={notification}
                onMarkRead={() => handleMarkRead(notification)}
                isMarkingRead={markReadMutation.isPending}
              />
            ))
          )}
        </div>

        {/* Pagination */}
        {pageCount > 1 ? (
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {offset + 1} to {Math.min(offset + PAGE_SIZE, total)} of{" "}
              {total} notifications
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1 || notificationsQuery.isLoading}
              >
                <ChevronLeft className="size-4" />
                Previous
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: pageCount }, (_, i) => i + 1)
                  .slice(Math.max(0, page - 3), page + 2)
                  .map((p) => (
                    <Button
                      key={p}
                      variant={p === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPage(p)}
                      disabled={notificationsQuery.isLoading}
                      className="min-w-9"
                    >
                      {p}
                    </Button>
                  ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.min(pageCount, page + 1))}
                disabled={page === pageCount || notificationsQuery.isLoading}
              >
                Next
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </NotificationsPageFrame>
  );
}
