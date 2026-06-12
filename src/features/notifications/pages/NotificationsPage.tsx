import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { nationsListQueryOptions } from "@/features/nations";
import {
  allNotificationsQueryOptions,
  markNotificationReadMutationOptions,
  type AllNotification,
} from "@/features/notifications";
import { currentAccessContextQueryOptions } from "@/features/permissions";
import { settlementsByWorldQueryOptions } from "@/features/settlements";
import { accessibleWorldsQueryOptions } from "@/features/worlds";

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
  const queryClient = useQueryClient();
  const accessContextQuery = useQuery(
    currentAccessContextQueryOptions(queryClient),
  );
  const currentSessionQuery = useQuery(currentSessionQueryOptions());
  const userId = currentSessionQuery.data?.user.id ?? null;

  const [page, setPage] = useState(1);
  const [selectedType, setSelectedType] = useState("all");
  const [readStatus, setReadStatus] = useState("all");
  const [selectedWorldId, setSelectedWorldId] = useState<string | null>(null);
  const [selectedNationId, setSelectedNationId] = useState<string | null>(null);
  const [selectedSettlementId, setSelectedSettlementId] = useState<
    string | null
  >(null);

  const accessContext = accessContextQuery.data ?? null;

  const worldsQuery = useQuery({
    ...accessibleWorldsQueryOptions(
      accessContext ?? {
        canAccessWorld: () => false,
        canAdminWorld: () => false,
        isActiveUser: false,
        isAuthenticated: false,
        isSuperAdmin: false,
        userId: null,
        worldAdminWorldIds: [],
        playerCharacterWorldIds: [],
      },
    ),
    enabled: accessContext !== null,
  });

  const nationsQuery = useQuery({
    ...nationsListQueryOptions(selectedWorldId ?? ""),
    enabled: selectedWorldId !== null,
  });

  const settlementsQuery = useQuery({
    ...settlementsByWorldQueryOptions(selectedWorldId ?? ""),
    enabled: selectedWorldId !== null,
  });

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
      worldId: selectedWorldId,
      nationId: selectedNationId,
      settlementId: selectedSettlementId,
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

  const handleWorldChange = (value: string): void => {
    const worldId = value === "all" ? null : value;
    setSelectedWorldId(worldId);
    setSelectedNationId(null);
    setSelectedSettlementId(null);
    setPage(1);
  };

  const handleNationChange = (value: string): void => {
    setSelectedNationId(value === "all" ? null : value);
    setPage(1);
  };

  const handleSettlementChange = (value: string): void => {
    setSelectedSettlementId(value === "all" ? null : value);
    setPage(1);
  };

  const handleTypeChange = (value: string): void => {
    setSelectedType(value);
    setPage(1);
  };

  const handleReadStatusChange = (value: string): void => {
    setReadStatus(value);
    setPage(1);
  };

  const worlds = worldsQuery.data ?? [];
  const nations = nationsQuery.data ?? [];
  const settlements = settlementsQuery.data ?? [];
  const notifications = notificationsQuery.data?.notifications ?? [];
  const total = notificationsQuery.data?.total ?? 0;
  const pageCount = Math.ceil(total / PAGE_SIZE);

  return (
    <NotificationsPageFrame>
      <div className="flex flex-col gap-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <Select value={selectedType} onValueChange={handleTypeChange}>
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

          <Select value={readStatus} onValueChange={handleReadStatusChange}>
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

          <Select
            value={selectedWorldId ?? "all"}
            onValueChange={handleWorldChange}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All worlds" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All worlds</SelectItem>
              {worlds.map((world) => (
                <SelectItem key={world.id} value={world.id}>
                  {world.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={selectedNationId ?? "all"}
            onValueChange={handleNationChange}
            disabled={selectedWorldId === null}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All nations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All nations</SelectItem>
              {nations.map((nation) => (
                <SelectItem key={nation.id} value={nation.id}>
                  {nation.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={selectedSettlementId ?? "all"}
            onValueChange={handleSettlementChange}
            disabled={selectedWorldId === null}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All settlements" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All settlements</SelectItem>
              {settlements.map((settlement) => (
                <SelectItem key={settlement.id} value={settlement.id}>
                  {settlement.name}
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
