import { useQuery } from "@tanstack/react-query";

import { ErrorState } from "@/components/shared/ErrorState";
import { resolveEntityIcon } from "@/components/shared/iconPicker/CuratedIcons";
import { Skeleton } from "@/components/ui/skeleton";
import { settlementJobCountsQueryOptions } from "@/features/citizens";
import { activeJobsByWorldQueryOptions } from "@/features/jobs";
import {
  categoricalForegroundCssVar,
  hashToCategoricalSlot,
} from "@/lib/categoricalPalette";
import { getErrorDescription } from "@/lib/errorUtils";

import { CompositionDonutChart } from "./CompositionDonutChart";

import type { JSX } from "react";

type PopulationByJobDonutProps = {
  readonly settlementId: string;
  readonly worldId: string;
};

/**
 * Current population-by-job composition for a settlement. Job icons come
 * from the world's job definitions (the job-counts RPC doesn't carry icon),
 * joined by job id.
 */
export function PopulationByJobDonut({
  settlementId,
  worldId,
}: PopulationByJobDonutProps): JSX.Element {
  const jobCountsQuery = useQuery(
    settlementJobCountsQueryOptions(settlementId),
  );
  const jobsQuery = useQuery(activeJobsByWorldQueryOptions(worldId));

  if (jobCountsQuery.isPending || jobsQuery.isPending) {
    return <Skeleton className="h-48 w-full" />;
  }

  if (jobCountsQuery.isError) {
    return (
      <ErrorState
        title="Failed to load job assignments"
        description={getErrorDescription(jobCountsQuery.error)}
      />
    );
  }

  if (jobsQuery.isError) {
    return (
      <ErrorState
        title="Failed to load job definitions"
        description={getErrorDescription(jobsQuery.error)}
      />
    );
  }

  const iconByJobId = new Map(
    jobsQuery.data.map((job) => [job.id, job.icon] as const),
  );

  const slices = jobCountsQuery.data.map((count) => ({
    color: categoricalForegroundCssVar(hashToCategoricalSlot(count.jobId)),
    icon: resolveEntityIcon(iconByJobId.get(count.jobId)),
    id: count.jobId,
    label: count.jobName,
    value: count.currentCount,
  }));

  return (
    <CompositionDonutChart
      emptyMessage="No citizens assigned to jobs in this settlement."
      slices={slices}
    />
  );
}
