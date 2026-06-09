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

import { hardDeleteSettlementBuildingMutationOptions } from "../../mutations/settlementBuildingsMutations";

import type { SettlementBuilding } from "../../types/settlementBuildingTypes";

type HardDeleteSettlementBuildingDialogProps = {
  readonly building: SettlementBuilding;
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
  readonly worldId: string;
};

export function HardDeleteSettlementBuildingDialog({
  building,
  onClose,
  queryClient,
  settlementId,
  worldId,
}: HardDeleteSettlementBuildingDialogProps): JSX.Element {
  const hardDeleteMutation = useMutation(
    hardDeleteSettlementBuildingMutationOptions({ queryClient, settlementId }),
  );

  async function handleConfirm(): Promise<void> {
    try {
      await hardDeleteMutation.mutateAsync({
        settlementBuildingId: building.id,
        worldId,
      });
      notifyMutationSuccess("Building permanently deleted.");
      onClose();
    } catch (error) {
      notifyMutationError(error, "Failed to delete building.");
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
          <DialogTitle>
            Permanently delete {building.blueprintName}?
          </DialogTitle>
        </DialogHeader>
        <DialogDescription>
          This will permanently delete{" "}
          <span className="font-medium text-foreground">
            {building.blueprintName}
          </span>{" "}
          (Tier {building.tierNumber}). This action cannot be undone.
        </DialogDescription>
        <DialogFooter>
          <Button
            disabled={hardDeleteMutation.isPending}
            onClick={onClose}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            disabled={hardDeleteMutation.isPending}
            type="button"
            variant="destructive"
            onClick={() => {
              void handleConfirm();
            }}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
