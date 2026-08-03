import { type QueryClient } from "@tanstack/react-query";
import { RotateCcw, Trash2 } from "lucide-react";
import { useState, type JSX } from "react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable } from "@/components/shared/DataTable";
import { IconChip } from "@/components/shared/IconChip";
import { resolveEntityIcon } from "@/components/shared/iconPicker/CuratedIcons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { JobDefinition } from "@/features/jobs";
import { useHardDeleteRow } from "@/hooks/useHardDeleteRow";
import { useRestoreRow } from "@/hooks/useRestoreRow";
import { useSoftDeleteRow } from "@/hooks/useSoftDeleteRow";
import { resolveIconTone } from "@/lib/categoricalPalette";
import { sortByName } from "@/lib/sortUtils";

import {
  hardDeleteManagedPopulationTypeMutationOptions,
  restoreManagedPopulationTypeMutationOptions,
  softDeleteManagedPopulationTypeMutationOptions,
} from "../../../mutations/managedPopulationsMutations";

import { EditManagedPopulationTypeForm } from "./EditManagedPopulationTypeForm";

import type {
  ManagedPopulationCullingJob,
  ManagedPopulationHusbandryJob,
  ManagedPopulationType,
} from "../../../types/managedPopulationTypes";
import type { ColumnDef, SortingState } from "@tanstack/react-table";

type PendingAction = {
  readonly action: "trash" | "restore";
  readonly id: string;
};

type ManagedPopulationTypesTableProps = {
  readonly canEdit: boolean;
  readonly cullingJobs: readonly JobDefinition[];
  readonly husbandryJobs: readonly JobDefinition[];
  readonly isPaginationDisabled: boolean;
  readonly onPageChange: (page: number) => void;
  readonly onSortingChange: (sorting: SortingState) => void;
  readonly pageCount: number;
  readonly pageIndex: number;
  readonly populationTypes: readonly ManagedPopulationType[];
  readonly queryClient: QueryClient;
  readonly showTrash: boolean;
  readonly sorting: SortingState;
  readonly worldId: string;
};

function jobNames(
  jobs: readonly (
    | ManagedPopulationHusbandryJob
    | ManagedPopulationCullingJob
  )[],
  allJobs: readonly JobDefinition[],
): readonly string[] {
  return sortByName(
    jobs.flatMap((job) => {
      const linkedJob = allJobs.find((j) => j.id === job.jobId);
      return linkedJob === undefined ? [] : [linkedJob];
    }),
  ).map((job) => job.name);
}

function JobCountCell({
  allJobs,
  jobs,
}: {
  readonly allJobs: readonly JobDefinition[];
  readonly jobs: readonly (
    | ManagedPopulationHusbandryJob
    | ManagedPopulationCullingJob
  )[];
}): JSX.Element {
  if (jobs.length === 0) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }
  const names = jobNames(jobs, allJobs);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant="secondary">
        {jobs.length} {jobs.length === 1 ? "job" : "jobs"}
      </Badge>
      {names.length > 0 ? (
        <span className="text-sm text-muted-foreground">
          {names.join(", ")}
        </span>
      ) : null}
    </div>
  );
}

