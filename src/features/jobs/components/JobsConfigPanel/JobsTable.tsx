import { useMutation, type QueryClient } from "@tanstack/react-query";
import { RotateCcw, Trash2 } from "lucide-react";
import { useState, type JSX } from "react";

import { handleCrudError } from "@/components/shared/ConfigCrudPanel";
import { DataTable } from "@/components/shared/DataTable";
import { IconChip } from "@/components/shared/IconChip";
import { resolveEntityIcon } from "@/components/shared/iconPicker/CuratedIcons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { hashToCategoricalSlot } from "@/lib/categoricalPalette";
import { notifyMutationSuccess } from "@/lib/notify";

import {
  hardDeleteJobMutationOptions,
  restoreJobMutationOptions,
  softDeleteJobMutationOptions,
} from "../../mutations/jobsMutations";

import { EditJobForm } from "./EditJobForm";

import type { JobDefinition, JobType } from "../../types/jobTypes";
import type { ColumnDef } from "@tanstack/react-table";

const JOB_TYPE_LABELS: Record<JobType, string> = {
  construction: "Construction",
  culling: "Culling",
  deposit: "Deposit",
  husbandry: "Husbandry",
  standard: "Standard",
  trader: "Trader",
};

export { JOB_TYPE_LABELS };

type PendingAction = {
  readonly action: "trash" | "restore" | "hardDelete";
  readonly id: string;
};

type JobsTableProps = {
  readonly canEdit: boolean;
  readonly isPaginationDisabled: boolean;
  readonly jobs: readonly JobDefinition[];
  readonly onPageChange: (page: number) => void;
  readonly pageCount: number;
  readonly pageIndex: number;
  readonly queryClient: QueryClient;
  readonly showTrash: boolean;
  readonly worldId: string;
};

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
        {`${job.baseCapacity.toLocaleString()} capacity`}
      </span>
    );
  }
  if (job.jobType === "trader" && job.traderCapacityPerWorker !== null) {
    return (
      <span className="tabular-nums text-sm text-muted-foreground">
        {`${job.traderCapacityPerWorker.toLocaleString()} per worker`}
      </span>
    );
  }
  return null;
}

