import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { History } from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { logCategoryLabel, turnLogBrowserQueryOptions } from "@/features/turns";
import { getErrorDescription } from "@/lib/errorUtils";
import { cn } from "@/lib/utils";

import type { JSX } from "react";

const EMPTY_FILTER = {} as const;
const EXCERPT_LIMIT = 12;

type WorldTurnLogExcerptProps = {
  readonly worldId: string;
  readonly className?: string;
};

/**
 * Recent turn-log excerpt for the world dashboard; links out to the full
 * browser. On the two-column dashboard it flexes to fill the remaining column
 * height (see `className="flex-1"`) and scrolls its list internally, so the
 * shorter right column bottom-aligns with the taller left column while showing
 * as much genuine history as fits.
 */
export function WorldTurnLogExcerpt({
  worldId,
  className,
}: WorldTurnLogExcerptProps): JSX.Element {
  const turnLogQuery = useQuery(
    turnLogBrowserQueryOptions({ filter: EMPTY_FILTER, page: 0, worldId }),
  );

  return (
    <Card className={cn("min-h-0", className)}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Recent turn log</CardTitle>
        <Button asChild variant="ghost" size="sm" className="h-auto text-xs">
          <Link to="/worlds/$worldId/history" params={{ worldId }}>
            View full log
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-y-auto">
        {turnLogQuery.isPending ? (
          <LoadingState label="Loading turn log…" />
        ) : turnLogQuery.isError ? (
          <ErrorState
            title="Turn log could not be loaded"
            description={getErrorDescription(turnLogQuery.error)}
          />
        ) : turnLogQuery.data.entries.length === 0 ? (
          <EmptyState
            icon={History}
            title="No turn log entries yet"
            description="Entries appear here after the world's first turn ends."
          />
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {turnLogQuery.data.entries.slice(0, EXCERPT_LIMIT).map((entry) => (
              <li key={entry.id} className="py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">
                    {logCategoryLabel(entry.logCategory)}
                  </p>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    T{entry.fromTurnNumber}→T{entry.toTurnNumber}
                  </span>
                </div>
                {(entry.settlementName ?? entry.nationName) !== null ? (
                  <p className="truncate text-xs text-muted-foreground">
                    {entry.settlementName ?? entry.nationName}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
