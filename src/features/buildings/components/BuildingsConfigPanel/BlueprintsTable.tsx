import { useQuery, type QueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Layers, RotateCcw, Trash2 } from "lucide-react";
import { useState, type JSX } from "react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable } from "@/components/shared/DataTable";
import { ErrorState } from "@/components/shared/ErrorState";
import { IconChip } from "@/components/shared/IconChip";
import { resolveEntityIcon } from "@/components/shared/iconPicker/CuratedIcons";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { EducationLevel } from "@/features/education";
import type { JobDefinition } from "@/features/jobs";
import type { Resource } from "@/features/resources";
import { useHardDeleteRow } from "@/hooks/useHardDeleteRow";
import { useRestoreRow } from "@/hooks/useRestoreRow";
import { useSoftDeleteRow } from "@/hooks/useSoftDeleteRow";
import { hashToCategoricalSlot } from "@/lib/categoricalPalette";

import {
  hardDeleteBlueprintMutationOptions,
  restoreBlueprintMutationOptions,
  softDeleteBlueprintMutationOptions,
} from "../../mutations/buildingsMutations";
import { tiersByBlueprintQueryOptions } from "../../queries/buildingsQueries";
import {
  formatTierCosts,
  formatTierEffects,
} from "../../utils/tierSummaryFormatting";

import { EditBlueprintForm } from "./EditBlueprintForm";

import type { BuildingBlueprintSummary } from "../../queries/buildingsQueries";
import type { BuildingBlueprintTier } from "../../types/buildingTypes";
import type { ColumnDef, SortingState } from "@tanstack/react-table";

type PendingAction = {
  readonly action: "trash" | "restore";
  readonly id: string;
};

const GRACE_PERIOD_HINT =
  "Turns a building can miss upkeep before it is suspended. 0 = suspend on first missed upkeep.";

