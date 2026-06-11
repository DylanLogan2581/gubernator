import { useQuery, type QueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Layers, Trash2 } from "lucide-react";
import { type JSX } from "react";

import { ConfigCrudPanel } from "@/components/shared/ConfigCrudPanel";
import { TrashedEntityRow } from "@/components/shared/TrashedEntityRow";
import { Button } from "@/components/ui/button";
import { useHardDeleteRow } from "@/hooks/useHardDeleteRow";
import { useRestoreRow } from "@/hooks/useRestoreRow";
import { useSoftDeleteRow } from "@/hooks/useSoftDeleteRow";

import { useCreateBlueprintWithTiers } from "../hooks/useCreateBlueprintWithTiers";
import {
  hardDeleteBlueprintMutationOptions,
  restoreBlueprintMutationOptions,
  softDeleteBlueprintMutationOptions,
} from "../mutations/buildingsMutations";
import { blueprintsByWorldQueryOptions } from "../queries/buildingsQueries";

import { BlueprintTierEditor } from "./BlueprintTierEditor";
import { CreateBlueprintForm } from "./BuildingsConfigPanel/CreateBlueprintForm";
import { EditBlueprintForm } from "./BuildingsConfigPanel/EditBlueprintForm";

import type { BuildingBlueprint } from "../types/buildingTypes";

type BuildingsConfigPanelProps = {
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly selectedBlueprintId?: string;
  readonly worldId: string;
};

export function BuildingsConfigPanel({
  canAdmin,
  isArchived,
  selectedBlueprintId,
  worldId,
}: BuildingsConfigPanelProps): JSX.Element {
  if (selectedBlueprintId !== undefined) {
    return (
      <BlueprintTierEditor
        blueprintId={selectedBlueprintId}
        canAdmin={canAdmin}
        isArchived={isArchived}
        worldId={worldId}
      />
    );
  }

  return (
    <BlueprintListPanel
      canAdmin={canAdmin}
      isArchived={isArchived}
      worldId={worldId}
    />
  );
}

function BlueprintListPanel({
  canAdmin,
  isArchived,
  worldId,
}: {
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly worldId: string;
}): JSX.Element {
  const blueprintsQuery = useQuery(blueprintsByWorldQueryOptions(worldId));
  const canEdit = canAdmin && !isArchived;
  const { submit } = useCreateBlueprintWithTiers();

  return (
    <ConfigCrudPanel<BuildingBlueprint>
      addButtonLabel="Add blueprint"
      allData={blueprintsQuery}
      canEdit={canEdit}
      emptyTitle="No buildings yet"
      emptyDescription="Add the first building for this world."
      headerTitle="Buildings"
      isTrashed={(bp) => bp.isTrashed}
      renderContent={({
        canEdit: canEditProp,
        editingId,
        items,
        queryClient: qc,
        setEditingId,
        setShowForm,
        showForm,
        showTrash,
      }) => (
        <>
          {items.length > 0 ? (
            <ul aria-label="Blueprints" className="grid gap-2">
              {items.map((blueprint) => {
                if (editingId === blueprint.id) {
                  return (
                    <li key={blueprint.id}>
                      <EditBlueprintForm
                        blueprint={blueprint}
                        queryClient={qc}
                        worldId={worldId}
                        onClose={() => {
                          setEditingId(null);
                        }}
                      />
                    </li>
                  );
                }
                if (showTrash) {
                  return (
                    <li key={blueprint.id}>
                      <TrashedBlueprintRow
                        blueprint={blueprint}
                        queryClient={qc}
                        worldId={worldId}
                      />
                    </li>
                  );
                }
                return (
                  <li key={blueprint.id}>
                    <BlueprintRow
                      blueprint={blueprint}
                      canEdit={canEditProp}
                      queryClient={qc}
                      worldId={worldId}
                      onEdit={() => {
                        setEditingId(blueprint.id);
                      }}
                    />
                  </li>
                );
              })}
            </ul>
          ) : null}

          {canEditProp && showForm && !showTrash ? (
            <CreateBlueprintForm
              worldId={worldId}
              onCancel={() => {
                setShowForm(false);
              }}
              onSubmit={(input, pendingTiers) => {
                void submit(input, pendingTiers);
              }}
            />
          ) : null}
        </>
      )}
    />
  );
}

function BlueprintRow({
  blueprint,
  canEdit,
  queryClient,
  worldId,
  onEdit,
}: {
  readonly blueprint: BuildingBlueprint;
  readonly canEdit: boolean;
  readonly onEdit: () => void;
  readonly queryClient: QueryClient;
  readonly worldId: string;
}): JSX.Element {
  const softDeleteMutation = useSoftDeleteRow(
    softDeleteBlueprintMutationOptions({ queryClient }),
    { successMessage: "Blueprint moved to trash." },
  );

  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
      <div className="grid gap-0.5">
        <span className="text-sm font-medium">{blueprint.name}</span>
      </div>
      <div className="flex items-center gap-3">
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
          <Button type="button" variant="outline" size="sm" onClick={onEdit}>
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
            disabled={softDeleteMutation.isPending}
            onClick={() => {
              softDeleteMutation.mutate({ blueprintId: blueprint.id, worldId });
            }}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function TrashedBlueprintRow({
  blueprint,
  queryClient,
  worldId,
}: {
  readonly blueprint: BuildingBlueprint;
  readonly queryClient: QueryClient;
  readonly worldId: string;
}): JSX.Element {
  const restoreMutation = useRestoreRow(
    restoreBlueprintMutationOptions({ queryClient }),
    { successMessage: "Blueprint restored." },
  );
  const hardDeleteMutation = useHardDeleteRow(
    hardDeleteBlueprintMutationOptions({ queryClient }),
    { successMessage: "Blueprint permanently deleted." },
  );
  const isPending = restoreMutation.isPending || hardDeleteMutation.isPending;

  return (
    <TrashedEntityRow
      name={blueprint.name}
      isPending={isPending}
      onRestore={() => {
        restoreMutation.mutate({ blueprintId: blueprint.id, worldId });
      }}
      onHardDelete={() => {
        hardDeleteMutation.mutate({ blueprintId: blueprint.id, worldId });
      }}
    />
  );
}

