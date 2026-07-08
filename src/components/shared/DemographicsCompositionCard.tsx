import { ErrorState } from "@/components/shared/ErrorState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CompositionDonutChart, type DonutSlice } from "@/features/reports";
import { getErrorDescription } from "@/lib/errorUtils";

import type { JSX } from "react";

type DemographicsEntity = {
  readonly id: string;
  readonly name: string;
  readonly color: string;
};

const UNASSIGNED_SLICE_ID = "unassigned";
const UNASSIGNED_SLICE_COLOR = "var(--muted-foreground)";

function buildSlices(
  entities: readonly DemographicsEntity[],
  counts: Readonly<Record<string, number>>,
): readonly DonutSlice[] {
  return [
    ...entities.map((entity) => ({
      color: entity.color,
      id: entity.id,
      label: entity.name,
      value: counts[entity.id] ?? 0,
    })),
    {
      color: UNASSIGNED_SLICE_COLOR,
      id: UNASSIGNED_SLICE_ID,
      label: "Unassigned",
      value: counts[UNASSIGNED_SLICE_ID] ?? 0,
    },
  ];
}

type CultureReligionCounts = {
  readonly byCultureId: Readonly<Record<string, number>>;
  readonly byReligionId: Readonly<Record<string, number>>;
};

type DemographicsCompositionCardProps = {
  readonly cultures: readonly DemographicsEntity[] | undefined;
  readonly religions: readonly DemographicsEntity[] | undefined;
  readonly composition: CultureReligionCounts | undefined;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: unknown;
};

/**
 * Culture + religion composition charts for a settlement or a nation.
 * Hides itself entirely when the world has neither cultures nor religions
 * defined — there is nothing meaningful to chart in that case.
 */
export function DemographicsCompositionCard({
  cultures,
  religions,
  composition,
  isLoading,
  isError,
  error,
}: DemographicsCompositionCardProps): JSX.Element | null {
  const hasNoCulturesOrReligions =
    (cultures?.length ?? 0) === 0 && (religions?.length ?? 0) === 0;

  if (!isLoading && !isError && hasNoCulturesOrReligions) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Demographics</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : isError ? (
          <ErrorState
            title="Failed to load demographics"
            description={getErrorDescription(error)}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">
                Culture
              </h3>
              <CompositionDonutChart
                emptyMessage="No citizens with a culture recorded yet."
                slices={buildSlices(
                  cultures ?? [],
                  composition?.byCultureId ?? {},
                )}
              />
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">
                Religion
              </h3>
              <CompositionDonutChart
                emptyMessage="No citizens with a religion recorded yet."
                slices={buildSlices(
                  religions ?? [],
                  composition?.byReligionId ?? {},
                )}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
