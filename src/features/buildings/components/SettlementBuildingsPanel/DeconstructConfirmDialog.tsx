import { useMutation, type QueryClient } from "@tanstack/react-query";
import { type JSX } from "react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import { manualDeconstructBuildingMutationOptions } from "../../mutations/settlementBuildingsMutations";

import type { SettlementBuilding } from "../../types/settlementBuildingTypes";

type DeconstructConfirmDialogProps = {
  readonly building: SettlementBuilding;
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
};

export function DeconstructConfirmDialog({
  building,
  onClose,
  queryClient,
  settlementId,
}: DeconstructConfirmDialogProps): JSX.Element {
  const deconstructMutation = useMutation(
    manualDeconstructBuildingMutationOptions({ queryClient, settlementId }),
  );

  async function handleConfirm(): Promise<void> {
    try {
      await deconstructMutation.mutateAsync({
        settlementBuildingId: building.id,
      });
      notifyMutationSuccess("Building deconstructed.");
      onClose();
    } catch (error) {
      notifyMutationError(error, "Failed to deconstruct building.");
    }
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={`Deconstruct ${building.blueprintName}?`}
      description={
        <>
          This will permanently deconstruct{" "}
          <span className="font-medium text-foreground">
            {building.blueprintName}
          </span>{" "}
          (Tier {building.tierNumber}). This action cannot be undone.
        </>
      }
      confirmLabel="Deconstruct"
      isPending={deconstructMutation.isPending}
      onConfirm={handleConfirm}
    />
  );
}
