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
import { tiersByBlueprintQueryOptions } from "@/features/buildings";
import { activeResourcesByWorldQueryOptions } from "@/features/resources";
import { getErrorDescription } from "@/lib/errorUtils";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import { createConstructionProjectMutationOptions } from "../../mutations/createConstructionProjectMutations";

import { TierCostBreakdown } from "./TierCostBreakdown";

/**
 * Per-building "Upgrade" entry point (#1372). Starts a construction project that
 * upgrades an existing building in place, charging only the tiers above its
 * current one. The building stays functional at its current tier until the
 * upgrade completes.
 */
export function UpgradeBuildingDialog({
  buildingBlueprintId,
  buildingName,
  currentTierNumber,
  onClose,
  queryClient,
  settlementBuildingId,
  settlementId,
  worldId,
}: {
  readonly buildingBlueprintId: string;
  readonly buildingName: string;
  readonly currentTierNumber: number;
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
  readonly settlementBuildingId: string;
  readonly settlementId: string;
  readonly worldId: string;
}): JSX.Element {
  const tierSelectId = useId();
  const [selectedTierId, setSelectedTierId] = useState("");

  const tiersQuery = useQuery(
    tiersByBlueprintQueryOptions(buildingBlueprintId),
  );
  const resourcesQuery = useQuery(activeResourcesByWorldQueryOptions(worldId));

  const resourceNames = new Map(
    (resourcesQuery.data ?? []).map((r) => [r.id, r.name]),
  );

  const createMutation = useMutation(
    createConstructionProjectMutationOptions({ queryClient, worldId }),
  );

  const selectableTiers = (tiersQuery.data ?? []).filter(
    (t) => t.tierNumber > currentTierNumber,
  );
  const selectedTier = (tiersQuery.data ?? []).find(
    (t) => t.id === selectedTierId,
  );

  async function handleUpgrade(): Promise<void> {
    if (selectedTierId === "") return;
    try {
      await createMutation.mutateAsync({
        blueprintId: buildingBlueprintId,
        settlementId,
        targetTierId: selectedTierId,
        upgradeSettlementBuildingId: settlementBuildingId,
      });
      notifyMutationSuccess("Building upgrade started.");
      onClose();
    } catch (error) {
      notifyMutationError(error, "Failed to start building upgrade.");
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
          <DialogTitle>Upgrade {buildingName}</DialogTitle>
          <DialogDescription>
            Choose a higher tier. The building stays active at tier{" "}
            {currentTierNumber} until the upgrade finishes; only the added tiers
            are charged.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor={tierSelectId}>Target tier</Label>
            {tiersQuery.isPending ? (
              <p className="text-sm text-muted-foreground">Loading tiers…</p>
            ) : tiersQuery.isError ? (
              <p className="text-sm text-destructive">
                {getErrorDescription(tiersQuery.error)}
              </p>
            ) : selectableTiers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                This building is already at its highest tier.
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

          {selectedTier !== undefined ? (
            <TierCostBreakdown
              fromTierNumber={currentTierNumber}
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
            disabled={createMutation.isPending || selectedTierId === ""}
            type="button"
            onClick={() => {
              void handleUpgrade();
            }}
          >
            Start upgrade
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
