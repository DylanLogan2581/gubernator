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
import { hashToCategoricalSlot } from "@/lib/categoricalPalette";

import {
  hardDeleteManagedPopulationTypeMutationOptions,
  restoreManagedPopulationTypeMutationOptions,
  softDeleteManagedPopulationTypeMutationOptions,
} from "../../../mutations/managedPopulationsMutations";

import { EditManagedPopulationTypeForm } from "./EditManagedPopulationTypeForm";

import type { ManagedPopulationType } from "../../../types/managedPopulationTypes";
import type { ColumnDef } from "@tanstack/react-table";

type PendingAction = {
  readonly action: "trash" | "restore";
  readonly id: string;
};

type ManagedPopulationTypesTableProps = {
  // Full active (non-trashed) list for the world, used only to feed the
  // edit form's client-side slug/name conflict validation — must not be
  // the paginated `populationTypes` slice below, or conflicts outside the
  // visible page would be silently missed.
  readonly allPopulationTypes: readonly ManagedPopulationType[];
  readonly canEdit: boolean;
  readonly cullingJobs: readonly JobDefinition[];
  readonly husbandryJobs: readonly JobDefinition[];
  readonly isPaginationDisabled: boolean;
  readonly onPageChange: (page: number) => void;
  readonly pageCount: number;
  readonly pageIndex: number;
  readonly populationTypes: readonly ManagedPopulationType[];
  readonly queryClient: QueryClient;
  readonly showTrash: boolean;
  readonly worldId: string;
};

function buildStatsText(
  populationType: ManagedPopulationType,
  husbandryJobs: readonly JobDefinition[],
  cullingJobs: readonly JobDefinition[],
): string {
  const husbandryJob = husbandryJobs.find(
    (j) => j.id === populationType.husbandryJobId,
  );
  const cullingJob = cullingJobs.find(
    (j) => j.id === populationType.cullingJobId,
  );

  let text = `${(populationType.growthRate * 100).toFixed(1)}% growth · ${populationType.husbandryWorkersPerNAnimals.toLocaleString()} workers/N`;
  if (husbandryJob !== undefined) {
    text += ` · ${husbandryJob.name}`;
  }
  if (cullingJob !== undefined) {
    text += ` · ${cullingJob.name}`;
  }
  return text;
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
      enableSorting: false,
      header: "Name",
      cell: ({ row }) => {
        const populationType = row.original;
        return (
          <div className="flex items-center gap-2">
            <IconChip
              icon={resolveEntityIcon(populationType.icon)}
              tone={hashToCategoricalSlot(populationType.id)}
              size="sm"
            />
            <span className="font-medium">{populationType.name}</span>
            {showTrash ? <Badge variant="outline">trashed</Badge> : null}
          </div>
        );
      },
    },
    {
      id: "stats",
      enableSorting: false,
      header: "Stats",
      cell: ({ row }) => (
        <span className="tabular-nums text-sm text-muted-foreground">
          {buildStatsText(row.original, husbandryJobs, cullingJobs)}
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
  allPopulationTypes,
  canEdit,
  cullingJobs,
  husbandryJobs,
  isPaginationDisabled,
  onPageChange,
  pageCount,
  pageIndex,
  populationTypes,
  queryClient,
  showTrash,
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
        sorting={[]}
        onSortingChange={() => {
          // Server-side ordering is fixed (by name); no sortable columns.
        }}
        pageIndex={pageIndex}
        pageCount={pageCount}
        onPageChange={onPageChange}
        isPaginationDisabled={isPaginationDisabled}
        emptyMessage="No population types found."
      />

      {editingPopulationType !== null ? (
        <EditManagedPopulationTypeForm
          allPopulationTypes={allPopulationTypes}
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
