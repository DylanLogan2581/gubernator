import { useMutation, type QueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";

import { handleCrudError } from "@/components/shared/ConfigCrudPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { notifyMutationSuccess } from "@/lib/notify";

import {
  hardDeleteJobMutationOptions,
  restoreJobMutationOptions,
  softDeleteJobMutationOptions,
} from "../../mutations/jobsMutations";

import type { JobDefinition, JobType } from "../../types/jobTypes";
import type { JSX } from "react";

const JOB_TYPE_LABELS: Record<JobType, string> = {
  construction: "Construction",
  culling: "Culling",
  deposit: "Deposit",
  husbandry: "Husbandry",
  standard: "Standard",
  trader: "Trader",
};

export { JOB_TYPE_LABELS };

export function JobList({
  canEdit,
  editingJobId,
  jobs,
  queryClient,
  showTrash,
  worldId,
  onEditingChange,
  onRenderEditForm,
}: {
  readonly canEdit: boolean;
  readonly editingJobId: string | null;
  readonly jobs: readonly JobDefinition[];
  readonly onEditingChange: (id: string | null) => void;
  readonly queryClient: QueryClient;
  readonly showTrash: boolean;
  readonly worldId: string;
  readonly onRenderEditForm: (job: JobDefinition) => JSX.Element;
}): JSX.Element {
  return (
    <ul aria-label="Jobs" className="grid gap-2">
      {jobs.map((job) => {
        if (showTrash) {
          return (
            <TrashedJobRow
              key={job.id}
              job={job}
              queryClient={queryClient}
              worldId={worldId}
            />
          );
        }
        return editingJobId === job.id ? (
          <li key={job.id}>{onRenderEditForm(job)}</li>
        ) : (
          <JobRow
            key={job.id}
            canEdit={canEdit}
            job={job}
            queryClient={queryClient}
            worldId={worldId}
            onEdit={() => {
              onEditingChange(job.id);
            }}
          />
        );
      })}
    </ul>
  );
}

function JobRow({
  canEdit,
  job,
  queryClient,
  worldId,
  onEdit,
}: {
  readonly canEdit: boolean;
  readonly job: JobDefinition;
  readonly onEdit: () => void;
  readonly queryClient: QueryClient;
  readonly worldId: string;
}): JSX.Element {
  const softDeleteMutation = useMutation(
    softDeleteJobMutationOptions({ queryClient }),
  );

  function handleTrash(): void {
    softDeleteMutation.mutate(
      { jobId: job.id, worldId },
      {
        onError: (error) => {
          handleCrudError(error, "Failed to move job to trash.");
        },
        onSuccess: () => {
          notifyMutationSuccess("Job moved to trash.");
        },
      },
    );
  }

  return (
    <li className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
      <div className="grid gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{job.name}</span>
          <Badge variant="secondary">{JOB_TYPE_LABELS[job.jobType]}</Badge>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <JobCapacityDisplay job={job} />
        {canEdit ? (
          <Button type="button" variant="outline" size="sm" onClick={onEdit}>
            Edit
          </Button>
        ) : null}
        {canEdit ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Move ${job.name} to trash`}
            title="Move to trash"
            disabled={softDeleteMutation.isPending}
            onClick={handleTrash}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        ) : null}
      </div>
    </li>
  );
}

function TrashedJobRow({
  job,
  queryClient,
  worldId,
}: {
  readonly job: JobDefinition;
  readonly queryClient: QueryClient;
  readonly worldId: string;
}): JSX.Element {
  const restoreMutation = useMutation(
    restoreJobMutationOptions({ queryClient }),
  );
  const hardDeleteMutation = useMutation(
    hardDeleteJobMutationOptions({ queryClient }),
  );
  const isPending = restoreMutation.isPending || hardDeleteMutation.isPending;

  function handleRestore(): void {
    restoreMutation.mutate(
      { jobId: job.id, worldId },
      {
        onError: (error) => {
          handleCrudError(error, "Failed to restore job.");
        },
        onSuccess: () => {
          notifyMutationSuccess("Job restored.");
        },
      },
    );
  }

  function handleHardDelete(): void {
    hardDeleteMutation.mutate(
      { jobId: job.id, worldId },
      {
        onError: (error) => {
          handleCrudError(error, "Failed to permanently delete job.");
        },
        onSuccess: () => {
          notifyMutationSuccess("Job permanently deleted.");
        },
      },
    );
  }

  return (
    <li className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
      <div className="grid gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{job.name}</span>
          <Badge variant="secondary">{JOB_TYPE_LABELS[job.jobType]}</Badge>
          <Badge variant="outline">trashed</Badge>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={handleRestore}
        >
          Restore
        </Button>
        {job.hasActiveReferences ? (
          <span title="Cannot permanently delete: this job is still referenced by deposit types or managed population types.">
            <Button type="button" variant="destructive" size="sm" disabled>
              Delete permanently
            </Button>
          </span>
        ) : (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={isPending}
            onClick={handleHardDelete}
          >
            Delete permanently
          </Button>
        )}
      </div>
    </li>
  );
}

function JobCapacityDisplay({
  job,
}: {
  readonly job: JobDefinition;
}): JSX.Element | null {
  if (
    (job.jobType === "standard" || job.jobType === "construction") &&
    job.baseCapacity !== null
  ) {
    return (
      <span className="tabular-nums text-sm text-muted-foreground">
        {job.baseCapacity.toLocaleString()} capacity
      </span>
    );
  }
  if (job.jobType === "trader" && job.traderCapacityPerWorker !== null) {
    return (
      <span className="tabular-nums text-sm text-muted-foreground">
        {job.traderCapacityPerWorker.toLocaleString()} per worker
      </span>
    );
  }
  return null;
}