type BlueprintsTableProps = {
  readonly activeEducationLevels: readonly EducationLevel[];
  readonly activeJobs: readonly JobDefinition[];
  readonly activeResources: readonly Resource[];
  readonly blueprints: readonly BuildingBlueprintSummary[];
  readonly canEdit: boolean;
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
  readonly onEdit: (blueprint: BuildingBlueprintSummary) => void;
  readonly onHardDelete: (blueprint: BuildingBlueprintSummary) => void;
  readonly onRestore: (blueprint: BuildingBlueprintSummary) => void;
  readonly onTrash: (blueprint: BuildingBlueprintSummary) => void;
  readonly restorePendingId: string | null;
  readonly showTrash: boolean;
  readonly trashPendingId: string | null;
}): ColumnDef<BuildingBlueprintSummary, unknown>[] {
  return [
    {
      id: "name",
      accessorFn: (row) => row.name,
      enableSorting: true,
      header: "Name",
      cell: ({ row }) => {
        const blueprint = row.original;
        return (
          <div className="flex items-center gap-2">
            <IconChip
              icon={resolveEntityIcon(blueprint.icon)}
              tone={hashToCategoricalSlot(blueprint.id)}
            />
            <span className="font-medium">{blueprint.name}</span>
          </div>
        );
      },
    },
    {
      id: "tierCount",
      accessorFn: (row) => row.tierCount,
      // Tier count comes from an embedded PostgREST count join
      // (BLUEPRINT_SUMMARY_SELECT in buildingsQueries.ts), which can't be
      // ordered without a computed column/view — a schema change out of
      // scope for this UI polish pass (#1207).
      enableSorting: false,
      header: "Tiers",
      meta: { align: "right" },
      cell: ({ row }) => (
        <span className="tabular-nums text-sm text-muted-foreground">
          {row.original.tierCount}
        </span>
      ),
    },
    {
      id: "gracePeriod",
      accessorFn: (row) => row.gracePeriodTurns,
      enableSorting: true,
      header: () => <span title={GRACE_PERIOD_HINT}>Grace period</span>,
      meta: { align: "right" },
      cell: ({ row }) => (
        <span
          className="tabular-nums text-sm text-muted-foreground"
          title={GRACE_PERIOD_HINT}
        >
          {row.original.gracePeriodTurns.toLocaleString()}
        </span>
      ),
    },
    {
      id: "maxInstances",
      accessorFn: (row) => row.maxInstancesPerSettlement ?? "",
      enableSorting: true,
      header: "Max / settlement",
      meta: { align: "right" },
      cell: ({ row }) => {
        const max = row.original.maxInstancesPerSettlement;
        if (max === null) {
          return <span className="text-sm text-muted-foreground">—</span>;
        }
        return (
          <span className="tabular-nums text-sm text-muted-foreground">
            {max.toLocaleString()}
          </span>
        );
      },
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

function TierSubRows({
  activeEducationLevels,
  activeJobs,
  activeResources,
  blueprint,
  worldId,
}: {
  readonly activeEducationLevels: readonly EducationLevel[];
  readonly activeJobs: readonly JobDefinition[];
  readonly activeResources: readonly Resource[];
  readonly blueprint: BuildingBlueprintSummary;
  readonly worldId: string;
}): JSX.Element {
  const tiersQuery = useQuery(tiersByBlueprintQueryOptions(blueprint.id));

  return (
    <div className="grid gap-2 py-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Tiers</h3>
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
      </div>

      {tiersQuery.isPending ? (
        <p className="text-sm text-muted-foreground">Loading tiers…</p>
      ) : tiersQuery.isError ? (
        <ErrorState title="Tiers could not be loaded" />
      ) : tiersQuery.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tiers yet.</p>
      ) : (
        <Table className="text-sm">
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Tier</TableHead>
              <TableHead scope="col">Worker turns</TableHead>
              <TableHead scope="col">Construction cost</TableHead>
              <TableHead scope="col">Upkeep</TableHead>
              <TableHead scope="col">Effects</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...tiersQuery.data]
              .sort((a, b) => a.tierNumber - b.tierNumber)
              .map((tier: BuildingBlueprintTier) => (
                <TableRow key={tier.id}>
                  <TableCell>{tier.tierNumber}</TableCell>
                  <TableCell className="tabular-nums">
                    {tier.workerTurnsRequired}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {tier.constructionCostsJson.length > 0
                      ? formatTierCosts(
                          tier.constructionCostsJson,
                          activeResources,
                        )
                      : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {tier.upkeepCostsJson.length > 0
                      ? formatTierCosts(tier.upkeepCostsJson, activeResources)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {tier.effectsJson.length > 0
                      ? formatTierEffects(
                          tier.effectsJson,
                          activeResources,
                          activeJobs,
                          activeEducationLevels,
                        )
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

// Table for the buildings config panel (#1168). Blueprint-level stats are
// split into atomic, sortable columns instead of one combined "Stats" cell,
// and each row expands in place to a per-tier breakdown (also atomic
// columns) instead of requiring navigation to the separate tier editor page.
// Mutations are instantiated once here at the table level (not per row), and
// Edit opens a dialog instead of always mounting an inline edit row, so a
// world with hundreds of blueprints doesn't mount hundreds of mutation hooks.
export function BlueprintsTable({
  activeEducationLevels,
  activeJobs,
  activeResources,
  blueprints,
  canEdit,
  isPaginationDisabled,
  onPageChange,
  onSortingChange,
  pageCount,
  pageIndex,
  queryClient,
  showTrash,
  sorting,
  worldId,
}: BlueprintsTableProps): JSX.Element {
  const [editingBlueprint, setEditingBlueprint] =
    useState<BuildingBlueprintSummary | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );
  const [hardDeleteTarget, setHardDeleteTarget] =
    useState<BuildingBlueprintSummary | null>(null);
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

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

  function toggleExpanded(blueprint: BuildingBlueprintSummary): void {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(blueprint.id)) {
        next.delete(blueprint.id);
      } else {
        next.add(blueprint.id);
      }
      return next;
    });
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
  });

  return (
    <>
      <DataTable
        columns={columns}
        data={blueprints}
        getRowId={(blueprint) => blueprint.id}
        sorting={sorting}
        onSortingChange={onSortingChange}
        pageIndex={pageIndex}
        pageCount={pageCount}
        onPageChange={onPageChange}
        isPaginationDisabled={isPaginationDisabled}
        emptyMessage="No blueprints found."
        expandToggleLabel={(blueprint) => `${blueprint.name} tiers`}
        isRowExpanded={(blueprint) => expandedIds.has(blueprint.id)}
        onToggleRowExpand={toggleExpanded}
        renderExpandedContent={(blueprint) => (
          <TierSubRows
            activeEducationLevels={activeEducationLevels}
            activeJobs={activeJobs}
            activeResources={activeResources}
            blueprint={blueprint}
            worldId={worldId}
          />
        )}
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