function buildColumns({
  canEdit,
  cullingJobs,
  hardDeletePendingId,
  husbandryJobs,
  onEdit,
  onHardDelete,
  onRestore,
  onTrash,
  restorePendingId,
  showTrash,
  trashPendingId,
}: {
  readonly canEdit: boolean;
  readonly cullingJobs: readonly JobDefinition[];
  readonly hardDeletePendingId: string | null;
  readonly husbandryJobs: readonly JobDefinition[];
  readonly onEdit: (populationType: ManagedPopulationType) => void;
  readonly onHardDelete: (populationType: ManagedPopulationType) => void;
  readonly onRestore: (populationType: ManagedPopulationType) => void;
  readonly onTrash: (populationType: ManagedPopulationType) => void;
  readonly restorePendingId: string | null;
  readonly showTrash: boolean;
  readonly trashPendingId: string | null;
}): ColumnDef<ManagedPopulationType, unknown>[] {
  return [
    {
      id: "name",
      accessorFn: (row) => row.name,
      enableSorting: true,
      header: "Name",
      cell: ({ row }) => {
        const populationType = row.original;
        return (
          <div className="flex items-center gap-2">
            <IconChip
              icon={resolveEntityIcon(populationType.icon)}
              tone={resolveIconTone(
                populationType.iconColor,
                populationType.id,
              )}
            />
            <span className="font-medium">{populationType.name}</span>
            {showTrash ? <Badge variant="outline">trashed</Badge> : null}
          </div>
        );
      },
    },
    {
      id: "husbandryJobs",
      accessorFn: (row) => row.husbandryJobs.length,
      enableSorting: false,
      header: "Husbandry jobs",
      cell: ({ row }) => (
        <JobCountCell
          allJobs={husbandryJobs}
          jobs={row.original.husbandryJobs}
        />
      ),
    },
    {
      id: "cullingJobs",
      accessorFn: (row) => row.cullingJobs.length,
      enableSorting: false,
      header: "Culling jobs",
      cell: ({ row }) => (
        <JobCountCell allJobs={cullingJobs} jobs={row.original.cullingJobs} />
      ),
    },
    {
      id: "growthRate",
      accessorFn: (row) => row.growthRate,
      enableSorting: true,
      header: "Growth rate",
      cell: ({ row }) => (
        <span className="tabular-nums text-sm text-muted-foreground">
          {`${(row.original.growthRate * 100).toFixed(1)}%`}
        </span>
      ),
    },
    {
      id: "actions",
      enableSorting: false,
      header: "Actions",
      cell: ({ row }) => {
        const populationType = row.original;

        if (showTrash) {
          const isPending =
            restorePendingId === populationType.id ||
            hardDeletePendingId === populationType.id;
          return (
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() => {
                  onRestore(populationType);
                }}
              >
                <RotateCcw aria-hidden="true" />
                Restore
              </Button>
              {populationType.hasActiveReferences ? (
                <span title="Cannot permanently delete: this population type is referenced by active job configurations.">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled
                  >
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
                    onHardDelete(populationType);
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

        const isTrashPending = trashPendingId === populationType.id;
        return (
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                onEdit(populationType);
              }}
            >
              Edit
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Move ${populationType.name} to trash`}
              title="Move to trash"
              disabled={isTrashPending}
              onClick={() => {
                onTrash(populationType);
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

// Table for the managed-populations config panel (#1032). Mutations are
// instantiated once here at the table level (not per row), and Edit opens a
// dialog instead of always mounting an inline edit row, so a world with
// hundreds of population types doesn't mount hundreds of mutation hooks.
export function ManagedPopulationTypesTable({
  canEdit,
  cullingJobs,
  husbandryJobs,
  isPaginationDisabled,
  onPageChange,
  onSortingChange,
  pageCount,
  pageIndex,
  populationTypes,
  queryClient,
  showTrash,
  sorting,
  worldId,
}: ManagedPopulationTypesTableProps): JSX.Element {
  const [editingPopulationType, setEditingPopulationType] =
    useState<ManagedPopulationType | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );
  const [hardDeleteTarget, setHardDeleteTarget] =
    useState<ManagedPopulationType | null>(null);

  const softDeleteMutation = useSoftDeleteRow(
    softDeleteManagedPopulationTypeMutationOptions({ queryClient }),
    { successMessage: "Managed population type moved to trash." },
  );
  const restoreMutation = useRestoreRow(
    restoreManagedPopulationTypeMutationOptions({ queryClient }),
    { successMessage: "Managed population type restored." },
  );
  const hardDeleteMutation = useHardDeleteRow(
    hardDeleteManagedPopulationTypeMutationOptions({ queryClient }),
    { successMessage: "Managed population type permanently deleted." },
  );

  function handleTrash(populationType: ManagedPopulationType): void {
    setPendingAction({ action: "trash", id: populationType.id });
    softDeleteMutation.mutate(
      { managedPopulationTypeId: populationType.id, worldId },
      {
        onSettled: () => {
          setPendingAction(null);
        },
      },
    );
  }

  function handleRestore(populationType: ManagedPopulationType): void {
    setPendingAction({ action: "restore", id: populationType.id });
    restoreMutation.mutate(
      { managedPopulationTypeId: populationType.id, worldId },
      {
        onSettled: () => {
          setPendingAction(null);
        },
      },
    );
  }

  function handleHardDeleteConfirm(): void {
    if (hardDeleteTarget === null) return;
    hardDeleteMutation.mutate(
      { managedPopulationTypeId: hardDeleteTarget.id, worldId },
      {
        onSuccess: () => {
          setHardDeleteTarget(null);
        },
      },
    );
  }

  const columns = buildColumns({
    canEdit,
    cullingJobs,
    hardDeletePendingId: hardDeleteTarget?.id ?? null,
    husbandryJobs,
    onEdit: setEditingPopulationType,
    onHardDelete: setHardDeleteTarget,
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
        data={populationTypes}
        getRowId={(populationType) => populationType.id}
        sorting={sorting}
        onSortingChange={onSortingChange}
        pageIndex={pageIndex}
        pageCount={pageCount}
        onPageChange={onPageChange}
        isPaginationDisabled={isPaginationDisabled}
        emptyMessage="No population types found."
      />

      {editingPopulationType !== null ? (
        <EditManagedPopulationTypeForm
          cullingJobs={cullingJobs}
          husbandryJobs={husbandryJobs}
          populationType={editingPopulationType}
          queryClient={queryClient}
          worldId={worldId}
          onClose={() => {
            setEditingPopulationType(null);
          }}
        />
      ) : null}

      {hardDeleteTarget !== null ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setHardDeleteTarget(null);
          }}
          title={`Permanently delete ${hardDeleteTarget.name}?`}
          description={
            <>
              This will permanently delete{" "}
              <span className="font-medium text-foreground">
                {hardDeleteTarget.name}
              </span>{" "}
              and all its data. This action cannot be undone.
            </>
          }
          confirmLabel="Delete permanently"
          isPending={hardDeleteMutation.isPending}
          onConfirm={handleHardDeleteConfirm}
        />
      ) : null}
    </>
  );
}
