import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Plus, Search, Zap } from "lucide-react";
import { useEffect, useState, type JSX } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { IconChip } from "@/components/shared/IconChip";
import { LoadingState } from "@/components/shared/LoadingState";
import { MasterDetailLayout } from "@/components/shared/MasterDetailLayout";
import { TablePagination } from "@/components/shared/TablePagination";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
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
import { useIsMobile } from "@/hooks/use-mobile";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { DOMAIN_ICON_CHIPS } from "@/lib/domainIconography";

import { eventsListQueryOptions, isEventsError } from "../queries/eventQueries";
import { resolveEventIcon } from "../utils/eventIcon";

import { EventScopeBadge, EventStatusBadge } from "./EventBadges";
import { EventDetail } from "./EventDetail";

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
  EventScopeType,
  EventSortBy,
  EventsSearchParams,
  EventWithGroup,
} from "../types/eventTypes";

type EventsListProps = {
  readonly worldId: string;
  readonly canCreate: boolean;
  readonly canManage: boolean;
  readonly onCreateClick: () => void;
  readonly search: EventsSearchParams;
};

const EVENT_STATUSES = ["pending", "active", "expired", "cancelled"] as const;

const EVENT_SCOPES: readonly EventScopeType[] = [
  "world",
  "nation",
  "settlement",
];

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
  canManage,
  onCreateClick,
  search,
}: EventsListProps): JSX.Element {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(search.q);
  const debouncedSearchInput = useDebouncedValue(searchInput, 300);
  const statusKey = search.status.join(",");
  const filterKey = `${statusKey}|${search.scope ?? ""}|${search.q}`;

  // Keep the input in sync when the URL changes from elsewhere (back/forward
  // nav), and reset to page one whenever the applied filters change. Adjusted
  // during render (not an effect) per https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const [syncedFilterKey, setSyncedFilterKey] = useState(filterKey);
  if (filterKey !== syncedFilterKey) {
    setSyncedFilterKey(filterKey);
    setSearchInput(search.q);
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }

  // Push debounced text changes to the URL so filters stay shareable/bookmarkable.
  useEffect(() => {
    if (debouncedSearchInput === search.q) return;
    void navigate({
      to: "/worlds/$worldId/events",
      params: { worldId },
      search: (prev) => ({
        ...prev,
        q: debouncedSearchInput === "" ? undefined : debouncedSearchInput,
      }),
      replace: true,
    });
  }, [debouncedSearchInput, navigate, search.q, worldId]);

  const filters: EventListFilters = {
    statusFilter: search.status.length > 0 ? [...search.status] : undefined,
    sortBy: search.sort,
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

  if (events.length === 0) {
    return (
      <EmptyState
        icon={Zap}
        title="No events yet"
        description={
          canCreate
            ? "Create your first event to get started."
            : "Events will appear here once a world admin creates one."
        }
        action={
          canCreate ? (
            <Button onClick={onCreateClick} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Create event
            </Button>
          ) : undefined
        }
      />
    );
  }

  const scopeFiltered =
    search.scope === undefined
      ? events
      : events.filter((event) => event.scope_type === search.scope);
  const searchLower = search.q.trim().toLowerCase();
  const filteredEvents =
    searchLower === ""
      ? scopeFiltered
      : scopeFiltered.filter((event) =>
          (event.group?.name ?? event.name).toLowerCase().includes(searchLower),
        );

  const displayItems = groupEvents(filteredEvents);
  const paginatedItems = displayItems.slice(
    pagination.pageIndex * pagination.pageSize,
    (pagination.pageIndex + 1) * pagination.pageSize,
  );
  const pageCount = Math.ceil(displayItems.length / pagination.pageSize);
  const selectedEvent =
    events.find((event) => event.id === selectedEventId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <div className="relative w-full sm:w-[200px]">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              aria-label="Search events by name"
              className="pl-8"
              placeholder="Search events…"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.currentTarget.value);
              }}
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-[180px] justify-between">
                {search.status.length === 0
                  ? "All statuses"
                  : search.status.length === 1
                    ? (search.status[0]?.charAt(0).toUpperCase() ?? "") +
                      (search.status[0]?.slice(1) ?? "")
                    : `${search.status.length.toString()} statuses`}
                <span className="ml-2 opacity-50">▾</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[180px]">
              {EVENT_STATUSES.map((status) => (
                <DropdownMenuCheckboxItem
                  key={status}
                  checked={search.status.includes(status)}
                  onCheckedChange={(checked) => {
                    const nextStatus = checked
                      ? [...search.status, status]
                      : search.status.filter((s) => s !== status);
                    void navigate({
                      to: "/worlds/$worldId/events",
                      params: { worldId },
                      search: (prev) => ({
                        ...prev,
                        status: nextStatus.length > 0 ? nextStatus : undefined,
                      }),
                    });
                  }}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Select
            value={search.sort}
            onValueChange={(value) => {
              void navigate({
                to: "/worlds/$worldId/events",
                params: { worldId },
                search: (prev) => ({
                  ...prev,
                  sort:
                    value === "created_at" ? undefined : (value as EventSortBy),
                }),
              });
            }}
          >
            <SelectTrigger aria-label="Sort events" className="w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created_at">Sort by Created Date</SelectItem>
              <SelectItem value="status">Sort by Status</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={search.scope ?? "all"}
            onValueChange={(value) => {
              void navigate({
                to: "/worlds/$worldId/events",
                params: { worldId },
                search: (prev) => ({
                  ...prev,
                  scope:
                    value === "all" ? undefined : (value as EventScopeType),
                }),
              });
            }}
          >
            <SelectTrigger aria-label="Filter by scope" className="w-[160px]">
              <SelectValue placeholder="All scopes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All scopes</SelectItem>
              {EVENT_SCOPES.map((scope) => (
                <SelectItem key={scope} value={scope}>
                  {scope.charAt(0).toUpperCase() + scope.slice(1)}
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

      <MasterDetailLayout
        list={
          <div className="space-y-4">
            {filteredEvents.length === 0 ? (
              <EmptyState
                title="No events match your filters"
                description="Try adjusting the status, scope, or search filters."
              />
            ) : isMobile ? (
              <div className="divide-y divide-border border-y border-border">
                {paginatedItems.map((item) => {
                  if (item.type === "single") {
                    return (
                      <EventCard
                        key={item.event.id}
                        event={item.event}
                        isSelected={item.event.id === selectedEventId}
                        onSelect={() => {
                          setSelectedEventId(item.event.id);
                        }}
                      />
                    );
                  }
                  const firstEvent = item.events[0];
                  if (firstEvent === undefined) {
                    return null;
                  }
                  return (
                    <EventCard
                      key={item.groupId}
                      event={firstEvent}
                      scopeLabel={groupScopeLabel(
                        firstEvent.scope_type,
                        item.events.length,
                      )}
                      isSelected={item.events.some(
                        (e) => e.id === selectedEventId,
                      )}
                      onSelect={() => {
                        setSelectedEventId(firstEvent.id);
                      }}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Scope</TableHead>
                      <TableHead>Duration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedItems.map((item) => {
                      if (item.type === "single") {
                        return (
                          <EventRow
                            key={item.event.id}
                            event={item.event}
                            isSelected={item.event.id === selectedEventId}
                            onSelect={() => {
                              setSelectedEventId(item.event.id);
                            }}
                          />
                        );
                      }
                      const firstEvent = item.events[0];
                      if (firstEvent === undefined) {
                        return null;
                      }
                      return (
                        <EventRow
                          key={item.groupId}
                          event={firstEvent}
                          scopeLabel={groupScopeLabel(
                            firstEvent.scope_type,
                            item.events.length,
                          )}
                          isSelected={item.events.some(
                            (e) => e.id === selectedEventId,
                          )}
                          onSelect={() => {
                            setSelectedEventId(firstEvent.id);
                          }}
                        />
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {pageCount > 1 && (
              <TablePagination
                page={pagination.pageIndex}
                pageCount={pageCount}
                onPageChange={(pageIndex) =>
                  setPagination((p) => ({ ...p, pageIndex }))
                }
              />
            )}
          </div>
        }
        detail={
          selectedEvent === null ? null : (
            <EventDetail
              worldId={worldId}
              eventId={selectedEvent.id}
              canCancel={canManage}
              variant="panel"
              onDeleted={() => {
                setSelectedEventId(null);
              }}
            />
          )
        }
        detailTitle={selectedEvent?.group?.name ?? selectedEvent?.name ?? ""}
        onCloseDetail={() => {
          setSelectedEventId(null);
        }}
        emptyState={
          displayItems.length === 0 ? undefined : (
            <EmptyState
              icon={Zap}
              title="Select an event to see its details"
              action={
                canCreate ? (
                  <Button onClick={onCreateClick} size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Create event
                  </Button>
                ) : undefined
              }
            />
          )
        }
      />
    </div>
  );
}

function eventDurationLabel(event: EventWithGroup): string {
  return event.duration_type === "sustained"
    ? `${event.remaining_transitions}/${event.duration_transitions} turns`
    : "Instant";
}

function groupScopeLabel(
  scopeType: EventScopeType,
  targetCount: number,
): string {
  const noun =
    scopeType === "settlement"
      ? "settlement"
      : scopeType === "nation"
        ? "nation"
        : "world";
  return `${targetCount} ${noun}${targetCount > 1 ? "s" : ""}`;
}

function EventCard({
  event,
  isSelected,
  onSelect,
  scopeLabel,
}: {
  readonly event: EventWithGroup;
  readonly isSelected: boolean;
  readonly onSelect: () => void;
  /** Target-count label for grouped events, e.g. "3 settlements". */
  readonly scopeLabel?: string;
}): JSX.Element {
  const displayName = event.group?.name ?? event.name;

  return (
    <button
      type="button"
      aria-pressed={isSelected}
      data-state={isSelected ? "selected" : undefined}
      className="relative flex w-full items-center gap-3 py-3 text-left outline-none hover:bg-accent/50 focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=selected]:bg-accent data-[state=selected]:before:absolute data-[state=selected]:before:inset-y-0 data-[state=selected]:before:left-0 data-[state=selected]:before:w-0.5 data-[state=selected]:before:bg-primary"
      onClick={onSelect}
    >
      <IconChip
        icon={resolveEventIcon(event.icon)}
        tone={DOMAIN_ICON_CHIPS.events.tone}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{displayName}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <EventStatusBadge status={event.status} />
          <EventScopeBadge scopeType={event.scope_type} />
          {scopeLabel !== undefined && (
            <span className="text-xs text-muted-foreground">{scopeLabel}</span>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {eventDurationLabel(event)}
        </p>
      </div>
    </button>
  );
}

function EventRow({
  event,
  isSelected,
  onSelect,
  scopeLabel,
}: {
  readonly event: EventWithGroup;
  readonly isSelected: boolean;
  readonly onSelect: () => void;
  /** Target-count label for grouped events, e.g. "3 settlements". */
  readonly scopeLabel?: string;
}): JSX.Element {
  const displayName = event.group?.name ?? event.name;

  return (
    <TableRow
      aria-selected={isSelected}
      className="cursor-pointer"
      data-state={isSelected ? "selected" : undefined}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <TableCell className="font-medium">
        <span className="flex items-center gap-2">
          <IconChip
            icon={resolveEventIcon(event.icon)}
            tone={DOMAIN_ICON_CHIPS.events.tone}
          />
          {displayName}
        </span>
      </TableCell>
      <TableCell>
        <EventStatusBadge status={event.status} />
      </TableCell>
      <TableCell>
        {scopeLabel !== undefined ? (
          <div className="flex items-center gap-2">
            <EventScopeBadge scopeType={event.scope_type} />
            <span className="text-xs text-muted-foreground">{scopeLabel}</span>
          </div>
        ) : (
          <EventScopeBadge scopeType={event.scope_type} />
        )}
      </TableCell>
      <TableCell>{eventDurationLabel(event)}</TableCell>
    </TableRow>
  );
}
