import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState, type JSX } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { nationsListQueryOptions } from "@/features/nations";
import { settlementsByWorldQueryOptions } from "@/features/settlements";

import { eventsListQueryOptions, isEventsError } from "../queries/eventQueries";

type PaginationState = {
  readonly pageIndex: number;
  readonly pageSize: number;
};

/**
 * Display item: either a single ungrouped event or a group of events with the same event_group_id
 */
type EventDisplayItem =
  | {
      readonly type: "single";
      readonly event: EventWithGroup;
    }
  | {
      readonly type: "group";
      readonly groupId: string;
      readonly events: readonly EventWithGroup[];
    };

import type {
  EventListFilters,
  EventStatus,
  EventWithGroup,
} from "../types/eventTypes";

type EventsListProps = {
  readonly worldId: string;
  readonly canCreate: boolean;
  readonly onCreateClick: () => void;
};

const EVENT_STATUSES: EventStatus[] = [
  "pending",
  "active",
  "expired",
  "cancelled",
];

const statusColors: Record<EventStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  active: "bg-green-100 text-green-800",
  expired: "bg-gray-100 text-gray-800",
  cancelled: "bg-red-100 text-red-800",
};

/**
 * Group events by event_group_id. Events without a group stay as individual display items.
 */
function groupEvents(events: readonly EventWithGroup[]): EventDisplayItem[] {
  const grouped = new Map<string, EventWithGroup[]>();

  for (const event of events) {
    const key = event.event_group_id ?? `__ungrouped_${event.id}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    const group = grouped.get(key);
    if (group !== undefined) {
      group.push(event);
    }
  }

  const displayItems: EventDisplayItem[] = [];
  for (const [key, eventsList] of grouped) {
    const firstEvent = eventsList[0];

    if (key.startsWith("__ungrouped_")) {
      // Single ungrouped event
      if (firstEvent !== undefined) {
        displayItems.push({ type: "single", event: firstEvent });
      }
    } else {
      // Grouped events
      displayItems.push({ type: "group", groupId: key, events: eventsList });
    }
  }

  return displayItems;
}

export function EventsList({
  worldId,
  canCreate,
  onCreateClick,
}: EventsListProps): JSX.Element {
  const [statusFilter, setStatusFilter] = useState<EventStatus[]>([]);
  const [sortBy, setSortBy] = useState<"status" | "created_at">("created_at");
  const [scopeEntityFilter, setScopeEntityFilter] = useState<
    { readonly type: "nation" | "settlement"; readonly id: string } | undefined
  >(undefined);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  // Fetch nations and settlements for scope filter dropdowns
  const nationsQuery = useQuery(nationsListQueryOptions(worldId));
  const settlementsQuery = useQuery(settlementsByWorldQueryOptions(worldId));

  const filters: EventListFilters = {
    statusFilter: statusFilter.length > 0 ? statusFilter : undefined,
    sortBy,
    scopeEntityFilter,
  };

  const eventsQuery = useQuery(eventsListQueryOptions(worldId, filters));

  if (eventsQuery.isPending) {
    return <LoadingState label="Loading events…" />;
  }

  if (eventsQuery.isError) {
    if (isEventsError(eventsQuery.error)) {
      return (
        <ErrorState
          title="Events error"
          description={eventsQuery.error.message}
        />
      );
    }
    return (
      <ErrorState
        title="Failed to load events"
        description="Please try again"
      />
    );
  }

  const events = eventsQuery.data ?? [];
  const displayItems = groupEvents(events);
  const paginatedItems = displayItems.slice(
    pagination.pageIndex * pagination.pageSize,
    (pagination.pageIndex + 1) * pagination.pageSize,
  );
  const pageCount = Math.ceil(displayItems.length / pagination.pageSize);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select
            value={statusFilter.length === 0 ? "all" : statusFilter[0]}
            onValueChange={(value) => {
              if (value === "all") {
                setStatusFilter([]);
              } else {
                setStatusFilter([value as EventStatus]);
              }
              setPagination({ pageIndex: 0, pageSize: 10 });
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {EVENT_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={sortBy}
            onValueChange={(value) => {
              setSortBy(value as "status" | "created_at");
              setPagination({ pageIndex: 0, pageSize: 10 });
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created_at">Sort by Created Date</SelectItem>
              <SelectItem value="status">Sort by Status</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={
              scopeEntityFilter !== undefined
                ? `${scopeEntityFilter.type}:${scopeEntityFilter.id}`
                : "all"
            }
            onValueChange={(value) => {
              if (value === "all") {
                setScopeEntityFilter(undefined);
              } else {
                const [type, id] = value.split(":");
                setScopeEntityFilter({
                  type: type as "nation" | "settlement",
                  id,
                });
              }
              setPagination({ pageIndex: 0, pageSize: 10 });
            }}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by scope entity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All entities</SelectItem>
              {nationsQuery.data !== undefined &&
                nationsQuery.data.length > 0 && (
                  <>
                    {nationsQuery.data.map((nation) => (
                      <SelectItem
                        key={`nation:${nation.id}`}
                        value={`nation:${nation.id}`}
                      >
                        {nation.name}
                      </SelectItem>
                    ))}
                  </>
                )}
              {settlementsQuery.data !== undefined &&
                settlementsQuery.data.length > 0 && (
                  <>
                    {settlementsQuery.data.map((settlement) => (
                      <SelectItem
                        key={`settlement:${settlement.id}`}
                        value={`settlement:${settlement.id}`}
                      >
                        {settlement.name} ({settlement.nationName})
                      </SelectItem>
                    ))}
                  </>
                )}
            </SelectContent>
          </Select>
        </div>

        {canCreate && (
          <Button onClick={onCreateClick} size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Create event
          </Button>
        )}
      </div>

      {events.length === 0 ? (
        <EmptyState
          title="No events yet"
          description={
            canCreate
              ? "Create your first event to get started."
              : "No events exist in this world."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedItems.map((item) =>
                item.type === "single" ? (
                  <EventRow
                    key={item.event.id}
                    event={item.event}
                    worldId={worldId}
                  />
                ) : (
                  <GroupedEventRow
                    key={item.groupId}
                    groupId={item.groupId}
                    events={item.events}
                    worldId={worldId}
                  />
                ),
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {pageCount > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() =>
                  pagination.pageIndex > 0 &&
                  setPagination((p) => ({
                    ...p,
                    pageIndex: Math.max(0, p.pageIndex - 1),
                  }))
                }
                className={
                  pagination.pageIndex === 0
                    ? "pointer-events-none opacity-50"
                    : ""
                }
              />
            </PaginationItem>

            {Array.from({ length: pageCount }).map((_, i) => (
              // eslint-disable-next-line @eslint-react/no-array-index-key
              <PaginationItem key={i}>
                <PaginationLink
                  isActive={pagination.pageIndex === i}
                  onClick={() => setPagination((p) => ({ ...p, pageIndex: i }))}
                >
                  {i + 1}
                </PaginationLink>
              </PaginationItem>
            ))}

            <PaginationItem>
              <PaginationNext
                onClick={() =>
                  pagination.pageIndex < pageCount - 1 &&
                  setPagination((p) => ({
                    ...p,
                    pageIndex: Math.min(pageCount - 1, p.pageIndex + 1),
                  }))
                }
                className={
                  pagination.pageIndex >= pageCount - 1
                    ? "pointer-events-none opacity-50"
                    : ""
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}

function EventRow({
  event,
  worldId,
}: {
  readonly event: EventWithGroup;
  readonly worldId: string;
}): JSX.Element {
  const navigate = useNavigate();
  const displayName = event.group?.name ?? event.name;

  return (
    <TableRow
      className="cursor-pointer hover:bg-muted"
      onClick={() => {
        void navigate({
          to: "/worlds/$worldId/events/$eventId",
          params: { worldId, eventId: event.id },
        });
      }}
    >
      <TableCell className="font-medium">{displayName}</TableCell>
      <TableCell>
        <Badge className={statusColors[event.status]}>{event.status}</Badge>
      </TableCell>
      <TableCell className="capitalize">{event.scope_type}</TableCell>
      <TableCell>
        {event.duration_type === "sustained"
          ? `${event.remaining_transitions}/${event.duration_transitions} turns`
          : "Instant"}
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}></TableCell>
    </TableRow>
  );
}

/**
 * Render an event group as a single table row.
 * Displays the group name, status, scope, and target count.
 * Clicking navigates to the first event in the group.
 */
function GroupedEventRow({
  events,
  worldId,
}: {
  readonly groupId?: string;
  readonly events: readonly EventWithGroup[];
  readonly worldId: string;
}): JSX.Element | null {
  const navigate = useNavigate();
  // Use first event as representative for name, status, effect type, duration
  const firstEvent = events[0];

  if (firstEvent === undefined) {
    return null;
  }

  const displayName = firstEvent.group?.name ?? firstEvent.name;
  const targetCount = events.length;
  const scopeLabel =
    firstEvent.scope_type === "settlement"
      ? `${targetCount} settlement${targetCount > 1 ? "s" : ""}`
      : firstEvent.scope_type === "nation"
        ? `${targetCount} nation${targetCount > 1 ? "s" : ""}`
        : `${targetCount} world${targetCount > 1 ? "s" : ""}`;

  return (
    <TableRow
      className="cursor-pointer hover:bg-muted"
      onClick={() => {
        void navigate({
          to: "/worlds/$worldId/events/$eventId",
          params: { worldId, eventId: firstEvent.id },
        });
      }}
    >
      <TableCell className="font-medium">{displayName}</TableCell>
      <TableCell>
        <Badge className={statusColors[firstEvent.status]}>
          {firstEvent.status}
        </Badge>
      </TableCell>
      <TableCell className="capitalize">{scopeLabel}</TableCell>
      <TableCell>
        {firstEvent.duration_type === "sustained"
          ? `${firstEvent.remaining_transitions}/${firstEvent.duration_transitions} turns`
          : "Instant"}
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}></TableCell>
    </TableRow>
  );
}
