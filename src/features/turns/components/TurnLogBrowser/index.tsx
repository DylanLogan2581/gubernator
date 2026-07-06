// Turn log browser — paginated, server-side-filtered view over turn_log_entries.
// Renders filters + data table. Embeddable with a fixedFilter to scope to a
// settlement, nation, citizen, or resource. Defaults to the latest completed
// turn; callers on a route with a `turn` search param can control the
// selection so it's deep-linkable (see TurnLogPage).

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { currentAccessContextQueryOptions } from "@/features/permissions";
import { getErrorDescription } from "@/lib/errorUtils";

import { currentTurnStateQueryOptions } from "../../queries/currentTurnStateQueries";
import {
  turnLogBrowserQueryOptions,
  type TurnLogBrowserFilter,
} from "../../queries/turnLogBrowserQueries";

import { TurnLogFilters } from "./TurnLogFilters";
import { TurnLogTable } from "./TurnLogTable";
import { TurnPicker } from "./TurnPicker";

import type { JSX } from "react";

type TurnLogBrowserProps = {
  // Filters locked by the embedding context (not shown in filter UI).
  readonly fixedFilter?: TurnLogBrowserFilter;
  readonly onSelectedTurnChange?: (turn: number | "all") => void;
  readonly selectedTurn?: number | "all";
  // Pass null when the embedding page already renders its own heading
  // (e.g. a PageHeader) — omits the section h2 to avoid a duplicate heading.
  readonly title?: string | null;
  readonly worldId: string;
};

export function TurnLogBrowser({
  fixedFilter = {},
  onSelectedTurnChange,
  selectedTurn: controlledSelectedTurn,
  title = "Turn log",
  worldId,
}: TurnLogBrowserProps): JSX.Element {
  const [page, setPage] = useState(0);
  const [userFilter, setUserFilter] = useState<TurnLogBrowserFilter>({});
  const [uncontrolledSelectedTurn, setUncontrolledSelectedTurn] = useState<
    number | "all" | null
  >(null);

  const currentTurnStateQuery = useQuery(currentTurnStateQueryOptions(worldId));
  const latestTurnNumber =
    currentTurnStateQuery.data?.currentTurnNumber ?? null;

  const selectedTurn =
    controlledSelectedTurn ?? uncontrolledSelectedTurn ?? latestTurnNumber;

  function handleSelectedTurnChange(turn: number | "all"): void {
    if (onSelectedTurnChange !== undefined) {
      onSelectedTurnChange(turn);
    } else {
      setUncontrolledSelectedTurn(turn);
    }
    setPage(0);
  }

  const turnFilter: TurnLogBrowserFilter =
    selectedTurn === null || selectedTurn === "all"
      ? {}
      : { turnNumber: selectedTurn };

  // Merge user filter, the turn picker's selection, and the fixed
  // (context-scope) filter — fixedFilter always wins since it's the
  // embedding route's scope, not a user choice.
  const effectiveFilter: TurnLogBrowserFilter = {
    ...userFilter,
    ...turnFilter,
    ...fixedFilter,
  };

  const queryClient = useQueryClient();
  const accessContextQuery = useQuery(
    currentAccessContextQueryOptions(queryClient),
  );
  const isAdmin =
    accessContextQuery.data?.canAdminWorld({ id: worldId }) ?? false;

  const query = useQuery({
    ...turnLogBrowserQueryOptions({ filter: effectiveFilter, page, worldId }),
    enabled: selectedTurn !== null,
  });

  function handleFilterChange(next: TurnLogBrowserFilter): void {
    setUserFilter(next);
    setPage(0); // reset to first page on filter change
  }

  if (selectedTurn === null && currentTurnStateQuery.isError) {
    return (
      <ErrorState
        title="Failed to load the current turn"
        description={getErrorDescription(currentTurnStateQuery.error)}
      />
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {title === null ? (
          <span />
        ) : (
          <h2 className="text-lg font-semibold">{title}</h2>
        )}
        <TurnPicker
          calendarConfig={currentTurnStateQuery.data?.calendarConfig ?? null}
          latestTurnNumber={latestTurnNumber}
          onChange={handleSelectedTurnChange}
          selectedTurn={selectedTurn}
        />
      </div>

      <TurnLogFilters
        fixedFilter={fixedFilter}
        filter={userFilter}
        onFilterChange={handleFilterChange}
        worldId={worldId}
      />

      {selectedTurn === null ? (
        <LoadingState label="Loading turn log…" />
      ) : query.isError ? (
        <ErrorState
          title="Failed to load turn log"
          description={getErrorDescription(query.error)}
        />
      ) : query.isPending ? (
        <LoadingState label="Loading turn log…" />
      ) : (
        <TurnLogTable
          entries={query.data.entries}
          hideTurnColumn={typeof selectedTurn === "number"}
          isAdmin={isAdmin}
          isFetching={query.isFetching}
          onPageChange={(p) => setPage(p)}
          page={page}
          totalCount={query.data.totalCount}
          worldId={worldId}
        />
      )}
    </section>
  );
}
