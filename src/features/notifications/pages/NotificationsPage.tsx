import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { type JSX, useState } from "react";

import { ErrorState } from "@/components/shared/ErrorState";
import { CardListSkeleton } from "@/components/shared/SkeletonLoaders";
import { TablePagination } from "@/components/shared/TablePagination";
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
  worldCalendarConfigQueryOptions,
  type WorldCalendarConfig,
} from "@/features/calendar";
import { nationsListQueryOptions } from "@/features/nations";
import {
  allNotificationsQueryOptions,
  markNotificationReadMutationOptions,
  unreadNotificationsCountQueryOptions,
  useMarkAllNotificationsRead,
  type AllNotification,
} from "@/features/notifications";
import {
  currentAccessContextQueryOptions,
  type AccessContext,
} from "@/features/permissions";
import { settlementsByWorldQueryOptions } from "@/features/settlements";
import { accessibleWorldsQueryOptions } from "@/features/worlds";
import { getErrorDescription } from "@/lib/errorUtils";

import { NotificationListItem } from "../components/NotificationListItem";
import { NotificationPreferencesSheet } from "../components/NotificationPreferencesSheet";
import { NotificationsPageFrame } from "../components/NotificationsPageFrame";
import { formatTransitionHeading } from "../utils/formatTransitionHeading";
import { groupNotificationsByTransition } from "../utils/groupNotificationsByTransition";
import { NOTIFICATION_TYPE_OPTIONS } from "../utils/notificationTypeLabels";

const PAGE_SIZE = 20;

const READ_STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "unread", label: "Unread" },
  { value: "read", label: "Read" },
];

const SEVERITY_OPTIONS = [
  { value: "all", label: "All severities" },
  { value: "critical", label: "Critical" },
  { value: "warning", label: "Warning" },
  { value: "info", label: "Info" },
];

export function NotificationsPage(): JSX.Element {
  const queryClient = useQueryClient();
  const accessContextQuery = useQuery(
    currentAccessContextQueryOptions(queryClient),
  );

  if (accessContextQuery.isPending) {
    return (
      <NotificationsPageFrame>
        <CardListSkeleton rowCount={6} />
      </NotificationsPageFrame>
    );
  }

  if (accessContextQuery.isError) {
    return (
      <NotificationsPageFrame>
        <ErrorState
          title="Notifications could not be loaded"
          description={getErrorDescription(accessContextQuery.error)}
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void accessContextQuery.refetch();
              }}
            >
              Try again
            </Button>
          }
        />
      </NotificationsPageFrame>
    );
  }

  return <NotificationsPageContent accessContext={accessContextQuery.data} />;
}

type NotificationsPageContentProps = {
  readonly accessContext: AccessContext;
};

function NotificationsPageContent({
  accessContext,
}: NotificationsPageContentProps): JSX.Element {
  const queryClient = useQueryClient();
  const currentSessionQuery = useQuery(currentSessionQueryOptions());
  const userId = currentSessionQuery.data?.user.id ?? null;

  const [page, setPage] = useState(1);
  const [selectedType, setSelectedType] = useState("all");
  const [readStatus, setReadStatus] = useState("all");
  const [selectedSeverity, setSelectedSeverity] = useState("all");
  const [selectedWorldId, setSelectedWorldId] = useState<string | null>(null);
  const [selectedNationId, setSelectedNationId] = useState<string | null>(null);
  const [selectedSettlementId, setSelectedSettlementId] = useState<
    string | null
  >(null);

  const worldsQuery = useQuery(accessibleWorldsQueryOptions(accessContext));

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
  const severity = selectedSeverity !== "all" ? selectedSeverity : null;

  const notificationsQuery = useQuery(
    allNotificationsQueryOptions(userId, {
      limit: PAGE_SIZE,
      offset,
      isRead,
      type,
      severity,
      worldId: selectedWorldId,
      nationId: selectedNationId,
      settlementId: selectedSettlementId,
    }),
  );

  const unreadCountQuery = useQuery(
    unreadNotificationsCountQueryOptions(userId),
  );
  const unreadCount = unreadCountQuery.data ?? 0;

  const markReadMutation = useMutation(
    markNotificationReadMutationOptions({ queryClient }),
  );
  const { handleMarkAllRead, isPending: isMarkingAllRead } =
    useMarkAllNotificationsRead();

  const handleMarkRead = (notification: AllNotification): void => {
    if (!notification.isRead) {
      markReadMutation.mutate(notification.id);
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
    setSelectedSettlementId(null);
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

  const handleSeverityChange = (value: string): void => {
    setSelectedSeverity(value);
    setPage(1);
  };

  const worlds = worldsQuery.data ?? [];
  const nations = nationsQuery.data ?? [];
  const settlements = settlementsQuery.data ?? [];
  const filteredSettlements =
    selectedNationId !== null
      ? settlements.filter((s) => s.nationId === selectedNationId)
      : settlements;
  const notifications = notificationsQuery.data?.notifications ?? [];
  const total = notificationsQuery.data?.total ?? 0;
  const pageCount = Math.ceil(total / PAGE_SIZE);

  const groups = groupNotificationsByTransition(notifications);
  const calendarWorldIds = Array.from(
    new Set(
      groups
        .map((group) => group.worldId)
        .filter((worldId): worldId is string => worldId !== null),
    ),
  );
  const calendarQueries = useQueries({
    queries: calendarWorldIds.map((worldId) =>
      worldCalendarConfigQueryOptions(worldId),
    ),
  });
  const calendarConfigByWorldId = new Map<string, WorldCalendarConfig | null>(
    calendarWorldIds.map((worldId, index) => [
      worldId,
      calendarQueries[index]?.data ?? null,
    ]),
  );

  return (
    <NotificationsPageFrame
      actions={<NotificationPreferencesSheet userId={userId} />}
    >
      <div className="flex flex-col gap-4">
        {/* Filters */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap gap-3">
            <Select value={selectedType} onValueChange={handleTypeChange}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                {NOTIFICATION_TYPE_OPTIONS.map((option) => (
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
              value={selectedSeverity}
              onValueChange={handleSeverityChange}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by severity" />
              </SelectTrigger>
              <SelectContent>
                {SEVERITY_OPTIONS.map((option) => (
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
                {filteredSettlements.map((settlement) => (
                  <SelectItem key={settlement.id} value={settlement.id}>
                    {settlement.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {unreadCount > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllRead}
              disabled={isMarkingAllRead}
              className="shrink-0"
            >
              Mark all as read
            </Button>
          ) : null}
        </div>

        {/* Notifications List */}
        <div className="divide-y rounded-lg border">
          {notificationsQuery.isLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No notifications found
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.key}>
                <div className="bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  {formatTransitionHeading(
                    group,
                    group.worldId !== null
                      ? (calendarConfigByWorldId.get(group.worldId) ?? null)
                      : null,
                  )}
                </div>
                <div className="divide-y">
                  {group.notifications.map((notification) => (
                    <NotificationListItem
                      key={notification.id}
                      notification={notification}
                      onMarkRead={() => {
                        handleMarkRead(notification);
                      }}
                      isMarkingRead={markReadMutation.isPending}
                    />
                  ))}
                </div>
              </div>
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
            <TablePagination
              page={page - 1}
              pageCount={pageCount}
              onPageChange={(nextPage) => {
                setPage(nextPage + 1);
              }}
              isDisabled={notificationsQuery.isLoading}
            />
          </div>
        ) : null}
      </div>
    </NotificationsPageFrame>
  );
}
