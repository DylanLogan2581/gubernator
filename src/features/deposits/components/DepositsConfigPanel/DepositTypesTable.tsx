import { RotateCcw, Trash2 } from "lucide-react";
import { useState, type JSX } from "react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable } from "@/components/shared/DataTable";
import { IconChip } from "@/components/shared/IconChip";
import { resolveEntityIcon } from "@/components/shared/iconPicker/CuratedIcons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type JobDefinition } from "@/features/jobs";
import { useHardDeleteRow } from "@/hooks/useHardDeleteRow";
import { useRestoreRow } from "@/hooks/useRestoreRow";
import { useSoftDeleteRow } from "@/hooks/useSoftDeleteRow";
import { resolveIconTone } from "@/lib/categoricalPalette";

import {
  hardDeleteDepositTypeMutationOptions,
  restoreDepositTypeMutationOptions,
  softDeleteDepositTypeMutationOptions,
} from "../../mutations/depositsMutations";

import { EditDepositTypeForm } from "./EditDepositTypeForm";

import type { DepositType } from "../../types/depositTypes";
import type { QueryClient } from "@tanstack/react-query";
import type { ColumnDef, SortingState } from "@tanstack/react-table";

type DepositTypesTableProps = {
  readonly canEdit: boolean;
  readonly depositJobs: readonly JobDefinition[];
  readonly depositTypes: readonly DepositType[];
  readonly isPaginationDisabled: boolean;
  readonly onPageChange: (page: number) => void;
  readonly onSortingChange: (sorting: SortingState) => void;
  readonly pageCount: number;
  readonly pageIndex: number;
  readonly queryClient: QueryClient;
  readonly showTrash: boolean;
  readonly sorting: SortingState;
  readonly worldId: string;
};

