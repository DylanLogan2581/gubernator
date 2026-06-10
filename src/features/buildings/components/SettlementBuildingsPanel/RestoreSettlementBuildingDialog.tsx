import { useMutation, type QueryClient } from "@tanstack/react-query";
import { type JSX } from "react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import { restoreSettlementBuildingMutationOptions } from "../../mutations/settlementBuildingsMutations";

import type { SettlementBuilding } from "../../types/settlementBuildingTypes";

type RestoreSettlementBuildingDialogProps = {
  readonly building: SettlementBuilding;
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
  readonly worldId: string;
};

export function RestoreSettlementBuildingDialog({
  building,
  onClose,
  queryClient,
  settlementId,
  worldId,
}: RestoreSettlementBuildingDialogProps): JSX.Element {
  const restoreMutation = useMutation(
    restoreSettlementBuildingMutationOptions({ queryClient, settlementId }),
  );

  async function handleConfirm(): Promise<void> {
    try {
      await restoreMutation.mutateAsync({
        settlementBuildingId: building.id,
        worldId,
      });
      notifyMutationSuccess("Building restored.");
      onClose();
    } catch (error) {
      notifyMutationError(error, "Failed to restore building.");
    }
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={`Restore ${building.blueprintName}?`}
      description={
        <>
          This will restore{" "}
          <span className="font-medium text-foreground">
            {building.blueprintName}
          </span>{" "}
          (Tier {building.tierNumber}) to active status.
        </>
      }
      confirmLabel="Restore"
      confirmVariant="default"
      isPending={restoreMutation.isPending}
      onConfirm={handleConfirm}
    />
  );
}
