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
  hardDeleteResourceMutationOptions,
  restoreResourceMutationOptions,
  softDeleteResourceMutationOptions,
} from "../../mutations/resourcesMutations";
import { buildCleanupDescription } from "../../utils/cleanupDescription";

import { EditResourceForm } from "./EditResourceForm";

import type { Resource } from "../../types/resourceTypes";
import type { ColumnDef } from "@tanstack/react-table";

type PendingAction = {
  readonly action: "trash" | "restore" | "hardDelete";
  readonly id: string;
};

type ResourcesTableProps = {
  readonly canEdit: boolean;
  readonly isPaginationDisabled: boolean;
  readonly onPageChange: (page: number) => void;
  readonly pageCount: number;
  readonly pageIndex: number;
  readonly queryClient: QueryClient;
  readonly resources: readonly Resource[];
  readonly showTrash: boolean;
  readonly worldId: string;
};

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
  readonly onEdit: (resource: Resource) => void;
  readonly onHardDelete: (resource: Resource) => void;
  readonly onRestore: (resource: Resource) => void;
  readonly onTrash: (resource: Resource) => void;
  readonly restorePendingId: string | null;
  readonly showTrash: boolean;
  readonly trashPendingId: string | null;
}): ColumnDef<Resource, unknown>[] {
  return [
    {
      id: "name",
      enableSorting: false,
      header: "Name",
      cell: ({ row }) => {
        const resource = row.original;
        return (
          <div className="flex items-center gap-2">
            <IconChip
              icon={resolveEntityIcon(resource.icon)}
              tone={hashToCategoricalSlot(resource.id)}
              size="sm"
            />
            <span className="font-medium">{resource.name}</span>
            {resource.isSystemResource ? (
              <Badge variant="secondary">system</Badge>
            ) : null}
          </div>
        );
      },
    },
    {
      id: "stats",
      enableSorting: false,
      header: "Stats",
      cell: ({ row }) => {
        const resource = row.original;
        return (
          <span className="tabular-nums text-sm text-muted-foreground">
            {`Cap ${resource.baseStockpileCap.toLocaleString()} · Decay ${resource.decayRate.toString()}%`}
          </span>
        );
      },
    },
    {
      id: "actions",
      enableSorting: false,
      header: "Actions",
      cell: ({ row }) => {
        const resource = row.original;

        if (showTrash) {
          const isPending =
            restorePendingId === resource.id ||
            hardDeletePendingId === resource.id;
          return (
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() => {
                  onRestore(resource);
                }}
              >
                <RotateCcw aria-hidden="true" />
                Restore
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={isPending}
                onClick={() => {
                  onHardDelete(resource);
                }}
              >
                <Trash2 aria-hidden="true" />
                Delete permanently
              </Button>
            </div>
          );
        }

        if (!canEdit) return null;

        const isTrashPending = trashPendingId === resource.id;
        return (
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                onEdit(resource);
              }}
            >
              Edit
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={
                resource.isSystemResource
                  ? `${resource.name} is a system resource and cannot be deleted`
                  : `Move ${resource.name} to trash`
              }
              title={
                resource.isSystemResource
                  ? "System resources cannot be deleted"
                  : "Move to trash"
              }
              disabled={resource.isSystemResource || isTrashPending}
              onClick={
                resource.isSystemResource
                  ? undefined
                  : () => {
                      onTrash(resource);
                    }
              }
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
        );
      },
    },
  ];
}

// Table for the resources config panel (#1032). Mutations are instantiated
// once here at the table level (not per row), and Edit opens a dialog
// instead of always mounting an inline edit row, so a world with hundreds of
// resources doesn't mount hundreds of mutation hooks.
export function ResourcesTable({
  canEdit,
  isPaginationDisabled,
  onPageChange,
  pageCount,
  pageIndex,
  queryClient,
  resources,
  showTrash,
  worldId,
}: ResourcesTableProps): JSX.Element {
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );

  const softDeleteMutation = useMutation(
    softDeleteResourceMutationOptions({ queryClient }),
  );
  const restoreMutation = useMutation(
    restoreResourceMutationOptions({ queryClient }),
  );
  const hardDeleteMutation = useMutation(
    hardDeleteResourceMutationOptions({ queryClient }),
  );

  function handleTrash(resource: Resource): void {
    setPendingAction({ action: "trash", id: resource.id });
    softDeleteMutation.mutate(
      { resourceId: resource.id, worldId },
      {
        onError: (error) => {
          setPendingAction(null);
          handleCrudError(error, "Failed to move resource to trash.");
        },
        onSuccess: (result) => {
          setPendingAction(null);
          const description = buildCleanupDescription(result.cleanupSummary);
          notifyMutationSuccess(
            "Resource moved to trash.",
            description !== undefined ? { description } : undefined,
          );
        },
      },
    );
  }

  function handleRestore(resource: Resource): void {
    setPendingAction({ action: "restore", id: resource.id });
    restoreMutation.mutate(
      { resourceId: resource.id, worldId },
      {
        onError: (error) => {
          setPendingAction(null);
          handleCrudError(error, "Failed to restore resource.");
        },
        onSuccess: () => {
          setPendingAction(null);
          notifyMutationSuccess("Resource restored.");
        },
      },
    );
  }

  function handleHardDelete(resource: Resource): void {
    setPendingAction({ action: "hardDelete", id: resource.id });
    hardDeleteMutation.mutate(
      { resourceId: resource.id, worldId },
      {
        onError: (error) => {
          setPendingAction(null);
          handleCrudError(error, "Failed to delete resource.");
        },
        onSuccess: () => {
          setPendingAction(null);
          notifyMutationSuccess("Resource permanently deleted.");
        },
      },
    );
  }

  const columns = buildColumns({
    canEdit,
    hardDeletePendingId:
      pendingAction?.action === "hardDelete" ? pendingAction.id : null,
    onEdit: setEditingResource,
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
        data={resources}
        getRowId={(resource) => resource.id}
        sorting={[]}
        onSortingChange={() => {
          // Server-side ordering is fixed (by name); no sortable columns.
        }}
        pageIndex={pageIndex}
        pageCount={pageCount}
        onPageChange={onPageChange}
        isPaginationDisabled={isPaginationDisabled}
        emptyMessage="No resources found."
      />

      {editingResource !== null ? (
        <EditResourceForm
          queryClient={queryClient}
          resource={editingResource}
          worldId={worldId}
          onClose={() => {
            setEditingResource(null);
          }}
        />
      ) : null}
    </>
  );
}
