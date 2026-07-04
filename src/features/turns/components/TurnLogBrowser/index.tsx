// Turn log browser — paginated, server-side-filtered view over turn_log_entries.
// Renders filters + data table. Embeddable with a fixedFilter to scope to a
// settlement, nation, citizen, or resource.

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { currentAccessContextQueryOptions } from "@/features/permissions";
import { getErrorDescription } from "@/lib/errorUtils";

import {
  turnLogBrowserQueryOptions,
  type TurnLogBrowserFilter,
} from "../../queries/turnLogBrowserQueries";

import { TurnLogFilters } from "./TurnLogFilters";
import { TurnLogTable } from "./TurnLogTable";

import type { JSX } from "react";

type TurnLogBrowserProps = {
  // Filters locked by the embedding context (not shown in filter UI).
  readonly fixedFilter?: TurnLogBrowserFilter;
  readonly title?: string;
  readonly worldId: string;
};

export function TurnLogBrowser({
  fixedFilter = {},
  title = "Turn log",
  worldId,
}: TurnLogBrowserProps): JSX.Element {
  const [page, setPage] = useState(0);
  const [userFilter, setUserFilter] = useState<TurnLogBrowserFilter>({});

  // Merge fixed (context-scope) filter with the user's filter UI selections.
  const effectiveFilter: TurnLogBrowserFilter = {
    ...userFilter,
    ...fixedFilter,
  };

  const queryClient = useQueryClient();
  const accessContextQuery = useQuery(
    currentAccessContextQueryOptions(queryClient),
  );
  const isAdmin =
    accessContextQuery.data?.canAdminWorld({ id: worldId }) ?? false;

  const query = useQuery(
    turnLogBrowserQueryOptions({ filter: effectiveFilter, page, worldId }),
  );

  function handleFilterChange(next: TurnLogBrowserFilter): void {
    setUserFilter(next);
    setPage(0); // reset to first page on filter change
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">{title}</h2>

      <TurnLogFilters
        fixedFilter={fixedFilter}
        filter={userFilter}
        onFilterChange={handleFilterChange}
        worldId={worldId}
      />

      {query.isError ? (
        <ErrorState
          title="Failed to load turn log"
          description={getErrorDescription(query.error)}
        />
      ) : query.isPending ? (
        <LoadingState label="Loading turn log…" />
      ) : (
        <TurnLogTable
          entries={query.data.entries}
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