function buildColumns({
  canEdit,
  depositJobs,
  hardDeletePendingId,
  onEdit,
  onHardDeleteRequest,
  onRestore,
  onTrash,
  restorePendingId,
  showTrash,
  trashPendingId,
}: {
  readonly canEdit: boolean;
  readonly depositJobs: readonly JobDefinition[];
  readonly hardDeletePendingId: string | null;
  readonly onEdit: (depositType: DepositType) => void;
  readonly onHardDeleteRequest: (depositType: DepositType) => void;
  readonly onRestore: (depositType: DepositType) => void;
  readonly onTrash: (depositType: DepositType) => void;
  readonly restorePendingId: string | null;
  readonly showTrash: boolean;
  readonly trashPendingId: string | null;
}): ColumnDef<DepositType, unknown>[] {
  return [
    {
      id: "name",
      accessorFn: (row) => row.name,
      enableSorting: true,
      header: "Name",
      cell: ({ row }) => {
        const depositType = row.original;
        return (
          <div className="flex items-center gap-2">
            <IconChip
              icon={resolveEntityIcon(depositType.icon)}
              tone={resolveIconTone(depositType.iconColor, depositType.id)}
            />
            <span className="font-medium">{depositType.name}</span>
          </div>
        );
      },
    },
    {
      id: "jobs",
      accessorFn: (row) => row.jobs.length,
      enableSorting: false,
      header: "Linked jobs",
      cell: ({ row }) => {
        const depositType = row.original;
        if (depositType.jobs.length === 0) {
          return <span className="text-sm text-muted-foreground">—</span>;
        }
        const tierLabels = [...depositType.jobs]
          .sort((a, b) => a.tierNumber - b.tierNumber)
          .flatMap((job) => {
            const linkedJob = depositJobs.find((j) => j.id === job.jobId);
            return linkedJob === undefined
              ? []
              : [`T${job.tierNumber.toString()}: ${linkedJob.name}`];
          });
        return (
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">
              {depositType.jobs.length}{" "}
              {depositType.jobs.length === 1 ? "job" : "jobs"}
            </Badge>
            {tierLabels.length > 0 ? (
              <span className="text-sm text-muted-foreground">
                {tierLabels.join(", ")}
              </span>
            ) : null}
          </div>
        );
      },
    },
    {
      id: "actions",
      enableSorting: false,
      header: "Actions",
      cell: ({ row }) => {
        const depositType = row.original;

        if (showTrash) {
          const isPending =
            restorePendingId === depositType.id ||
            hardDeletePendingId === depositType.id;
          return (
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() => {
                  onRestore(depositType);
                }}
              >
                <RotateCcw aria-hidden="true" />
                Restore
              </Button>
              {depositType.hasActiveReferences ? (
                <span title="Cannot permanently delete: this deposit type is referenced by active job configurations.">
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
                    onHardDeleteRequest(depositType);
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

        const isTrashPending = trashPendingId === depositType.id;
        return (
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                onEdit(depositType);
              }}
            >
              Edit
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Move ${depositType.name} to trash`}
              title="Move to trash"
              disabled={isTrashPending}
              onClick={() => {
                onTrash(depositType);
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

// Table for the deposits config panel (#1032). Mutations are instantiated
// once here at the table level (not per row), and Edit opens a dialog
// instead of always mounting an inline edit row, so a world with hundreds
// of deposit types doesn't mount hundreds of mutation hooks.
export function DepositTypesTable({
  canEdit,
  depositJobs,
  depositTypes,
  isPaginationDisabled,
  onPageChange,
  onSortingChange,
  pageCount,
  pageIndex,
  queryClient,
  showTrash,
  sorting,
  worldId,
}: DepositTypesTableProps): JSX.Element {
  const [editingDepositType, setEditingDepositType] =
    useState<DepositType | null>(null);
  const [hardDeleteTarget, setHardDeleteTarget] = useState<DepositType | null>(
    null,
  );

  const softDeleteMutation = useSoftDeleteRow(
    softDeleteDepositTypeMutationOptions({ queryClient }),
    { successMessage: "Deposit type moved to trash." },
  );
  const restoreMutation = useRestoreRow(
    restoreDepositTypeMutationOptions({ queryClient }),
    { successMessage: "Deposit type restored." },
  );
  const hardDeleteMutation = useHardDeleteRow(
    hardDeleteDepositTypeMutationOptions({ queryClient }),
    { successMessage: "Deposit type permanently deleted." },
  );

  function handleHardDeleteConfirm(): void {
    if (hardDeleteTarget === null) return;
    hardDeleteMutation.mutate(
      { depositTypeId: hardDeleteTarget.id, worldId },
      {
        onSuccess: () => {
          setHardDeleteTarget(null);
        },
      },
    );
  }

  const columns = buildColumns({
    canEdit,
    depositJobs,
    hardDeletePendingId: hardDeleteMutation.isPending
      ? (hardDeleteMutation.variables?.depositTypeId ?? null)
      : null,
    onEdit: setEditingDepositType,
    onHardDeleteRequest: setHardDeleteTarget,
    onRestore: (depositType) => {
      restoreMutation.mutate({ depositTypeId: depositType.id, worldId });
    },
    onTrash: (depositType) => {
      softDeleteMutation.mutate({ depositTypeId: depositType.id, worldId });
    },
    restorePendingId: restoreMutation.isPending
      ? (restoreMutation.variables?.depositTypeId ?? null)
      : null,
    showTrash,
    trashPendingId: softDeleteMutation.isPending
      ? (softDeleteMutation.variables?.depositTypeId ?? null)
      : null,
  });

  return (
    <>
      <DataTable
        columns={columns}
        data={depositTypes}
        getRowId={(depositType) => depositType.id}
        sorting={sorting}
        onSortingChange={onSortingChange}
        pageIndex={pageIndex}
        pageCount={pageCount}
        onPageChange={onPageChange}
        isPaginationDisabled={isPaginationDisabled}
        emptyMessage="No deposit types found."
      />

      {editingDepositType !== null ? (
        <EditDepositTypeForm
          depositJobs={depositJobs}
          depositType={editingDepositType}
          queryClient={queryClient}
          worldId={worldId}
          onClose={() => {
            setEditingDepositType(null);
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
