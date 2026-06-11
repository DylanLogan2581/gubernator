import { useMutation, useQuery, type QueryClient } from "@tanstack/react-query";
import { useId, useState, type JSX } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  blueprintsByWorldQueryOptions,
  tiersByBlueprintQueryOptions,
  type BuildingBlueprint,
  type BuildingBlueprintTier,
  settlementBuildingsBySettlementQueryOptions,
} from "@/features/buildings";
import { activeResourcesByWorldQueryOptions } from "@/features/resources";
import { getErrorDescription } from "@/lib/errorUtils";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import { createConstructionProjectMutationOptions } from "../../mutations/createConstructionProjectMutations";
import { constructionProjectsBySettlementQueryOptions } from "../../queries/constructionProjectsQueries";

import { getCapOverflowError } from "./utils/ConstructionQueueUtils";

export function CreateProjectDialog({
  onClose,
  queryClient,
  settlementId,
  worldId,
}: {
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
  readonly worldId: string;
}): JSX.Element {
  const blueprintSelectId = useId();
  const tierSelectId = useId();

  const [selectedBlueprintId, setSelectedBlueprintId] = useState("");
  const [selectedTierId, setSelectedTierId] = useState("");

  const blueprintsQuery = useQuery(blueprintsByWorldQueryOptions(worldId));
  const projectsQuery = useQuery(
    constructionProjectsBySettlementQueryOptions(settlementId),
  );
  const buildingsQuery = useQuery(
    settlementBuildingsBySettlementQueryOptions(settlementId),
  );
  const tiersQuery = useQuery({
    ...tiersByBlueprintQueryOptions(selectedBlueprintId),
    enabled: selectedBlueprintId !== "",
  });
  const resourcesQuery = useQuery(activeResourcesByWorldQueryOptions(worldId));

  const resourceNames = new Map(
    (resourcesQuery.data ?? []).map((r) => [r.id, r.name]),
  );

  const createMutation = useMutation(
    createConstructionProjectMutationOptions({ queryClient }),
  );

  const availableBlueprints: readonly BuildingBlueprint[] =
    blueprintsQuery.data?.filter((b) => !b.isTrashed) ?? [];

  const selectedBlueprint: BuildingBlueprint | undefined =
    availableBlueprints.find((b) => b.id === selectedBlueprintId);

  const selectedTier: BuildingBlueprintTier | undefined = tiersQuery.data?.find(
    (t) => t.id === selectedTierId,
  );

  const capOverflowError = getCapOverflowError(
    selectedBlueprint,
    selectedBlueprintId,
    projectsQuery.data ?? [],
    buildingsQuery.data ?? [],
  );

  async function handleCreate(): Promise<void> {
    if (selectedBlueprintId === "" || selectedTierId === "") return;
    try {
      await createMutation.mutateAsync({
        blueprintId: selectedBlueprintId,
        settlementId,
        targetTierId: selectedTierId,
      });
      notifyMutationSuccess("Construction project started.");
      onClose();
    } catch (error) {
      notifyMutationError(error, "Failed to start construction project.");
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Start construction</DialogTitle>
          <DialogDescription>
            Choose the blueprint and tier for the new construction project.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor={blueprintSelectId}>Blueprint</Label>
            {blueprintsQuery.isPending ? (
              <p className="text-sm text-muted-foreground">
                Loading blueprints…
              </p>
            ) : blueprintsQuery.isError ? (
              <p className="text-sm text-destructive">
                {getErrorDescription(blueprintsQuery.error)}
              </p>
            ) : (
              <NativeSelect
                aria-invalid={capOverflowError !== null ? true : undefined}
                className="w-full"
                id={blueprintSelectId}
                value={selectedBlueprintId}
                onChange={(e) => {
                  setSelectedBlueprintId(e.target.value);
                  setSelectedTierId("");
                }}
              >
                <option value="">Select a blueprint…</option>
                {availableBlueprints.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </NativeSelect>
            )}
            {capOverflowError !== null ? (
              <p className="text-sm text-destructive" role="alert">
                {capOverflowError}
              </p>
            ) : null}
          </div>

          {selectedBlueprintId !== "" ? (
            <div className="grid gap-1.5">
              <Label htmlFor={tierSelectId}>Tier</Label>
              {tiersQuery.isPending ? (
                <p className="text-sm text-muted-foreground">Loading tiers…</p>
              ) : tiersQuery.isError ? (
                <p className="text-sm text-destructive">
                  {getErrorDescription(tiersQuery.error)}
                </p>
              ) : (
                <NativeSelect
                  className="w-full"
                  id={tierSelectId}
                  value={selectedTierId}
                  onChange={(e) => {
                    setSelectedTierId(e.target.value);
                  }}
                >
                  <option value="">Select a tier…</option>
                  {(tiersQuery.data ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      Tier {t.tierNumber}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </div>
          ) : null}

          {selectedTier !== undefined &&
          selectedTier.constructionCostsJson.length > 0 ? (
            <div className="grid gap-1.5">
              <p className="text-sm font-medium">Construction cost</p>
              <ul className="grid gap-0.5">
                {selectedTier.constructionCostsJson.map((cost) => (
                  <li
                    key={cost.resourceId}
                    className="text-sm text-muted-foreground"
                  >
                    {resourceNames.get(cost.resourceId) ?? cost.resourceId}:{" "}
                    {cost.amount}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            disabled={createMutation.isPending}
            onClick={onClose}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            disabled={
              createMutation.isPending ||
              selectedBlueprintId === "" ||
              selectedTierId === "" ||
              capOverflowError !== null
            }
            type="button"
            onClick={() => {
              void handleCreate();
            }}
          >
            Start
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
