import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState, type JSX } from "react";

type PaginationState = {
  readonly pageIndex: number;
  readonly pageSize: number;
};

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

import { eventsListQueryOptions, isEventsError } from "../queries/eventQueries";

import type { Event, EventListFilters, EventStatus } from "../types/eventTypes";

type EventsListProps = {
  readonly worldId: string;
  readonly canCreate: boolean;
  readonly onCreateClick: () => void;
};

const EVENT_STATUSES: EventStatus[] = ["pending", "active", "expired", "cancelled"];

const statusColors: Record<EventStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  active: "bg-green-100 text-green-800",
  expired: "bg-gray-100 text-gray-800",
  cancelled: "bg-red-100 text-red-800",
};

export function EventsList({
  worldId,
  canCreate,
  onCreateClick,
}: EventsListProps): JSX.Element {
  const [statusFilter, setStatusFilter] = useState<EventStatus[]>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const filters: EventListFilters = {
    statusFilter: statusFilter.length > 0 ? statusFilter : undefined,
  };

  const eventsQuery = useQuery(eventsListQueryOptions(worldId, filters));

  if (eventsQuery.isPending) {
    return <LoadingState label="Loading events…" />;
  }

  if (eventsQuery.isError) {
    if (isEventsError(eventsQuery.error)) {
      return <ErrorState title="Events error" description={eventsQuery.error.message} />;
    }
    return <ErrorState title="Failed to load events" description="Please try again" />;
  }

  const events = eventsQuery.data ?? [];
  const paginatedEvents = events.slice(
    pagination.pageIndex * pagination.pageSize,
    (pagination.pageIndex + 1) * pagination.pageSize,
  );
  const pageCount = Math.ceil(events.length / pagination.pageSize);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex gap-2">
          <Select
            value={statusFilter.length === 0 ? "" : statusFilter[0]}
            onValueChange={(value) => {
              if (value === "") {
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
              <SelectItem value="">All statuses</SelectItem>
              {EVENT_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </SelectItem>
              ))}
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
                <TableHead>Effect type</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedEvents.map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  worldId={worldId}
                />
              ))}
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
                className={pagination.pageIndex === 0 ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>

            {Array.from({ length: pageCount }).map((_, i) => (
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
                className={pagination.pageIndex >= pageCount - 1 ? "pointer-events-none opacity-50" : ""}
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
  readonly event: Event;
  readonly worldId: string;
}): JSX.Element {
  const navigate = useNavigate();

  return (
    <TableRow
      className="cursor-pointer hover:bg-muted"
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onClick={() => (navigate as any)({ to: "/worlds/$worldId/events/$eventId", params: { worldId, eventId: event.id } })}
    >
      <TableCell className="font-medium">{event.name}</TableCell>
      <TableCell>
        <Badge className={statusColors[event.status]}>
          {event.status}
        </Badge>
      </TableCell>
      <TableCell className="capitalize">{event.scope_type}</TableCell>
      <TableCell>{event.effect_type}</TableCell>
      <TableCell>
        {event.duration_type === "sustained"
          ? `${event.remaining_transitions}/${event.duration_transitions} turns`
          : "Instant"}
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}></TableCell>
    </TableRow>
  );
}
