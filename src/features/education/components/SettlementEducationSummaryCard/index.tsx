import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { type JSX } from "react";

import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorDescription } from "@/lib/errorUtils";

import { settlementEducationSummaryQueryOptions } from "../../queries/educationEnrollmentsQueries";
import { educationLevelsByWorldQueryOptions } from "../../queries/educationLevelsQueries";

type SettlementEducationSummaryCardProps = {
  readonly nationId: string;
  readonly settlementId: string;
  readonly worldId: string;
};

export function SettlementEducationSummaryCard({
  nationId,
  settlementId,
  worldId,
}: SettlementEducationSummaryCardProps): JSX.Element | null {
  const levelsQuery = useQuery(educationLevelsByWorldQueryOptions(worldId));
  const summaryQuery = useQuery(
    settlementEducationSummaryQueryOptions(settlementId),
  );

  const isLoading = levelsQuery.isPending || summaryQuery.isPending;
  const isError = levelsQuery.isError || summaryQuery.isError;

  if (!isLoading && !isError && (levelsQuery.data?.length ?? 0) === 0) {
    return null;
  }

  const levels = levelsQuery.data ?? [];
  const countsByLevelId = summaryQuery.data?.countsByLevelId ?? {};
  const maxCount = Math.max(
    1,
    ...levels.map((l) => countsByLevelId[l.id] ?? 0),
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Education</CardTitle>
        <Button asChild size="sm" variant="outline">
          <Link
            to="/worlds/$worldId/nations/$nationId/settlements/$settlementId/buildings"
            params={{ nationId, settlementId, worldId }}
          >
            View schools
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="grid gap-3">
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : isError ? (
          <ErrorState
            title="Education summary could not be loaded"
            description={getErrorDescription(
              levelsQuery.error ?? summaryQuery.error,
            )}
          />
        ) : (
          <>
            <ul className="grid gap-1.5">
              {levels.map((level) => {
                const count = countsByLevelId[level.id] ?? 0;
                return (
                  <li
                    key={level.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span className="w-28 shrink-0 truncate">{level.name}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full bg-primary"
                        style={{
                          width: `${((count / maxCount) * 100).toString()}%`,
                        }}
                      />
                    </span>
                    <span className="w-8 shrink-0 text-right tabular-nums">
                      {count}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="text-sm text-muted-foreground">
              {summaryQuery.data?.graduationsThisTurn ?? 0} graduation
              {summaryQuery.data?.graduationsThisTurn === 1 ? "" : "s"} last
              turn
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