function buildColumns({
  canEdit,
  hardDeletePendingId,
  onEdit,
  onHardDelete,
  onRestore,
  onTrash,
  restorePendingId,
  showTrash,
  trashPendingId,
}: {
  readonly canEdit: boolean;
  readonly hardDeletePendingId: string | null;
  readonly onEdit: (job: JobDefinition) => void;
  readonly onHardDelete: (job: JobDefinition) => void;
  readonly onRestore: (job: JobDefinition) => void;
  readonly onTrash: (job: JobDefinition) => void;
  readonly restorePendingId: string | null;
  readonly showTrash: boolean;
  readonly trashPendingId: string | null;
}): ColumnDef<JobDefinition, unknown>[] {
  return [
    {
      id: "name",
      enableSorting: false,
      header: "Name",
      cell: ({ row }) => {
        const job = row.original;
        return (
          <div className="flex items-center gap-2">
            <IconChip
              icon={resolveEntityIcon(job.icon)}
              tone={hashToCategoricalSlot(job.id)}
              size="sm"
            />
            <span className="font-medium">{job.name}</span>
            <Badge variant="secondary">{JOB_TYPE_LABELS[job.jobType]}</Badge>
          </div>
        );
      },
    },
    {
      id: "stats",
      enableSorting: false,
      header: "Stats",
      cell: ({ row }) => <JobCapacityDisplay job={row.original} />,
    },
    {
      id: "actions",
      enableSorting: false,
      header: "Actions",
      cell: ({ row }) => {
        const job = row.original;

        if (showTrash) {
          const isPending =
            restorePendingId === job.id || hardDeletePendingId === job.id;
          return (
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() => {
                  onRestore(job);
                }}
              >
                <RotateCcw aria-hidden="true" />
                Restore
              </Button>
              {job.hasActiveReferences ? (
                <span title="Cannot permanently delete: this job is still referenced by deposit types or managed population types.">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled
                  >
                    <Trash2 aria-hidden="true" />
                    Delete permanently
                  </Button>
                </span>
              ) : (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={isPending}
                  onClick={() => {
                    onHardDelete(job);
                  }}
                >
                  <Trash2 aria-hidden="true" />
                  Delete permanently
                </Button>
              )}
            </div>
          );
        }

        if (!canEdit) return null;

        const isTrashPending = trashPendingId === job.id;
        return (
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                onEdit(job);
              }}
            >
              Edit
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Move ${job.name} to trash`}
              title="Move to trash"
              disabled={isTrashPending}
              onClick={() => {
                onTrash(job);
              }}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
        );
      },
    },
  ];
}

// Table for the jobs config panel (#1032). Mutations are instantiated once
// here at the table level (not per row), and Edit opens a dialog instead of
// always mounting an inline edit row, so a world with hundreds of jobs
// doesn't mount hundreds of mutation hooks.
export function JobsTable({
  canEdit,
  isPaginationDisabled,
  jobs,
  onPageChange,
  pageCount,
  pageIndex,
  queryClient,
  showTrash,
  worldId,
}: JobsTableProps): JSX.Element {
  const [editingJob, setEditingJob] = useState<JobDefinition | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );

  const softDeleteMutation = useMutation(
    softDeleteJobMutationOptions({ queryClient }),
  );
  const restoreMutation = useMutation(
    restoreJobMutationOptions({ queryClient }),
  );
  const hardDeleteMutation = useMutation(
    hardDeleteJobMutationOptions({ queryClient }),
  );

  function handleTrash(job: JobDefinition): void {
    setPendingAction({ action: "trash", id: job.id });
    softDeleteMutation.mutate(
      { jobId: job.id, worldId },
      {
        onError: (error) => {
          setPendingAction(null);
          handleCrudError(error, "Failed to move job to trash.");
        },
        onSuccess: () => {
          setPendingAction(null);
          notifyMutationSuccess("Job moved to trash.");
        },
      },
    );
  }

  function handleRestore(job: JobDefinition): void {
    setPendingAction({ action: "restore", id: job.id });
    restoreMutation.mutate(
      { jobId: job.id, worldId },
      {
        onError: (error) => {
          setPendingAction(null);
          handleCrudError(error, "Failed to restore job.");
        },
        onSuccess: () => {
          setPendingAction(null);
          notifyMutationSuccess("Job restored.");
        },
      },
    );
  }

  function handleHardDelete(job: JobDefinition): void {
    setPendingAction({ action: "hardDelete", id: job.id });
    hardDeleteMutation.mutate(
      { jobId: job.id, worldId },
      {
        onError: (error) => {
          setPendingAction(null);
          handleCrudError(error, "Failed to permanently delete job.");
        },
        onSuccess: () => {
          setPendingAction(null);
          notifyMutationSuccess("Job permanently deleted.");
        },
      },
    );
  }

  const columns = buildColumns({
    canEdit,
    hardDeletePendingId:
      pendingAction?.action === "hardDelete" ? pendingAction.id : null,
    onEdit: setEditingJob,
    onHardDelete: handleHardDelete,
    onRestore: handleRestore,
    onTrash: handleTrash,
    restorePendingId:
      pendingAction?.action === "restore" ? pendingAction.id : null,
    showTrash,
    trashPendingId: pendingAction?.action === "trash" ? pendingAction.id : null,
  });

  return (
    <>
      <DataTable
        columns={columns}
        data={jobs}
        getRowId={(job) => job.id}
        sorting={[]}
        onSortingChange={() => {
          // Server-side ordering is fixed (by name); no sortable columns.
        }}
        pageIndex={pageIndex}
        pageCount={pageCount}
        onPageChange={onPageChange}
        isPaginationDisabled={isPaginationDisabled}
        emptyMessage="No jobs found."
      />

      {editingJob !== null ? (
        <EditJobForm
          job={editingJob}
          queryClient={queryClient}
          worldId={worldId}
          onClose={() => {
            setEditingJob(null);
          }}
        />
      ) : null}
    </>
  );
}
