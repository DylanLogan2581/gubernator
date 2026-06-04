import { useMutation, type QueryClient } from "@tanstack/react-query";
import { type JSX } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deconstruct {building.blueprintName}?</DialogTitle>
        </DialogHeader>
        <DialogDescription>
          This will permanently deconstruct{" "}
          <span className="font-medium text-foreground">
            {building.blueprintName}
          </span>{" "}
          (Tier {building.tierNumber}). This action cannot be undone.
        </DialogDescription>
        <DialogFooter>
          <Button
            disabled={deconstructMutation.isPending}
            onClick={onClose}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            disabled={deconstructMutation.isPending}
            type="button"
            variant="destructive"
            onClick={() => {
              void handleConfirm();
            }}
          >
            Deconstruct
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
