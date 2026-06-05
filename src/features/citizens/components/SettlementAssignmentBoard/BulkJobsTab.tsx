import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useState, type JSX } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getErrorDescription } from "@/lib/errorUtils";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import { setBulkStandardJobAssignmentMutationOptions } from "../../mutations/bulkStandardJobAssignmentMutations";
import { citizenAggregateStatsForSettlementQueryOptions } from "../../queries/citizensQueries";
import { settlementJobCountsQueryOptions } from "../../queries/settlementJobCountsQueries";

import type { SettlementJobCount } from "../../types/bulkAssignmentTypes";

type BulkJobsTabProps = {
  readonly canEdit: boolean;
  readonly settlementId: string;
};

export function BulkJobsTab({
  canEdit,
  settlementId,
}: BulkJobsTabProps): JSX.Element {
  const queryClient = useQueryClient();

  const aggregateQuery = useQuery(
    citizenAggregateStatsForSettlementQueryOptions(settlementId),
  );
  const jobCountsQuery = useQuery(
    settlementJobCountsQueryOptions(settlementId),
  );

  if (aggregateQuery.isPending || jobCountsQuery.isPending) {
    return <LoadingState label="Loading job assignments…" />;
  }

  const firstError = aggregateQuery.error ?? jobCountsQuery.error;
  if (firstError !== null && firstError !== undefined) {
    return (
      <ErrorState
        title="Job assignments could not be loaded"
        description={getErrorDescription(firstError)}
      />
    );
  }

  const stats = aggregateQuery.data;
  if (stats === undefined) {
    return <LoadingState label="Loading job assignments…" />;
  }
  const jobCounts = jobCountsQuery.data ?? [];

  if (jobCounts.length === 0) {
    return (
      <EmptyState
        title="No jobs"
        description="No jobs are configured for this settlement."
      />
    );
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-left text-muted-foreground">
          <th className="pb-2 font-medium" scope="col">
            Job
          </th>
          <th className="pb-2 font-medium" scope="col">
            Assigned / Capacity
          </th>
          {canEdit ? (
            <th className="pb-2 font-medium" scope="col">
              Set count
            </th>
          ) : null}
        </tr>
      </thead>
      <tbody>
        <UnassignedRow
          canEdit={canEdit}
          unassignedNpcCount={stats.unassignedNpcCount}
        />
        {jobCounts.map((job) => (
          <JobRow
            key={job.jobId}
            canEdit={canEdit}
            job={job}
            queryClient={queryClient}
            settlementId={settlementId}
            unassignedNpcCount={stats.unassignedNpcCount}
          />
        ))}
      </tbody>
    </table>
  );
}

function UnassignedRow({
  canEdit,
  unassignedNpcCount,
}: {
  readonly canEdit: boolean;
  readonly unassignedNpcCount: number;
}): JSX.Element {
  return (
    <tr className="border-b border-border">
      <td className="py-2 pr-4 font-medium">Unassigned</td>
      <td className="py-2 pr-4 tabular-nums text-muted-foreground">
        {unassignedNpcCount.toString()} /{" "}
        <span aria-label="no upper bound">∞</span>
      </td>
      {canEdit ? <td className="py-2 text-muted-foreground">—</td> : null}
    </tr>
  );
}

function JobRow({
  canEdit,
  job,
  queryClient,
  settlementId,
  unassignedNpcCount,
}: {
  readonly canEdit: boolean;
  readonly job: SettlementJobCount;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
  readonly unassignedNpcCount: number;
}): JSX.Element {
  const [localCount, setLocalCount] = useState(String(job.currentCount));
  const mutation = useMutation(
    setBulkStandardJobAssignmentMutationOptions({ queryClient }),
  );

  const parsedCount = parseInt(localCount, 10);
  const isValid = !Number.isNaN(parsedCount) && parsedCount >= 0;
  const isDirty = isValid && parsedCount !== job.currentCount;
  const isRaising = isValid && parsedCount > job.currentCount;
  const applyDisabled =
    mutation.isPending || !isDirty || (isRaising && unassignedNpcCount === 0);

  async function handleApply(): Promise<void> {
    if (!isValid) return;
    try {
      const result = await mutation.mutateAsync({
        jobId: job.jobId,
        settlementId,
        targetCount: parsedCount,
      });
      setLocalCount(String(result.after));
      notifyMutationSuccess("Job assignment updated.");
    } catch (error) {
      notifyMutationError(error, "Failed to update job assignment.");
    }
  }

  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-2 pr-4 font-medium">{job.jobName}</td>
      <td className="py-2 pr-4 tabular-nums text-muted-foreground">
        {job.currentCount} / {job.capacity}
      </td>
      {canEdit ? (
        <td className="py-2">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              aria-label={`Target count for ${job.jobName}`}
              className="w-20"
              disabled={mutation.isPending}
              inputMode="numeric"
              min="0"
              type="number"
              value={localCount}
              onChange={(e) => {
                setLocalCount(e.currentTarget.value);
              }}
            />
            <Button
              disabled={applyDisabled}
              size="sm"
              type="button"
              onClick={() => {
                void handleApply();
              }}
            >
              Apply
            </Button>
          </div>
        </td>
      ) : null}
    </tr>
  );
}
