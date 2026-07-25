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

import { TierCostBreakdown } from "./TierCostBreakdown";
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
  const upgradeSelectId = useId();

  const [selectedBlueprintId, setSelectedBlueprintId] = useState("");
  const [selectedTierId, setSelectedTierId] = useState("");
  const [selectedUpgradeBuildingId, setSelectedUpgradeBuildingId] =
    useState("");

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
    createConstructionProjectMutationOptions({ queryClient, worldId }),
  );

  const availableBlueprints: readonly BuildingBlueprint[] =
    blueprintsQuery.data?.filter((b) => !b.isTrashed) ?? [];

  const selectedBlueprint: BuildingBlueprint | undefined =
    availableBlueprints.find((b) => b.id === selectedBlueprintId);

  const selectedTier: BuildingBlueprintTier | undefined = tiersQuery.data?.find(
    (t) => t.id === selectedTierId,
  );

  // Active buildings of the selected blueprint that can be upgraded — i.e. that
  // are not already at the blueprint's highest tier (#1372).
  const maxTierNumber = (tiersQuery.data ?? []).reduce(
    (max, t) => Math.max(max, t.tierNumber),
    0,
  );
  const upgradeableBuildings = (buildingsQuery.data ?? []).filter(
    (b) =>
      b.buildingBlueprintId === selectedBlueprintId &&
      b.state === "active" &&
      b.tierNumber < maxTierNumber,
  );

  const upgradeBuilding = upgradeableBuildings.find(
    (b) => b.id === selectedUpgradeBuildingId,
  );
  const isUpgrade = upgradeBuilding !== undefined;
  const fromTierNumber = upgradeBuilding?.tierNumber ?? 0;

  // In upgrade mode only higher tiers than the building's current tier are valid.
  const selectableTiers = (tiersQuery.data ?? []).filter(
    (t) => t.tierNumber > fromTierNumber,
  );

  // The instance cap only applies to direct builds; upgrades reuse a building.
  const capOverflowError = isUpgrade
    ? null
    : getCapOverflowError(
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
        ...(isUpgrade
          ? { upgradeSettlementBuildingId: selectedUpgradeBuildingId }
          : {}),
      });
      notifyMutationSuccess(
        isUpgrade
          ? "Building upgrade started."
          : "Construction project started.",
      );
      onClose();
    } catch (error) {
      notifyMutationError(
        error,
        isUpgrade
          ? "Failed to start building upgrade."
          : "Failed to start construction project.",
      );
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
                  setSelectedUpgradeBuildingId("");
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

          {selectedBlueprintId !== "" && upgradeableBuildings.length > 0 ? (
            <div className="grid gap-1.5">
              <Label htmlFor={upgradeSelectId}>Upgrade existing building</Label>
              <NativeSelect
                className="w-full"
                id={upgradeSelectId}
                value={selectedUpgradeBuildingId}
                onChange={(e) => {
                  setSelectedUpgradeBuildingId(e.target.value);
                  setSelectedTierId("");
                }}
              >
                <option value="">Build new (start at tier 1)</option>
                {upgradeableBuildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name ?? b.blueprintName} (currently tier {b.tierNumber})
                  </option>
                ))}
              </NativeSelect>
            </div>
          ) : null}

          {selectedBlueprintId !== "" ? (
            <div className="grid gap-1.5">
              <Label htmlFor={tierSelectId}>
                {isUpgrade ? "Target tier" : "Tier"}
              </Label>
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
                  {selectableTiers.map((t) => (
                    <option key={t.id} value={t.id}>
                      Tier {t.tierNumber}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </div>
          ) : null}

          {selectedTier !== undefined && (tiersQuery.data?.length ?? 0) > 0 ? (
            <TierCostBreakdown
              fromTierNumber={fromTierNumber}
              resourceNames={resourceNames}
              targetTierNumber={selectedTier.tierNumber}
              tiers={tiersQuery.data ?? []}
            />
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
