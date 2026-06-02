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
import {
  constructionProjectsBySettlementQueryOptions,
  type ConstructionProject,
} from "@/features/buildings";
import { getErrorDescription } from "@/lib/errorUtils";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import { setBulkConstructionAssignmentMutationOptions } from "../../mutations/bulkConstructionAssignmentMutations";
import { setBulkStandardJobAssignmentMutationOptions } from "../../mutations/bulkStandardJobAssignmentMutations";
import { citizenAggregateStatsForSettlementQueryOptions } from "../../queries/citizensQueries";
import { settlementConstructionProjectCountsQueryOptions } from "../../queries/settlementConstructionProjectCountsQueries";
import { settlementJobCountsQueryOptions } from "../../queries/settlementJobCountsQueries";

import type {
  SettlementConstructionProjectCount,
  SettlementJobCount,
} from "../../types/bulkAssignmentTypes";

const TERMINAL_STATUSES = new Set(["complete", "cancelled"]);

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
  const projectCountsQuery = useQuery(
    settlementConstructionProjectCountsQueryOptions(settlementId),
  );
  const projectsQuery = useQuery(
    constructionProjectsBySettlementQueryOptions(settlementId),
  );

  if (
    aggregateQuery.isPending ||
    jobCountsQuery.isPending ||
    projectCountsQuery.isPending ||
    projectsQuery.isPending
  ) {
    return <LoadingState label="Loading job assignments…" />;
  }

  const firstError =
    aggregateQuery.error ??
    jobCountsQuery.error ??
    projectCountsQuery.error ??
    projectsQuery.error;
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
  const projectCounts = (projectCountsQuery.data ?? []).filter(
    (pc) => !TERMINAL_STATUSES.has(pc.status),
  );
  const projects = projectsQuery.data ?? [];

  const projectMap = new Map(projects.map((p) => [p.id, p]));
  const constructionPoolCount = projectCounts.reduce(
    (sum, pc) => sum + pc.currentCount,
    0,
  );

  return (
    <div className="grid gap-6">
      <StandardJobsSection
        canEdit={canEdit}
        jobCounts={jobCounts}
        queryClient={queryClient}
        settlementId={settlementId}
        unassignedNpcCount={stats.unassignedNpcCount}
      />
      <ConstructionSection
        canEdit={canEdit}
        constructionPoolCount={constructionPoolCount}
        projectCounts={projectCounts}
        projectMap={projectMap}
        queryClient={queryClient}
        settlementId={settlementId}
        unassignedNpcCount={stats.unassignedNpcCount}
      />
    </div>
  );
}

function StandardJobsSection({
  canEdit,
  jobCounts,
  queryClient,
  settlementId,
  unassignedNpcCount,
}: {
  readonly canEdit: boolean;
  readonly jobCounts: readonly SettlementJobCount[];
  readonly queryClient: QueryClient;
  readonly settlementId: string;
  readonly unassignedNpcCount: number;
}): JSX.Element {
  return (
    <div className="grid gap-2">
      <h3 className="text-sm font-medium text-muted-foreground">
        Standard jobs
      </h3>
      {jobCounts.length === 0 ? (
        <EmptyState
          title="No standard jobs"
          description="No standard jobs are configured for this settlement."
        />
      ) : (
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
              unassignedNpcCount={unassignedNpcCount}
            />
            {jobCounts.map((job) => (
              <JobRow
                key={job.jobId}
                canEdit={canEdit}
                job={job}
                queryClient={queryClient}
                settlementId={settlementId}
                unassignedNpcCount={unassignedNpcCount}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function UnassignedRow({
  canEdit,
  label = "Unassigned",
  unassignedNpcCount,
}: {
  readonly canEdit: boolean;
  readonly label?: string;
  readonly unassignedNpcCount: number;
}): JSX.Element {
  return (
    <tr className="border-b border-border">
      <td className="py-2 pr-4 font-medium">{label}</td>
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

function ConstructionSection({
  canEdit,
  constructionPoolCount,
  projectCounts,
  projectMap,
  queryClient,
  settlementId,
  unassignedNpcCount,
}: {
  readonly canEdit: boolean;
  readonly constructionPoolCount: number;
  readonly projectCounts: readonly SettlementConstructionProjectCount[];
  readonly projectMap: ReadonlyMap<string, ConstructionProject>;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
  readonly unassignedNpcCount: number;
}): JSX.Element | null {
  if (projectCounts.length === 0) return null;

  return (
    <div className="grid gap-2">
      <h3 className="text-sm font-medium text-muted-foreground">
        Construction projects
      </h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="pb-2 font-medium" scope="col">
              Project
            </th>
            <th className="pb-2 font-medium" scope="col">
              Assigned
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
            label="Construction pool"
            unassignedNpcCount={constructionPoolCount}
          />
          {projectCounts.map((pc) => {
            const project = projectMap.get(pc.constructionProjectId);
            if (project === undefined) return null;
            return (
              <ConstructionRow
                key={pc.constructionProjectId}
                canEdit={canEdit}
                project={project}
                projectCount={pc}
                queryClient={queryClient}
                settlementId={settlementId}
                unassignedNpcCount={unassignedNpcCount}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ConstructionRow({
  canEdit,
  project,
  projectCount,
  queryClient,
  settlementId,
  unassignedNpcCount,
}: {
  readonly canEdit: boolean;
  readonly project: ConstructionProject;
  readonly projectCount: SettlementConstructionProjectCount;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
  readonly unassignedNpcCount: number;
}): JSX.Element {
  const [localCount, setLocalCount] = useState(
    String(projectCount.currentCount),
  );
  const mutation = useMutation(
    setBulkConstructionAssignmentMutationOptions({ queryClient }),
  );

  const parsedCount = parseInt(localCount, 10);
  const isValid = !Number.isNaN(parsedCount) && parsedCount >= 0;
  const isDirty = isValid && parsedCount !== projectCount.currentCount;
  const isRaising = isValid && parsedCount > projectCount.currentCount;
  const applyDisabled =
    mutation.isPending || !isDirty || (isRaising && unassignedNpcCount === 0);

  const projectLabel = `${project.blueprintName} (Tier ${project.tierNumber.toString()})`;

  async function handleApply(): Promise<void> {
    if (!isValid) return;
    try {
      const result = await mutation.mutateAsync({
        constructionProjectId: projectCount.constructionProjectId,
        settlementId,
        targetCount: parsedCount,
      });
      setLocalCount(String(result.after));
      notifyMutationSuccess("Construction assignment updated.");
    } catch (error) {
      notifyMutationError(error, "Failed to update construction assignment.");
    }
  }

  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-2 pr-4 font-medium">{projectLabel}</td>
      <td className="py-2 pr-4 tabular-nums text-muted-foreground">
        {projectCount.currentCount}
      </td>
      {canEdit ? (
        <td className="py-2">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              aria-label={`Target count for ${projectLabel}`}
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
