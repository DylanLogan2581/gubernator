import { type QueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Layers, RotateCcw, Trash2 } from "lucide-react";
import { useState, type JSX } from "react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable } from "@/components/shared/DataTable";
import { IconChip } from "@/components/shared/IconChip";
import { resolveEntityIcon } from "@/components/shared/iconPicker/CuratedIcons";
import { Button } from "@/components/ui/button";
import { useHardDeleteRow } from "@/hooks/useHardDeleteRow";
import { useRestoreRow } from "@/hooks/useRestoreRow";
import { useSoftDeleteRow } from "@/hooks/useSoftDeleteRow";
import { hashToCategoricalSlot } from "@/lib/categoricalPalette";

import {
  hardDeleteBlueprintMutationOptions,
  restoreBlueprintMutationOptions,
  softDeleteBlueprintMutationOptions,
} from "../../mutations/buildingsMutations";

import { EditBlueprintForm } from "./EditBlueprintForm";

import type { BuildingBlueprintSummary } from "../../queries/buildingsQueries";
import type { ColumnDef } from "@tanstack/react-table";

type PendingAction = {
  readonly action: "trash" | "restore";
  readonly id: string;
};

type BlueprintsTableProps = {
  readonly blueprints: readonly BuildingBlueprintSummary[];
  readonly canEdit: boolean;
  readonly isPaginationDisabled: boolean;
  readonly onPageChange: (page: number) => void;
  readonly pageCount: number;
  readonly pageIndex: number;
  readonly queryClient: QueryClient;
  readonly showTrash: boolean;
  readonly worldId: string;
};

function buildStatsText(blueprint: BuildingBlueprintSummary): string {
  const parts = [
    `${blueprint.tierCount.toString()} tier${blueprint.tierCount === 1 ? "" : "s"}`,
    `Grace ${blueprint.gracePeriodTurns.toString()}`,
  ];
  if (blueprint.maxInstancesPerSettlement !== null) {
    parts.push(
      `Max ${blueprint.maxInstancesPerSettlement.toString()}/settlement`,
    );
  }
  return parts.join(" · ");
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
  worldId,
}: {
  readonly canEdit: boolean;
  readonly hardDeletePendingId: string | null;
  readonly onEdit: (blueprint: BuildingBlueprintSummary) => void;
  readonly onHardDelete: (blueprint: BuildingBlueprintSummary) => void;
  readonly onRestore: (blueprint: BuildingBlueprintSummary) => void;
  readonly onTrash: (blueprint: BuildingBlueprintSummary) => void;
  readonly restorePendingId: string | null;
  readonly showTrash: boolean;
  readonly trashPendingId: string | null;
  readonly worldId: string;
}): ColumnDef<BuildingBlueprintSummary, unknown>[] {
  return [
    {
      id: "name",
      enableSorting: false,
      header: "Name",
      cell: ({ row }) => {
        const blueprint = row.original;
        return (
          <div className="flex items-center gap-2">
            <IconChip
              icon={resolveEntityIcon(blueprint.icon)}
              tone={hashToCategoricalSlot(blueprint.id)}
              size="sm"
            />
            <span className="font-medium">{blueprint.name}</span>
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
          {buildStatsText(row.original)}
        </span>
      ),
    },
    {
      id: "actions",
      enableSorting: false,
      header: "Actions",
      cell: ({ row }) => {
        const blueprint = row.original;

        if (showTrash) {
          const isPending =
            restorePendingId === blueprint.id ||
            hardDeletePendingId === blueprint.id;
          return (
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() => {
                  onRestore(blueprint);
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
                  onHardDelete(blueprint);
                }}
              >
                <Trash2 aria-hidden="true" />
                Delete permanently
              </Button>
            </div>
          );
        }

        const isTrashPending = trashPendingId === blueprint.id;
        return (
          <div className="flex items-center justify-end gap-2">
            <Button asChild variant="outline" size="sm">
              <Link
                to="/worlds/$worldId/configuration"
                params={{ worldId }}
                search={{ blueprint: blueprint.id, tab: "buildings" }}
              >
                <Layers aria-hidden="true" />
                Manage tiers
              </Link>
            </Button>
            {canEdit ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onEdit(blueprint);
                }}
              >
                Edit
              </Button>
            ) : null}
            {canEdit ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Move ${blueprint.name} to trash`}
                title="Move to trash"
                disabled={isTrashPending}
                onClick={() => {
                  onTrash(blueprint);
                }}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            ) : null}
          </div>
        );
      },
    },
  ];
}

// Table for the buildings config panel (#1032). Mutations are instantiated
// once here at the table level (not per row), and Edit opens a dialog
// instead of always mounting an inline edit row, so a world with hundreds of
// blueprints doesn't mount hundreds of mutation hooks.
export function BlueprintsTable({
  blueprints,
  canEdit,
  isPaginationDisabled,
  onPageChange,
  pageCount,
  pageIndex,
  queryClient,
  showTrash,
  worldId,
}: BlueprintsTableProps): JSX.Element {
  const [editingBlueprint, setEditingBlueprint] =
    useState<BuildingBlueprintSummary | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );
  const [hardDeleteTarget, setHardDeleteTarget] =
    useState<BuildingBlueprintSummary | null>(null);

  const softDeleteMutation = useSoftDeleteRow(
    softDeleteBlueprintMutationOptions({ queryClient }),
    { successMessage: "Blueprint moved to trash." },
  );
  const restoreMutation = useRestoreRow(
    restoreBlueprintMutationOptions({ queryClient }),
    { successMessage: "Blueprint restored." },
  );
  const hardDeleteMutation = useHardDeleteRow(
    hardDeleteBlueprintMutationOptions({ queryClient }),
    { successMessage: "Blueprint permanently deleted." },
  );

  function handleTrash(blueprint: BuildingBlueprintSummary): void {
    setPendingAction({ action: "trash", id: blueprint.id });
    softDeleteMutation.mutate(
      { blueprintId: blueprint.id, worldId },
      {
        onSettled: () => {
          setPendingAction(null);
        },
      },
    );
  }

  function handleRestore(blueprint: BuildingBlueprintSummary): void {
    setPendingAction({ action: "restore", id: blueprint.id });
    restoreMutation.mutate(
      { blueprintId: blueprint.id, worldId },
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
      { blueprintId: hardDeleteTarget.id, worldId },
      {
        onSuccess: () => {
          setHardDeleteTarget(null);
        },
      },
    );
  }

  const columns = buildColumns({
    canEdit,
    hardDeletePendingId: hardDeleteTarget?.id ?? null,
    onEdit: setEditingBlueprint,
    onHardDelete: setHardDeleteTarget,
    onRestore: handleRestore,
    onTrash: handleTrash,
    restorePendingId:
      pendingAction?.action === "restore" ? pendingAction.id : null,
    showTrash,
    trashPendingId: pendingAction?.action === "trash" ? pendingAction.id : null,
    worldId,
  });

  return (
    <>
      <DataTable
        columns={columns}
        data={blueprints}
        getRowId={(blueprint) => blueprint.id}
        sorting={[]}
        onSortingChange={() => {
          // Server-side ordering is fixed (by name); no sortable columns.
        }}
        pageIndex={pageIndex}
        pageCount={pageCount}
        onPageChange={onPageChange}
        isPaginationDisabled={isPaginationDisabled}
        emptyMessage="No blueprints found."
      />

      {editingBlueprint !== null ? (
        <EditBlueprintForm
          blueprint={editingBlueprint}
          queryClient={queryClient}
          worldId={worldId}
          onClose={() => {
            setEditingBlueprint(null);
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
